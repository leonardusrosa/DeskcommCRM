/**
 * scripts/demo/lib/demo-activity.ts
 *
 * Activity Timeline (demo_activity_events) — unified event stream for:
 *   - User actions (login, inbox_viewed, etc.)
 *   - Commercial actions (follow-up sent, meeting booked)
 *   - Score changes (promotion/demotion)
 *   - Meeting events
 *   - Conversion events
 *
 * Persisted locally in .demo/demo_activity.json.
 * Never affects production tenant data.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type ActivityCategory =
  | "user_action"
  | "commercial_action"
  | "score_change"
  | "meeting"
  | "conversion";

export interface ActivityEvent {
  id: string;
  tenantId: string;
  category: ActivityCategory;
  eventName: string;
  description: string;
  metadata?: Record<string, unknown>;
  score?: number;
  scoreDelta?: number;
  occurredAt: string;
}

export const DEFAULT_ACTIVITY_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_activity.json");

export function trackActivity(
  tenantId: string,
  category: ActivityCategory,
  eventName: string,
  description: string,
  meta?: {
    metadata?: Record<string, unknown>;
    score?: number;
    scoreDelta?: number;
    customFilePath?: string;
  },
): ActivityEvent {
  const event: ActivityEvent = {
    id: crypto.randomUUID(),
    tenantId,
    category,
    eventName,
    description,
    metadata: meta?.metadata,
    score: meta?.score,
    scoreDelta: meta?.scoreDelta,
    occurredAt: new Date().toISOString(),
  };

  persist(event, meta?.customFilePath ?? DEFAULT_ACTIVITY_FILE);
  return event;
}

export function getActivityTimeline(
  tenantId: string,
  options: {
    category?: ActivityCategory;
    limit?: number;
    customFilePath?: string;
  } = {},
): ActivityEvent[] {
  const file = options.customFilePath ?? DEFAULT_ACTIVITY_FILE;
  if (!fs.existsSync(file)) return [];

  try {
    const all = JSON.parse(fs.readFileSync(file, "utf-8")) as ActivityEvent[];
    let filtered = all.filter((e) => e.tenantId === tenantId);
    if (options.category) filtered = filtered.filter((e) => e.category === options.category);
    filtered.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return options.limit ? filtered.slice(0, options.limit) : filtered;
  } catch {
    return [];
  }
}

export function getGlobalActivitySummary(customFilePath = DEFAULT_ACTIVITY_FILE): {
  total: number;
  byCategory: Record<ActivityCategory, number>;
  recentEvents: ActivityEvent[];
} {
  const byCategory: Record<ActivityCategory, number> = {
    user_action: 0,
    commercial_action: 0,
    score_change: 0,
    meeting: 0,
    conversion: 0,
  };

  if (!fs.existsSync(customFilePath)) {
    return { total: 0, byCategory, recentEvents: [] };
  }

  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as ActivityEvent[];
    for (const ev of all) {
      byCategory[ev.category] = (byCategory[ev.category] ?? 0) + 1;
    }
    const recentEvents = [...all]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 20);
    return { total: all.length, byCategory, recentEvents };
  } catch {
    return { total: 0, byCategory, recentEvents: [] };
  }
}

function persist(event: ActivityEvent, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let list: ActivityEvent[] = [];
  if (fs.existsSync(targetFile)) {
    try { list = JSON.parse(fs.readFileSync(targetFile, "utf-8")); } catch { list = []; }
  }
  list.push(event);
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
