/**
 * workers/demo-worker.ts
 *
 * Dedicated Demo Automation Queue Worker.
 * Consumes jobs from the demo queue, applies exponential backoff retries,
 * handles dead-letter isolation, and maintains heartbeat telemetry.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DEMO_DIR } from "../scripts/demo/lib/demo-session";
import {
  processDemoJobs,
  listJobs,
  type DemoJob,
} from "../scripts/demo/queue";
import { recordWorkerHeartbeatDB, type DemoWorkerHeartbeat } from "../scripts/demo/lib/demo-db";

export interface DemoWorkerState {
  workerId: string;
  status: "alive" | "degraded" | "stopped";
  startedAt: string;
  lastHeartbeatAt: string;
  jobsProcessed: number;
  jobsFailed: number;
  uptimeSeconds: number;
}

export const DEFAULT_HEARTBEAT_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_worker_heartbeat.json",
);

let activeWorkerState: DemoWorkerState | null = null;

export function initWorkerState(workerId = `worker_${crypto.randomUUID().slice(0, 8)}`): DemoWorkerState {
  const now = new Date().toISOString();
  activeWorkerState = {
    workerId,
    status: "alive",
    startedAt: now,
    lastHeartbeatAt: now,
    jobsProcessed: 0,
    jobsFailed: 0,
    uptimeSeconds: 0,
  };
  saveHeartbeatLocally(activeWorkerState);
  return activeWorkerState;
}

export function getWorkerState(customFilePath = DEFAULT_HEARTBEAT_FILE): DemoWorkerState | null {
  if (activeWorkerState) return activeWorkerState;
  if (!fs.existsSync(customFilePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoWorkerState;
  } catch {
    return null;
  }
}

function saveHeartbeatLocally(
  state: DemoWorkerState,
  customFilePath = DEFAULT_HEARTBEAT_FILE,
): void {
  try {
    const dir = path.dirname(customFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(customFilePath, JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // Fail-silent local write
  }
}

/**
 * Emits worker heartbeat to local storage and optional Supabase DB.
 */
export async function emitWorkerHeartbeat(
  options: { customFilePath?: string; customClient?: SupabaseClient } = {},
): Promise<DemoWorkerHeartbeat> {
  const state = activeWorkerState || initWorkerState();
  const startTime = new Date(state.startedAt).getTime();
  const now = Date.now();
  state.uptimeSeconds = Math.floor((now - startTime) / 1000);
  state.lastHeartbeatAt = new Date().toISOString();

  saveHeartbeatLocally(state, options.customFilePath);

  const heartbeat: DemoWorkerHeartbeat = {
    workerId: state.workerId,
    status: state.status,
    jobsProcessed: state.jobsProcessed,
    jobsFailed: state.jobsFailed,
    uptimeSeconds: state.uptimeSeconds,
    lastHeartbeatAt: state.lastHeartbeatAt,
  };

  await recordWorkerHeartbeatDB(heartbeat, options);
  return heartbeat;
}

export type DemoJobExecutor = (job: DemoJob) => Promise<void>;

/**
 * Executes a single worker processing tick.
 */
export async function runDemoWorkerTick(
  jobHandler?: DemoJobExecutor,
  options: {
    batchSize?: number;
    customQueueFile?: string;
    customHeartbeatFile?: string;
  } = {},
): Promise<{ processed: number; succeeded: number; failed: number; pendingRemaining: number }> {
  const state = activeWorkerState || initWorkerState();

  const defaultHandler: DemoJobExecutor = async (_job: DemoJob) => {
    // Default mock executor simulates fast deterministic task execution
  };

  const handler = jobHandler || defaultHandler;
  const result = await processDemoJobs(handler, {
    batchSize: options.batchSize ?? 10,
    customFilePath: options.customQueueFile,
  });

  state.jobsProcessed += result.succeeded;
  state.jobsFailed += result.failed;
  if (result.failed > 0 && result.succeeded === 0) {
    state.status = "degraded";
  } else {
    state.status = "alive";
  }

  await emitWorkerHeartbeat({ customFilePath: options.customHeartbeatFile });

  const remainingJobs = listJobs("pending", options.customQueueFile);

  return {
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    pendingRemaining: remainingJobs.length,
  };
}
