/**
 * app/api/v1/admin/demos/analytics/route.ts
 *
 * Analytics endpoint for Demo Revenue Operations Dashboard.
 * Returns aggregate KPIs: demos created, activation rate, meetings booked,
 * conversion rate, estimated MRR.
 */

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { listDemoLeads } from "@/scripts/demo/lib/demo-leads";
import { getDemoActivationRate } from "@/scripts/demo/lib/demo-activation";
import { getTrackedDemoEvents } from "@/scripts/demo/lib/demo-events";
import { estimateMRR } from "@/scripts/demo/lib/demo-deals";
import { getGlobalActivitySummary } from "@/scripts/demo/lib/demo-activity";

export interface DemoAnalyticsPayload {
  demosCreated: number;
  activatedCount: number;
  activationRatePercentage: number;
  meetingsBooked: number;
  proposalsSent: number;
  convertedCount: number;
  lostCount: number;
  conversionRatePercentage: number;
  estimatedMRR: {
    BRL: number;
    COP: number;
    MXN: number;
    EUR: number;
    USD: number;
  };
  activitySummary: {
    total: number;
    byCategory: Record<string, number>;
  };
  byCountry: Record<string, number>;
  byVertical: Record<string, number>;
}

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const leads = listDemoLeads();
    const tenantIds = leads.map((l) => l.demo_tenant_id).filter(Boolean) as string[];

    const metrics = getDemoActivationRate({ tenantIds });
    const events = getTrackedDemoEvents();
    const mrr = estimateMRR();
    const activity = getGlobalActivitySummary();

    const meetingsBooked = leads.filter((l) => l.status === "meeting_booked").length
      + events.filter((e) => (e.event_name as string) === "meeting_booked").length;

    const proposalsSent = leads.filter((l) => l.status === "proposal_sent").length;
    const convertedCount = leads.filter((l) => l.status === "converted").length;
    const lostCount = leads.filter((l) => l.status === "lost").length;
    const conversionRatePercentage =
      leads.length > 0 ? Math.round((convertedCount / leads.length) * 100) : 0;

    // Breakdown by country & vertical
    const byCountry: Record<string, number> = {};
    const byVertical: Record<string, number> = {};
    for (const lead of leads) {
      if (lead.country) byCountry[lead.country] = (byCountry[lead.country] ?? 0) + 1;
      if (lead.vertical) byVertical[lead.vertical] = (byVertical[lead.vertical] ?? 0) + 1;
    }

    const payload: DemoAnalyticsPayload = {
      demosCreated: leads.length,
      activatedCount: metrics.activatedDemos,
      activationRatePercentage: metrics.activationRatePercentage,
      meetingsBooked,
      proposalsSent,
      convertedCount,
      lostCount,
      conversionRatePercentage,
      estimatedMRR: mrr,
      activitySummary: {
        total: activity.total,
        byCategory: activity.byCategory as unknown as Record<string, number>,
      },
      byCountry,
      byVertical,
    };

    return ok(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analytics error";
    return fail("analytics_error", message, 500);
  }
}
