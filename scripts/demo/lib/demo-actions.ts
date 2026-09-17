/**
 * scripts/demo/lib/demo-actions.ts
 *
 * Demo Actions Engine — sales task queue for verified demo tenants.
 * Calculates next action, priority, and SLA per demo.
 * Never affects production tenants.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDemoEnvironmentSafety } from "./guards";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { getDemoScore, getCommercialSignals } from "./demo-score";
import { getSuggestedNextAction } from "./demo-activation";
import type { DemoLeadStatus } from "./demo-leads";

export type DemoActionPriority = "low" | "medium" | "high" | "urgent";
export type DemoActionStatus = "pending" | "in_progress" | "completed" | "snoozed";

export interface DemoAction {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  priority: DemoActionPriority;
  status: DemoActionStatus;
  slaDueAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface DemoActionContext {
  tenantId: string;
  leadStatus: DemoLeadStatus;
  score: number;
  isActivated: boolean;
  expiresAt?: string;
  lastActivity?: string;
  customAdmin?: SupabaseClient;
  customEnv?: Record<string, string | undefined>;
}

export const DEFAULT_ACTIONS_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_actions.json");

const PRIORITY_SLA_HOURS: Record<DemoActionPriority, number> = {
  urgent: 2,
  high: 8,
  medium: 24,
  low: 72,
};

/**
 * Computes and persists the next recommended sales action for a demo tenant.
 * Always validates demo environment safety before executing.
 */
export async function computeDemoAction(
  ctx: DemoActionContext,
  customFilePath = DEFAULT_ACTIONS_FILE,
): Promise<DemoAction> {
  assertDemoEnvironmentSafety(ctx.customEnv);

  const events = ctx.customAdmin ? undefined : undefined;
  const scoreResult = getDemoScore(ctx.tenantId, events);
  const signals = getCommercialSignals(ctx.tenantId, {
    lastActivity: ctx.lastActivity,
    expiresAt: ctx.expiresAt,
  });

  const isExpiring = signals.some((s) => s.signal === "demo_expiring");
  const isInactive = signals.some((s) => s.signal === "demo_inactive");

  const priority = resolveActionPriority(scoreResult.score, ctx.leadStatus, isExpiring);
  const title = getSuggestedNextAction(ctx.tenantId, {
    status: ctx.leadStatus,
    score: scoreResult.score,
    isActivated: ctx.isActivated,
    isExpiring,
    isInactive,
  });

  const slaHours = PRIORITY_SLA_HOURS[priority];
  const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

  const action: DemoAction = {
    id: crypto.randomUUID(),
    tenantId: ctx.tenantId,
    title,
    description: buildActionDescription(ctx.leadStatus, scoreResult.score, ctx.isActivated),
    priority,
    status: "pending",
    slaDueAt,
    createdAt: new Date().toISOString(),
  };

  persistAction(action, customFilePath);
  return action;
}

export function listDemoActions(
  tenantId?: string,
  status?: DemoActionStatus,
  customFilePath = DEFAULT_ACTIONS_FILE,
): DemoAction[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoAction[];
    return all.filter((a) => {
      if (tenantId && a.tenantId !== tenantId) return false;
      if (status && a.status !== status) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export function completeDemoAction(
  actionId: string,
  customFilePath = DEFAULT_ACTIONS_FILE,
): DemoAction | null {
  if (!fs.existsSync(customFilePath)) return null;
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoAction[];
    const match = all.find((a) => a.id === actionId);
    if (!match) return null;
    match.status = "completed";
    match.completedAt = new Date().toISOString();
    fs.writeFileSync(customFilePath, JSON.stringify(all, null, 2), "utf-8");
    return match;
  } catch {
    return null;
  }
}

function resolveActionPriority(
  score: number,
  status: DemoLeadStatus,
  isExpiring: boolean,
): DemoActionPriority {
  if (status === "converted") return "low";
  if (score >= 70 || isExpiring) return "urgent";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function buildActionDescription(
  status: DemoLeadStatus,
  score: number,
  activated: boolean,
): string {
  if (status === "meeting_booked") return "Prepare meeting agenda and clínica diagnosis template.";
  if (score >= 70) return `High-intent lead (score ${score}). Strike while hot — call or send proposal.`;
  if (!activated) return "Demo not activated. Send WhatsApp video showing WhatsApp + Agenda integration.";
  return `Demo activated (score ${score}). Invite for live guided demonstration call.`;
}

function persistAction(action: DemoAction, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let list: DemoAction[] = [];
  if (fs.existsSync(targetFile)) {
    try { list = JSON.parse(fs.readFileSync(targetFile, "utf-8")); } catch { list = []; }
  }
  list.push(action);
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}

export function calculateNextAction(tenantId: string): {
  title: string;
  priority: DemoActionPriority;
  slaHours: number;
} {
  const actions = listDemoActions(tenantId, "pending");
  if (actions.length > 0) {
    const a = actions[0]!;
    return {
      title: a.title,
      priority: a.priority,
      slaHours: PRIORITY_SLA_HOURS[a.priority],
    };
  }
  const scoreResult = getDemoScore(tenantId);
  const priority: DemoActionPriority = scoreResult.score >= 70 ? "urgent" : scoreResult.score >= 40 ? "high" : "medium";
  const title = getSuggestedNextAction(tenantId, {
    status: "activated",
    score: scoreResult.score,
    isActivated: true,
  });
  return {
    title,
    priority,
    slaHours: PRIORITY_SLA_HOURS[priority],
  };
}
