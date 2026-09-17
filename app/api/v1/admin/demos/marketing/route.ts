/**
 * app/api/v1/admin/demos/marketing/route.ts
 *
 * API endpoint for Demo Marketing Analytics Dashboard.
 * Returns performance breakdowns by traffic source, campaign, conversion rates,
 * revenue attribution, and active A/B experiments.
 */

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import {
  getAttributionSummary,
  listDemoAttributions,
} from "@/scripts/demo/lib/demo-attribution";
import { listDemoLeads } from "@/scripts/demo/lib/demo-leads";
import { listExperiments, getExperimentResults } from "@/scripts/demo/lib/demo-experiments";

export interface MarketingDashboardPayload {
  summary: {
    totalAttributedDemos: number;
    totalRevenue: Record<string, number>;
    topSource: string;
    topCampaign: string;
  };
  sources: Array<{
    source: string;
    demosCount: number;
    convertedCount: number;
    conversionRate: number;
    revenue: number;
  }>;
  campaigns: Array<{
    campaign: string;
    demosCount: number;
    convertedCount: number;
    conversionRate: number;
    revenue: number;
  }>;
  experiments: Array<NonNullable<ReturnType<typeof getExperimentResults>>>;
  retrievedAt: string;
}

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const attributions = listDemoAttributions();
    const summary = getAttributionSummary();
    const leads = listDemoLeads();

    // Map tenantId to lead status
    const tenantStatusMap = new Map<string, string>();
    for (const lead of leads) {
      if (lead.demo_tenant_id) {
        tenantStatusMap.set(lead.demo_tenant_id, lead.status);
      }
    }

    // Aggregate by Source
    const sourceMap = new Map<
      string,
      { demosCount: number; convertedCount: number; revenue: number }
    >();
    for (const a of attributions) {
      const s = a.source || "direct";
      if (!sourceMap.has(s)) {
        sourceMap.set(s, { demosCount: 0, convertedCount: 0, revenue: 0 });
      }
      const entry = sourceMap.get(s)!;
      entry.demosCount += 1;
      entry.revenue += a.revenue;
      if (tenantStatusMap.get(a.tenantId) === "converted") {
        entry.convertedCount += 1;
      }
    }

    const sources = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      demosCount: data.demosCount,
      convertedCount: data.convertedCount,
      conversionRate:
        data.demosCount > 0 ? Math.round((data.convertedCount / data.demosCount) * 100) : 0,
      revenue: data.revenue,
    }));
    sources.sort((a, b) => b.demosCount - a.demosCount);

    // Aggregate by Campaign
    const campaignMap = new Map<
      string,
      { demosCount: number; convertedCount: number; revenue: number }
    >();
    for (const a of attributions) {
      const c = a.campaign || "direct_or_unknown";
      if (!campaignMap.has(c)) {
        campaignMap.set(c, { demosCount: 0, convertedCount: 0, revenue: 0 });
      }
      const entry = campaignMap.get(c)!;
      entry.demosCount += 1;
      entry.revenue += a.revenue;
      if (tenantStatusMap.get(a.tenantId) === "converted") {
        entry.convertedCount += 1;
      }
    }

    const campaigns = Array.from(campaignMap.entries()).map(([campaign, data]) => ({
      campaign,
      demosCount: data.demosCount,
      convertedCount: data.convertedCount,
      conversionRate:
        data.demosCount > 0 ? Math.round((data.convertedCount / data.demosCount) * 100) : 0,
      revenue: data.revenue,
    }));
    campaigns.sort((a, b) => b.demosCount - a.demosCount);

    // Active Experiments
    const rawExperiments = listExperiments();
    const experiments = rawExperiments
      .map((e) => getExperimentResults(e.id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));

    const topSource = sources[0]?.source || "N/A";
    const topCampaign = campaigns[0]?.campaign || "N/A";

    const payload: MarketingDashboardPayload = {
      summary: {
        totalAttributedDemos: summary.totalAttributions,
        totalRevenue: summary.totalRevenue,
        topSource,
        topCampaign,
      },
      sources,
      campaigns,
      experiments,
      retrievedAt: new Date().toISOString(),
    };

    return ok(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Marketing query error";
    return fail("marketing_error", message, 500);
  }
}
