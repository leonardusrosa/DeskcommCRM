/**
 * scripts/demo/lib/demo-sla.ts
 *
 * Demo SLA Engine & Commercial Timers.
 * Tracks commercial SLAs, calculates approaching breach warnings, detects breaches,
 * and orchestrates escalation events.
 * Strictly isolated: operates only in demo environment (.demo/demo_sla.json).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { assertDemoEnvironmentSafety } from "./guards";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type SLAStatus = "on_track" | "warning" | "breached" | "completed";

export interface SLATimerRecord {
  id: string;
  tenantId: string;
  actionType: string;
  dueAt: string;
  warningAt: string;
  status: SLAStatus;
  completedAt?: string;
  breachedAt?: string;
  escalatedAt?: string;
  escalatedTo?: string;
  createdAt: string;
}

export const DEFAULT_SLA_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_sla.json");

export function createSLATimer(
  tenantId: string,
  actionType: string,
  durationHours: number,
  options: {
    warningWindowMinutes?: number;
    customFilePath?: string;
    customEnv?: Record<string, string | undefined>;
  } = {},
): SLATimerRecord {
  assertDemoEnvironmentSafety(options.customEnv);
  const targetFile = options.customFilePath ?? DEFAULT_SLA_FILE;

  const now = new Date();
  const dueAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();
  const warningMinutes = options.warningWindowMinutes ?? Math.max(15, Math.round(durationHours * 60 * 0.25));
  const warningAt = new Date(new Date(dueAt).getTime() - warningMinutes * 60 * 1000).toISOString();

  const record: SLATimerRecord = {
    id: crypto.randomUUID(),
    tenantId,
    actionType,
    dueAt,
    warningAt,
    status: "on_track",
    createdAt: now.toISOString(),
  };

  const all = listSLATimers(undefined, targetFile);
  all.push(record);
  saveSLATimers(all, targetFile);

  return record;
}

export function evaluateSLATimer(timer: SLATimerRecord, now: Date = new Date()): SLATimerRecord {
  if (timer.status === "completed") return timer;

  const nowMs = now.getTime();
  const dueMs = new Date(timer.dueAt).getTime();
  const warningMs = new Date(timer.warningAt).getTime();

  if (nowMs > dueMs) {
    timer.status = "breached";
    if (!timer.breachedAt) timer.breachedAt = now.toISOString();
  } else if (nowMs >= warningMs) {
    timer.status = "warning";
  } else {
    timer.status = "on_track";
  }

  return timer;
}

export function completeSLATimer(
  timerId: string,
  customFilePath = DEFAULT_SLA_FILE,
): SLATimerRecord | null {
  const all = listSLATimers(undefined, customFilePath);
  const match = all.find((t) => t.id === timerId);
  if (!match) return null;

  match.status = "completed";
  match.completedAt = new Date().toISOString();
  saveSLATimers(all, customFilePath);

  return match;
}

export function checkAndEscalateSLAs(options: {
  customFilePath?: string;
  escalationEmail?: string;
  now?: Date;
  customEnv?: Record<string, string | undefined>;
} = {}): {
  checkedCount: number;
  breachesCount: number;
  warningsCount: number;
  escalatedTimers: SLATimerRecord[];
} {
  assertDemoEnvironmentSafety(options.customEnv);
  const targetFile = options.customFilePath ?? DEFAULT_SLA_FILE;
  const now = options.now ?? new Date();

  const all = listSLATimers(undefined, targetFile);
  let breachesCount = 0;
  let warningsCount = 0;
  const escalatedTimers: SLATimerRecord[] = [];

  for (const timer of all) {
    if (timer.status === "completed") continue;
    evaluateSLATimer(timer, now);

    if (timer.status === "breached") {
      breachesCount += 1;
      // Trigger escalation if not already escalated
      if (!timer.escalatedAt) {
        timer.escalatedAt = now.toISOString();
        timer.escalatedTo = options.escalationEmail || "head_of_sales@deskcomm.io";
        escalatedTimers.push(timer);
      }
    } else if (timer.status === "warning") {
      warningsCount += 1;
    }
  }

  saveSLATimers(all, targetFile);

  return {
    checkedCount: all.length,
    breachesCount,
    warningsCount,
    escalatedTimers,
  };
}

export function listSLATimers(
  filters?: { tenantId?: string; status?: SLAStatus },
  customFilePath = DEFAULT_SLA_FILE,
): SLATimerRecord[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as SLATimerRecord[];
    return all.filter((t) => {
      if (filters?.tenantId && t.tenantId !== filters.tenantId) return false;
      if (filters?.status && t.status !== filters.status) return false;
      return true;
    });
  } catch {
    return [];
  }
}

function saveSLATimers(list: SLATimerRecord[], targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
