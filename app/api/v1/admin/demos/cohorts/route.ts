/**
 * app/api/v1/admin/demos/cohorts/route.ts
 *
 * Platform Admin API for Demo Cohort Analytics.
 * Segments demos by country, vertical, or creation month.
 */

import { type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import {
  computeDemoCohorts,
  type CohortDimension,
} from "@/scripts/demo/lib/demo-cohorts";

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const dimParam = searchParams.get("dimension");
    const validDimensions: CohortDimension[] = ["country", "vertical", "month"];
    const dimension: CohortDimension =
      dimParam && validDimensions.includes(dimParam as CohortDimension)
        ? (dimParam as CohortDimension)
        : "month";

    const report = computeDemoCohorts({ dimension });
    return ok(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cohorts query error";
    return fail("cohorts_error", message, 500);
  }
}
