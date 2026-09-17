/**
 * scripts/demo/lib/demo-conversion-events.ts
 *
 * Commercial Conversion Events Tracker for Deskcomm Demo Tenants.
 * Tracks late-funnel conversion milestones:
 *   - meeting_booked
 *   - proposal_sent
 *   - converted
 *   - subscription_started
 *
 * Completely isolated from customer CRM data.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { updateDemoLeadStatus, type DemoLeadStatus } from "./demo-leads";

export type DemoConversionEventName =
  | "meeting_booked"
  | "proposal_sent"
  | "converted"
  | "subscription_started";

export interface DemoConversionEventRecord {
  id: string;
  tenant_id: string;
  event_name: DemoConversionEventName;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export const DEFAULT_CONVERSION_EVENTS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_conversion_events.json",
);

/**
 * Maps a conversion event name to its corresponding commercial pipeline stage.
 */
function mapEventToStatus(eventName: DemoConversionEventName): DemoLeadStatus {
  switch (eventName) {
    case "meeting_booked":
      return "meeting_booked";
    case "proposal_sent":
      return "proposal_sent";
    case "converted":
    case "subscription_started":
      return "converted";
    default:
      return "engaged";
  }
}

/**
 * Records a commercial conversion event for a demo tenant.
 */
export async function trackConversionEvent(
  tenantId: string,
  eventName: DemoConversionEventName,
  metadata: Record<string, unknown> = {},
  options: {
    adminClient?: SupabaseClient;
    filePath?: string;
    leadsFilePath?: string;
  } = {},
): Promise<DemoConversionEventRecord> {
  const now = new Date().toISOString();
  const record: DemoConversionEventRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : `cnv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tenant_id: tenantId,
    event_name: eventName,
    metadata,
    created_at: now,
  };

  // 1. Save locally
  saveConversionEventLocally(record, options.filePath || DEFAULT_CONVERSION_EVENTS_FILE);

  // 2. Advance pipeline state in demo_leads
  const newStatus = mapEventToStatus(eventName);
  updateDemoLeadStatus(tenantId, newStatus, options.leadsFilePath);

  // 3. Sync to Supabase if available
  if (options.adminClient) {
    try {
      await options.adminClient.from("demo_conversion_events").insert(record);
    } catch {
      // Gracefully ignored: table might not exist in local schema
    }
  }

  return record;
}

/**
 * Lists conversion events, optionally filtered by tenantId.
 */
export function listConversionEvents(
  tenantId?: string,
  filePath = DEFAULT_CONVERSION_EVENTS_FILE,
): DemoConversionEventRecord[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const all = JSON.parse(raw) as DemoConversionEventRecord[];
    return tenantId ? all.filter((e) => e.tenant_id === tenantId) : all;
  } catch {
    return [];
  }
}

export const listDemoConversionEvents = listConversionEvents;

function saveConversionEventLocally(
  record: DemoConversionEventRecord,
  targetFile: string,
): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let list: DemoConversionEventRecord[] = [];
  if (fs.existsSync(targetFile)) {
    try {
      list = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    } catch {
      list = [];
    }
  }

  list.push(record);
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
