/**
 * app/api/v1/admin/demo-center/integrations/route.ts
 *
 * API endpoint for Integrations Marketplace.
 */

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { listMarketplaceIntegrations, type IntegrationCategory } from "@/scripts/demo/integrations/marketplace";

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get("category") as IntegrationCategory) || undefined;
    const integrations = listMarketplaceIntegrations(category);

    return ok({
      integrations,
      total: integrations.length,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error listing integrations";
    return fail("internal_error", message, 500);
  }
}
