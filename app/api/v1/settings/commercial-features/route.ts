import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  commercialFeaturesSchema,
  parseCommercialFeatures,
  settingsWithCommercialFeatures,
} from "@/lib/crm/commercial-features";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET is agent+ because Review Lite is consumed from the operator Inbox.
 * Nothing returned here is secret: OAuth tokens will live in a separate encrypted
 * Calendar connection when that runtime is implemented.
 */
export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "settings_commercial_features" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Organização não encontrada.", 404, { requestId });

  return ok(parseCommercialFeatures(data.settings), { requestId });
}

/** Admin-only because these defaults affect the whole organization's operation. */
export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "settings_commercial_features" });
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => null);
  const parsed = commercialFeaturesSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Configuração comercial inválida.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  // organizations has a platform-admin write policy; after trusted RBAC resolution,
  // service role performs the tenant-scoped write exactly like settings/routing.
  const supabase = createAdminClient();
  const { data: orgRow, error: readError } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (readError) return fail("internal_error", readError.message, 500, { requestId });
  if (!orgRow) return fail("not_found", "Organização não encontrada.", 404, { requestId });

  const nextSettings = settingsWithCommercialFeatures(orgRow.settings, parsed.data);
  const { data: updated, error: updateError } = await supabase
    .from("organizations")
    .update({ settings: nextSettings })
    .eq("id", authz.org.orgId)
    .select("id")
    .maybeSingle();

  if (updateError) return fail("internal_error", updateError.message, 500, { requestId });
  if (!updated) return fail("internal_error", "Nenhuma configuração foi gravada.", 500, { requestId });

  void audit({
    action: "org.updated",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "organization",
    resourceId: authz.org.orgId,
    requestId,
    metadata: {
      section: "commercial_features",
      google_review_enabled: parsed.data.google_review.enabled,
      google_review_url_configured: Boolean(parsed.data.google_review.review_url),
      copilot_mode: parsed.data.copilot.mode,
      booking_provider: parsed.data.booking.provider,
      booking_slot_duration_minutes: parsed.data.booking.slot_duration_minutes,
      // Deliberately no message body, URL query data, credentials or tokens in audit metadata.
    },
  });

  return ok(parsed.data, { requestId });
}
