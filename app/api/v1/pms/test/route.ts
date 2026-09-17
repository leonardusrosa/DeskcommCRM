import { randomUUID } from "node:crypto";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { pmsConnectionRepository } from "@/lib/integrations/pms/connection-repository";
import { newSoftProductionConnector } from "@/lib/integrations/pms/newsoft-connector";
import { createClient } from "@/lib/supabase/server";

export async function POST(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "pms" });
  if (!authz.ok) return authz.response;

  const { data, error } = await (await createClient())
    .from("pms_connections")
    .select("id")
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("pms_read_failed", error.message, 500, { requestId });
  if (!data) return fail("pms_not_configured", "No PMS connection configured.", 404, { requestId });

  try {
    const runtime = await pmsConnectionRepository.getRuntimeConnection(String(data.id));
    if (runtime.connection.provider !== "newsoft_ds") {
      return fail("pms_provider_pending", "Direct runtime is not enabled for this provider.", 409, {
        requestId,
      });
    }
    await newSoftProductionConnector.testConnection({
      tenantId: runtime.connection.tenantId,
      endpointUrl: runtime.connection.endpointUrl,
      clinicApiKey: runtime.clinicApiKey,
      appointmentWriteEnabled: runtime.connection.appointmentWriteEnabled,
    });
    return ok({ success: true }, { requestId });
  } catch (err: unknown) {
    return fail(
      "pms_connection_test_failed",
      err instanceof Error ? err.message : "PMS connection test failed.",
      502,
      { requestId }
    );
  }
}
