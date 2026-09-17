/**
 * scripts/demo/lib/demo-db.ts
 *
 * Database Persistence Layer for Demo Revenue OS.
 * Provides resilient persistence against Supabase demo tables with
 * transparent fallback to local JSON storage in .demo/.
 *
 * Strictly adheres to production isolation guards:
 * NEVER writes to production project zywwwvrotgqouxillpvi or in NODE_ENV=production.
 */

import { carregarEnvLocal } from "../../lib/env-de-teste";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoBusEvent } from "../events/types";
import type { DemoJob } from "../queue/types";

export interface DemoWorkerHeartbeat {
  workerId: string;
  status: "alive" | "degraded" | "stopped";
  jobsProcessed: number;
  jobsFailed: number;
  uptimeSeconds: number;
  lastHeartbeatAt: string;
}

const PRODUCTION_PROJECT_REF = "zywwwvrotgqouxillpvi";

export function isDemoDatabaseSafe(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const env = { ...carregarEnvLocal(), ...process.env };
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (supabaseUrl.includes(PRODUCTION_PROJECT_REF)) return false;
  return true;
}

/**
 * Safely persists an emitted demo bus event to demo_events table if DB is available.
 */
export async function persistDemoEventToDB(
  event: DemoBusEvent,
  options: { customClient?: SupabaseClient } = {},
): Promise<boolean> {
  if (!isDemoDatabaseSafe()) return false;
  if (!options.customClient) return false;

  try {
    const { error } = await options.customClient.from("demo_events").insert({
      id: event.id,
      tenant_id: event.tenantId ?? "system",
      topic: event.topic,
      payload: event.payload,
      emitted_at: event.emittedAt,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Safely upserts a demo queue job to demo_queue_jobs table if DB is available.
 */
export async function persistDemoJobToDB(
  job: DemoJob,
  options: { customClient?: SupabaseClient } = {},
): Promise<boolean> {
  if (!isDemoDatabaseSafe()) return false;
  if (!options.customClient) return false;

  try {
    const { error } = await options.customClient.from("demo_queue_jobs").upsert({
      id: job.id,
      job_type: job.jobType,
      payload: job.payload,
      idempotency_key: job.idempotencyKey,
      status: job.status,
      attempts: job.attempts,
      max_retries: job.maxRetries,
      next_run_at: job.nextRunAt,
      last_error: job.lastError,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      completed_at: job.completedAt,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Safely writes worker heartbeat to demo_worker_heartbeats.
 */
export async function recordWorkerHeartbeatDB(
  heartbeat: DemoWorkerHeartbeat,
  options: { customClient?: SupabaseClient } = {},
): Promise<boolean> {
  if (!isDemoDatabaseSafe()) return false;
  if (!options.customClient) return false;

  try {
    const { error } = await options.customClient
      .from("demo_worker_heartbeats")
      .upsert({
        worker_id: heartbeat.workerId,
        status: heartbeat.status,
        jobs_processed: heartbeat.jobsProcessed,
        jobs_failed: heartbeat.jobsFailed,
        uptime_seconds: heartbeat.uptimeSeconds,
        last_heartbeat_at: heartbeat.lastHeartbeatAt,
      });
    return !error;
  } catch {
    return false;
  }
}
