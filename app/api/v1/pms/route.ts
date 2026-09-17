import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { NEWSOFT_CAPABILITIES } from "@/lib/integrations/pms/capabilities";
import { pmsConnectionRepository } from "@/lib/integrations/pms/connection-repository";
import type { PmsConnection } from "@/lib/integrations/pms/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PROVIDER = "newsoft_ds" as const;
const SAFE_COLUMNS =
  "id,organization_id,provider,status,health,sync_enabled,appointment_write_enabled,endpoint_url,last4,capabilities,last_sync_at,last_success_at,last_error_code,created_at,updated_at";

function toConnection(row: Record<string, unknown>): PmsConnection {
  return {
    id: String(row.id),
    tenantId: String(row.organization_id),
    provider: row.provider as PmsConnection["provider"],
    status: row.status as PmsConnection["status"],
    health: row.health as PmsConnection["health"],
    syncEnabled: Boolean(row.sync_enabled),
    appointmentWriteEnabled: Boolean(row.appointment_write_enabled),
    endpointUrl: String(row.endpoint_url),
    encryptedSecretRef: `db:pms_connection_secrets:${String(row.id)}`,
    last4: String(row.last4 || "0000"),
    capabilities: row.capabilities as PmsConnection["capabilities"],
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : undefined,
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : undefined,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "pms" });
  if (!authz.ok) return authz.response;

  const { data, error } = await (await createClient())
    .from("pms_connections")
    .select(SAFE_COLUMNS)
    .eq("organization_id", authz.org.orgId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (error) return fail("pms_read_failed", error.message, 500, { requestId });
  return ok(data ? toConnection(data) : null, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "pms" });
  if (!authz.ok) return authz.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const endpointUrl = String(body?.endpointUrl || "").trim();
  const clinicApiKey = String(body?.clinicApiKey || "").trim();
  if (!endpointUrl || !clinicApiKey) {
    return fail("validation_failed", "endpointUrl and clinicApiKey are required.", 422, { requestId });
  }

  try {
    const connection = await pmsConnectionRepository.upsert({
      organizationId: authz.org.orgId,
      provider: PROVIDER,
      endpointUrl,
      clinicApiKey,
      capabilities: NEWSOFT_CAPABILITIES,
      syncEnabled: true,
      appointmentWriteEnabled: false,
    });
    return ok(connection, { status: 201, requestId });
  } catch (error: unknown) {
    return fail(
      "pms_save_failed",
      error instanceof Error ? error.message : "Unable to save PMS connection.",
      500,
      { requestId }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "pms" });
  if (!authz.ok) return authz.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.syncEnabled !== "boolean") {
    return fail("validation_failed", "syncEnabled boolean is required.", 422, { requestId });
  }

  const health = body.syncEnabled ? "HEALTHY" : "DISABLED";
  const { data, error } = await (await createClient())
    .from("pms_connections")
    .update({ sync_enabled: body.syncEnabled, health })
    .eq("organization_id", authz.org.orgId)
    .eq("provider", PROVIDER)
    .select(SAFE_COLUMNS)
    .single();
  if (error) return fail("pms_update_failed", error.message, 500, { requestId });
  return ok(toConnection(data), { requestId });
}
