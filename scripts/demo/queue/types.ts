/**
 * scripts/demo/queue/types.ts
 *
 * Types for Demo Automation Queue.
 * Supports retries, exponential backoff, dead-letter storage, and idempotency.
 */

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "dead_letter";

export interface DemoJob {
  id: string;
  jobType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  status: JobStatus;
  attempts: number;
  maxRetries: number;
  nextRunAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface EnqueueJobOptions {
  idempotencyKey?: string;
  maxRetries?: number;
  delaySeconds?: number;
  customFilePath?: string;
}

export type JobHandler = (job: DemoJob) => Promise<void>;
