/**
 * scripts/demo/queue/demo-queue.ts
 *
 * Demo Automation Queue Implementation.
 * Features:
 *   - Idempotent deduplication via idempotencyKey
 *   - Exponential backoff retry logic
 *   - Dead-letter handling for persistent failures
 *   - Local JSON persistence (.demo/demo_queue.json)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "../lib/demo-session";
import type { DemoJob, EnqueueJobOptions, JobHandler, JobStatus } from "./types";

export const DEFAULT_QUEUE_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_queue.json",
);

export function enqueueDemoJob(
  jobType: string,
  payload: Record<string, unknown>,
  options: EnqueueJobOptions = {},
): DemoJob {
  const targetFile = options.customFilePath ?? DEFAULT_QUEUE_FILE;
  const all = listJobs(undefined, targetFile);

  // Idempotency check: if a job with same key exists and not dead_letter, return existing
  if (options.idempotencyKey) {
    const existing = all.find(
      (j) =>
        j.idempotencyKey === options.idempotencyKey &&
        j.status !== "dead_letter",
    );
    if (existing) return existing;
  }

  const now = new Date();
  const delaySec = options.delaySeconds ?? 0;
  const nextRunAt = new Date(now.getTime() + delaySec * 1000).toISOString();

  const job: DemoJob = {
    id: crypto.randomUUID(),
    jobType,
    payload,
    idempotencyKey: options.idempotencyKey,
    status: "pending",
    attempts: 0,
    maxRetries: options.maxRetries ?? 3,
    nextRunAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  all.push(job);
  saveJobs(all, targetFile);

  return job;
}

export async function processDemoJobs(
  handler: JobHandler,
  options: {
    batchSize?: number;
    customFilePath?: string;
    now?: Date;
  } = {},
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const targetFile = options.customFilePath ?? DEFAULT_QUEUE_FILE;
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const batchSize = options.batchSize ?? 10;

  const all = listJobs(undefined, targetFile);
  const eligible = all
    .filter(
      (j) =>
        (j.status === "pending" || j.status === "failed") &&
        j.nextRunAt <= nowIso,
    )
    .slice(0, batchSize);

  let succeeded = 0;
  let failed = 0;

  for (const job of eligible) {
    job.status = "processing";
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    saveJobs(all, targetFile);

    try {
      await handler(job);
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
      succeeded += 1;
    } catch (err) {
      failed += 1;
      job.lastError = err instanceof Error ? err.message : "Job execution failed";
      job.updatedAt = new Date().toISOString();

      if (job.attempts >= job.maxRetries) {
        job.status = "dead_letter";
      } else {
        job.status = "failed";
        // Exponential backoff: 2^attempts * 1000ms
        const backoffSeconds = Math.pow(2, job.attempts);
        job.nextRunAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
      }
    }

    saveJobs(all, targetFile);
  }

  return { processed: eligible.length, succeeded, failed };
}

export function retryFailedJob(
  jobId: string,
  customFilePath = DEFAULT_QUEUE_FILE,
): DemoJob | null {
  const all = listJobs(undefined, customFilePath);
  const match = all.find((j) => j.id === jobId);
  if (!match) return null;

  match.status = "pending";
  match.attempts = 0;
  match.nextRunAt = new Date().toISOString();
  match.updatedAt = new Date().toISOString();
  saveJobs(all, customFilePath);

  return match;
}

export function listJobs(
  statusFilter?: JobStatus,
  customFilePath = DEFAULT_QUEUE_FILE,
): DemoJob[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoJob[];
    return statusFilter ? all.filter((j) => j.status === statusFilter) : all;
  } catch {
    return [];
  }
}

export function getDeadLetterJobs(customFilePath = DEFAULT_QUEUE_FILE): DemoJob[] {
  return listJobs("dead_letter", customFilePath);
}

function saveJobs(list: DemoJob[], targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
