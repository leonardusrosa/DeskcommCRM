import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const EVENT_TYPES = {
  initial_sync: "pms.initial_sync_requested",
  incremental_sync: "pms.incremental_sync_requested",
  reconcile: "pms.reconcile_requested",
} as const;

type JobType = keyof typeof EVENT_TYPES;

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "pms" });
  if (!authz.ok) return authz.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const jobType = String(body.jobType || "incremental_sync") as JobType;
  if (!(jobType in EVENT_TYPES)) {
    return fail("validation_failed", "Invalid PMS sync jobType.", 422, { requestId });
  }

  const supabase = await createClient();
  const { data: connection, error: connectionError } = await supabase
    .from("pms_connections")
    .select("id,sync_enabled")
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (connectionError) {
    return fail("pms_read_failed", connectionError.message, 500, { requestId });
  }
  if (!connection) return fail("pms_not_configured", "No PMS connection configured.", 404, { requestId });
  if (!connection.sync_enabled) {
    return fail("pms_sync_disabled", "PMS synchronization is disabled.", 409, { requestId });
  }

  const { data: eventId, error } = await supabase.rpc("emit_event", {
    p_event_type: EVENT_TYPES[jobType],
    p_entity_kind: "pms_connection",
    p_entity_id: connection.id,
    p_payload: { connectionId: connection.id, jobType },
    p_metadata: { source: "pms_admin_api", request_id: requestId },
    p_organization_id: authz.org.orgId,
  });
  if (error) return fail("pms_enqueue_failed", error.message, 500, { requestId });

  return ok({ queued: true, eventId, jobType }, { status: 202, requestId });
}
