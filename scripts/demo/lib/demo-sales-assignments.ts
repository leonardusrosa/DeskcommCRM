/**
 * scripts/demo/lib/demo-sales-assignments.ts
 *
 * Sales Assignment & Lead Distribution Engine (demo_sales_assignments).
 * Supports lead assignment, reassignment, ownership tracking, and round-robin distribution.
 * Strictly isolated: operates only in demo environment (.demo/demo_sales_assignments.json).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { assertDemoEnvironmentSafety } from "./guards";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export interface SalesRep {
  id: string;
  name: string;
  email: string;
  country?: string;
  active?: boolean;
}

export interface SalesAssignmentRecord {
  id: string;
  tenantId: string;
  leadId?: string;
  repId: string;
  repName: string;
  repEmail: string;
  status: "active" | "reassigned" | "unassigned";
  assignedAt: string;
  reassignedAt?: string;
  reassignmentReason?: string;
  previousRepEmail?: string;
}

export const DEFAULT_ASSIGNMENTS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_sales_assignments.json",
);

export function assignLeadToRep(
  tenantId: string,
  rep: SalesRep,
  options: {
    leadId?: string;
    customFilePath?: string;
    customEnv?: Record<string, string | undefined>;
  } = {},
): SalesAssignmentRecord {
  assertDemoEnvironmentSafety(options.customEnv);
  const targetFile = options.customFilePath ?? DEFAULT_ASSIGNMENTS_FILE;

  const all = listAssignments(undefined, targetFile);

  // Deactivate any existing active assignment for this tenant
  for (const a of all) {
    if (a.tenantId === tenantId && a.status === "active") {
      a.status = "reassigned";
      a.reassignedAt = new Date().toISOString();
      a.reassignmentReason = "New assignment created";
    }
  }

  const record: SalesAssignmentRecord = {
    id: crypto.randomUUID(),
    tenantId,
    leadId: options.leadId,
    repId: rep.id,
    repName: rep.name,
    repEmail: rep.email,
    status: "active",
    assignedAt: new Date().toISOString(),
  };

  all.push(record);
  saveAssignments(all, targetFile);

  return record;
}

export function reassignLead(
  tenantId: string,
  newRep: SalesRep,
  reason = "Workload rebalance",
  options: {
    customFilePath?: string;
    customEnv?: Record<string, string | undefined>;
  } = {},
): SalesAssignmentRecord {
  assertDemoEnvironmentSafety(options.customEnv);
  const targetFile = options.customFilePath ?? DEFAULT_ASSIGNMENTS_FILE;

  const all = listAssignments(undefined, targetFile);
  const currentActive = all.find((a) => a.tenantId === tenantId && a.status === "active");

  if (currentActive) {
    currentActive.status = "reassigned";
    currentActive.reassignedAt = new Date().toISOString();
    currentActive.reassignmentReason = reason;
  }

  const record: SalesAssignmentRecord = {
    id: crypto.randomUUID(),
    tenantId,
    leadId: currentActive?.leadId,
    repId: newRep.id,
    repName: newRep.name,
    repEmail: newRep.email,
    status: "active",
    assignedAt: new Date().toISOString(),
    previousRepEmail: currentActive?.repEmail,
  };

  all.push(record);
  saveAssignments(all, targetFile);

  return record;
}

export function distributeRoundRobin(
  tenantId: string,
  availableReps: SalesRep[],
  options: {
    leadId?: string;
    customFilePath?: string;
    customEnv?: Record<string, string | undefined>;
  } = {},
): SalesAssignmentRecord {
  assertDemoEnvironmentSafety(options.customEnv);
  const targetFile = options.customFilePath ?? DEFAULT_ASSIGNMENTS_FILE;

  if (availableReps.length === 0) {
    throw new Error("Cannot perform round-robin: no available sales reps provided.");
  }

  const all = listAssignments(undefined, targetFile);
  const activeList = all.filter((a) => a.status === "active");

  // Count active load per rep
  const repCounts: Record<string, number> = {};
  for (const rep of availableReps) {
    repCounts[rep.id] = 0;
  }
  for (const item of activeList) {
    if (repCounts[item.repId] !== undefined) {
      repCounts[item.repId] = (repCounts[item.repId] ?? 0) + 1;
    }
  }

  // Select rep with the lowest current active load
  let lowestRep = availableReps[0]!;
  let lowestCount = repCounts[lowestRep.id] ?? 0;

  for (const rep of availableReps) {
    const count = repCounts[rep.id] ?? 0;
    if (count < lowestCount) {
      lowestCount = count;
      lowestRep = rep;
    }
  }

  return assignLeadToRep(tenantId, lowestRep, {
    leadId: options.leadId,
    customFilePath: targetFile,
    customEnv: options.customEnv,
  });
}

export function getLeadAssignment(
  tenantId: string,
  customFilePath = DEFAULT_ASSIGNMENTS_FILE,
): SalesAssignmentRecord | null {
  const all = listAssignments(tenantId, customFilePath);
  return all.find((a) => a.status === "active") ?? null;
}

export function listAssignments(
  tenantId?: string,
  customFilePath = DEFAULT_ASSIGNMENTS_FILE,
): SalesAssignmentRecord[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as SalesAssignmentRecord[];
    return tenantId ? all.filter((a) => a.tenantId === tenantId) : all;
  } catch {
    return [];
  }
}

function saveAssignments(list: SalesAssignmentRecord[], targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
