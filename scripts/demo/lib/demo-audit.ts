/**
 * scripts/demo/lib/demo-audit.ts
 *
 * Demo Platform Audit Layer (demo_audit_events).
 * Tracks ownership changes, status changes, data exports, and commercial actions.
 * Strictly isolated in local storage (.demo/demo_audit_events.json).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type DemoAuditActionType =
  | "ownership_change"
  | "status_change"
  | "export"
  | "commercial_action"
  | "compliance_purge"
  | "compliance_anonymize"
  | "compliance_gdpr_delete";

export interface DemoAuditEvent {
  id: string;
  tenantId: string;
  actionType: DemoAuditActionType;
  actorEmail: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface RecordAuditInput {
  tenantId: string;
  actionType: DemoAuditActionType;
  actorEmail?: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_AUDIT_EVENTS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_audit_events.json",
);

export function recordDemoAudit(
  input: RecordAuditInput,
  customFilePath = DEFAULT_AUDIT_EVENTS_FILE,
): DemoAuditEvent {
  const event: DemoAuditEvent = {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    actionType: input.actionType,
    actorEmail: input.actorEmail || "system@deskcomm.demo",
    description: input.description,
    before: input.before,
    after: input.after,
    metadata: input.metadata,
    timestamp: new Date().toISOString(),
  };

  persistAuditEvent(event, customFilePath);
  return event;
}

export function listDemoAuditEvents(
  filters?: {
    tenantId?: string;
    actionType?: DemoAuditActionType;
  },
  customFilePath = DEFAULT_AUDIT_EVENTS_FILE,
): DemoAuditEvent[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoAuditEvent[];
    let filtered = all;
    if (filters?.tenantId) {
      filtered = filtered.filter((e) => e.tenantId === filters.tenantId);
    }
    if (filters?.actionType) {
      filtered = filtered.filter((e) => e.actionType === filters.actionType);
    }
    return filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

export function getDemoAuditSummary(customFilePath = DEFAULT_AUDIT_EVENTS_FILE): {
  total: number;
  byActionType: Record<DemoAuditActionType, number>;
} {
  const byActionType: Record<DemoAuditActionType, number> = {
    ownership_change: 0,
    status_change: 0,
    export: 0,
    commercial_action: 0,
    compliance_purge: 0,
    compliance_anonymize: 0,
    compliance_gdpr_delete: 0,
  };

  const all = listDemoAuditEvents(undefined, customFilePath);
  for (const e of all) {
    if (byActionType[e.actionType] !== undefined) {
      byActionType[e.actionType] += 1;
    }
  }

  return { total: all.length, byActionType };
}

function persistAuditEvent(event: DemoAuditEvent, targetFile: string): void {
  try {
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let list: DemoAuditEvent[] = [];
    if (fs.existsSync(targetFile)) {
      try {
        list = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
      } catch {
        list = [];
      }
    }
    list.push(event);
    fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
  } catch {
    // Fail silent: audit write failure must never crash execution
  }
}
