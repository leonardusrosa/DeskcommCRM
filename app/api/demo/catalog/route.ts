/**
 * app/api/demo/catalog/route.ts
 *
 * Public API for Demo Profiles Catalog.
 */

import { ok } from "@/lib/api/wrappers";
import { listDemoCatalogProfiles } from "@/scripts/demo/lib/demo-catalog";

export async function GET() {
  const profiles = listDemoCatalogProfiles();
  return ok({
    profiles,
    total: profiles.length,
  });
}
