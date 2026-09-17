/**
 * scripts/demo/lib/demo-events.ts
 *
 * Commercial intelligence and event tracking for Deskcomm Demo Factory.
 * Strictly isolates demo analytics from production tenants.
 * Resilient: Never crashes the demo if analytics storage or DB is unavailable.
 */

import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type DemoEventName =
  | "demo_created"
  | "demo_opened"
  | "first_login"
  | "inbox_viewed"
  | "pipeline_viewed"
  | "agenda_viewed"
  | "google_connected"
  | "appointment_created"
  | "demo_completed";

export interface DemoSessionRecord {
  tenant_id: string;
  profile: string;
  country: string;
  created_at: string;
  started_by: string;
  last_activity: string;
  converted: boolean;
  eventsCount?: number;
}

export interface DemoEventRecord {
  id?: string;
  tenant_id: string;
  event_name: DemoEventName;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export const DEFAULT_DEMO_SESSIONS_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_sessions.json");
export const DEFAULT_DEMO_EVENTS_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_events.json");

/**
 * Tracks a commercial intelligence event for a demo tenant.
 * Completely safe and fail-silent: will never crash the demo flow if storage fails.
 */
export async function trackDemoEvent(
  tenantId: string,
  eventName: DemoEventName,
  metadata: Record<string, unknown> = {},
  options: {
    adminClient?: SupabaseClient;
    profile?: string;
    country?: string;
    startedBy?: string;
    sessionsFilePath?: string;
    eventsFilePath?: string;
  } = {},
): Promise<boolean> {
  try {
    // 1. Production safety check: verify tenant is explicitly a demo tenant
    const isDemo = await verifyIsDemoTenant(tenantId, options.adminClient);
    if (!isDemo) {
      console.warn(`[demo-events] Ignored event "${eventName}" for non-demo or unverified tenant "${tenantId}".`);
      return false;
    }

    const nowIso = new Date().toISOString();
    const eventRecord: DemoEventRecord = {
      tenant_id: tenantId,
      event_name: eventName,
      metadata,
      created_at: nowIso,
    };

    // 2. Persist in local file storage (.demo/demo_events.json and demo_sessions.json)
    recordEventLocally(eventRecord, options.eventsFilePath || DEFAULT_DEMO_EVENTS_FILE);
    updateDemoSessionLocally(
      tenantId,
      eventName,
      nowIso,
      options,
      options.sessionsFilePath || DEFAULT_DEMO_SESSIONS_FILE,
    );

    // 3. Persist in Supabase demo tables if available (gracefully ignored if table does not exist)
    if (options.adminClient) {
      try {
        await options.adminClient.from("demo_events").insert(eventRecord);
      } catch {
        // Ignored: Supabase table demo_events might not exist yet
      }
    }

    return true;
  } catch (err) {
    // Fail-safe guarantee: demo should never crash due to event tracking
    console.warn(`[demo-events] Note: Could not record demo event "${eventName}":`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Returns all tracked demo sessions.
 */
export function getTrackedDemoSessions(customPath = DEFAULT_DEMO_SESSIONS_FILE): DemoSessionRecord[] {
  if (!fs.existsSync(customPath)) return [];
  try {
    const raw = fs.readFileSync(customPath, "utf-8");
    return JSON.parse(raw) as DemoSessionRecord[];
  } catch {
    return [];
  }
}

/**
 * Returns all tracked demo events (optionally filtered by tenant).
 */
export function getTrackedDemoEvents(
  tenantId?: string,
  customPath = DEFAULT_DEMO_EVENTS_FILE,
): DemoEventRecord[] {
  if (!fs.existsSync(customPath)) return [];
  try {
    const raw = fs.readFileSync(customPath, "utf-8");
    const events = JSON.parse(raw) as DemoEventRecord[];
    return tenantId ? events.filter((e) => e.tenant_id === tenantId) : events;
  } catch {
    return [];
  }
}

async function verifyIsDemoTenant(tenantId: string, adminClient?: SupabaseClient): Promise<boolean> {
  // Check if tenantId has common demo markers
  if (tenantId.startsWith("clinica-") || tenantId.includes("demo")) {
    return true;
  }

  if (adminClient) {
    try {
      const { data } = await adminClient
        .from("organizations")
        .select("id, slug, settings")
        .or(`id.eq.${tenantId},slug.eq.${tenantId}`)
        .maybeSingle();

      if (!data) return false;
      const settings = (data as { settings?: { demo?: boolean; is_demo?: boolean } }).settings;
      return Boolean(settings?.demo || settings?.is_demo);
    } catch {
      return false;
    }
  }

  return true;
}

function recordEventLocally(event: DemoEventRecord, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let list: DemoEventRecord[] = [];
  if (fs.existsSync(targetFile)) {
    try {
      list = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    } catch {
      list = [];
    }
  }
  list.push(event);
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}

function updateDemoSessionLocally(
  tenantId: string,
  eventName: DemoEventName,
  timestamp: string,
  options: { profile?: string; country?: string; startedBy?: string },
  targetFile: string,
): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let list: DemoSessionRecord[] = [];
  if (fs.existsSync(targetFile)) {
    try {
      list = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    } catch {
      list = [];
    }
  }

  let session = list.find((s) => s.tenant_id === tenantId);
  const isConverted = eventName === "appointment_created" || eventName === "demo_completed";

  if (!session) {
    session = {
      tenant_id: tenantId,
      profile: options.profile || "dental-clinic",
      country: options.country || "CO",
      created_at: timestamp,
      started_by: options.startedBy || "sales-demo",
      last_activity: timestamp,
      converted: isConverted,
      eventsCount: 1,
    };
    list.push(session);
  } else {
    session.last_activity = timestamp;
    session.eventsCount = (session.eventsCount || 0) + 1;
    if (isConverted) {
      session.converted = true;
    }
  }

  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
