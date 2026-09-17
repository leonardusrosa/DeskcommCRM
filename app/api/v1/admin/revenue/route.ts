/**
 * app/api/v1/admin/revenue/route.ts
 *
 * Executive Revenue Dashboard API.
 * Aggregates pipeline, forecast ARR, conversion funnel, estimated CAC,
 * channel revenue attribution, and regional territory metrics.
 */

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { calculateRevenueForecast } from "@/scripts/demo/lib/demo-forecast";
import { getDemoFunnelMetrics } from "@/scripts/demo/lib/demo-funnel";
import { getAttributionSummary } from "@/scripts/demo/lib/demo-attribution";
import { listTerritories } from "@/scripts/demo/lib/demo-territories";
import { listDemoDeals, type DealCurrency } from "@/scripts/demo/lib/demo-deals";
import type {
  ExecutiveRevenueData,
  ChannelRevenueItem,
  TerritoryRevenueItem,
} from "@/types/demo-revenue";

const FX_RATES_TO_USD: Record<DealCurrency, number> = {
  USD: 1.0,
  EUR: 1.08,
  BRL: 0.18,
  MXN: 0.055,
  COP: 0.00025,
};

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const deals = listDemoDeals();
    const forecastReport = calculateRevenueForecast({ deals });
    const funnel = getDemoFunnelMetrics();
    const attribution = getAttributionSummary();
    const territories = listTerritories();

    // 1. Pipeline & Forecast breakdown by currency
    const pipelineValueByCurrency: Record<DealCurrency, number> = {
      BRL: 0, COP: 0, MXN: 0, EUR: 0, USD: 0,
    };
    const arrForecastByCurrency: Record<DealCurrency, number> = {
      BRL: 0, COP: 0, MXN: 0, EUR: 0, USD: 0,
    };
    const weightedMRRByCurrency: Record<DealCurrency, number> = {
      BRL: 0, COP: 0, MXN: 0, EUR: 0, USD: 0,
    };
    const wonMRRByCurrency: Record<DealCurrency, number> = {
      BRL: 0, COP: 0, MXN: 0, EUR: 0, USD: 0,
    };

    for (const [cur, f] of Object.entries(forecastReport.forecastsByCurrency)) {
      const c = cur as DealCurrency;
      pipelineValueByCurrency[c] = f.pipelineValue;
      arrForecastByCurrency[c] = f.arrForecast;
      weightedMRRByCurrency[c] = f.weightedRevenue;
      wonMRRByCurrency[c] = f.wonMRR;
    }

    // 2. Channels and Campaigns
    const channels: ChannelRevenueItem[] = Object.entries(attribution.bySource).map(
      ([channel, data]) => ({
        channel,
        count: data.count,
        revenue: data.revenue,
      })
    ).sort((a, b) => b.revenue - a.revenue);

    const campaigns: ChannelRevenueItem[] = Object.entries(attribution.byCampaign).map(
      ([channel, data]) => ({
        channel,
        count: data.count,
        revenue: data.revenue,
      })
    ).sort((a, b) => b.revenue - a.revenue);

    // 3. CAC Calculation (Estimated spend based on attribution acquisition benchmarks)
    const baseCostPerLeadUSD = 25;
    const totalSpendUSD = attribution.totalAttributions * baseCostPerLeadUSD;
    const totalConversions = Math.max(funnel.totalConverted, forecastReport.wonDealsCount);
    const estimatedCACUSD = totalConversions > 0 ? Math.round(totalSpendUSD / totalConversions) : 0;

    const estimatedCACByCurrency: Record<DealCurrency, number> = {
      USD: estimatedCACUSD,
      EUR: Math.round(estimatedCACUSD / FX_RATES_TO_USD.EUR),
      BRL: Math.round(estimatedCACUSD / FX_RATES_TO_USD.BRL),
      MXN: Math.round(estimatedCACUSD / FX_RATES_TO_USD.MXN),
      COP: Math.round(estimatedCACUSD / FX_RATES_TO_USD.COP),
    };

    // 4. Regional Territory Aggregation
    const territoryItems: TerritoryRevenueItem[] = territories.map((territory) => {
      const territoryDeals = deals.filter((d) => d.currency === territory.defaultCurrency);
      let openPipeline = 0;
      let wonMRR = 0;
      let weightedMRR = 0;

      for (const d of territoryDeals) {
        if (d.status === "closed_won") {
          wonMRR += d.value;
        } else if (d.status !== "closed_lost") {
          openPipeline += d.value;
          const prob = d.status === "proposal" ? 0.6 : d.status === "negotiation" ? 0.8 : 0.3;
          weightedMRR += Math.round(d.value * prob);
        }
      }

      return {
        id: territory.id,
        name: territory.name,
        region: territory.region,
        defaultCurrency: territory.defaultCurrency,
        dealsCount: territoryDeals.length,
        openPipelineValue: openPipeline,
        wonMRR,
        arrForecast: (wonMRR * 12) + (weightedMRR * 12),
      };
    });

    const payload: ExecutiveRevenueData = {
      pipeline: {
        openDealsCount: forecastReport.openDealsCount,
        wonDealsCount: forecastReport.wonDealsCount,
        lostDealsCount: forecastReport.lostDealsCount,
        totalDealsCount: forecastReport.totalDeals,
        pipelineValueByCurrency,
      },
      forecast: {
        arrForecastByCurrency,
        weightedMRRByCurrency,
        wonMRRByCurrency,
      },
      conversion: {
        totalRequested: funnel.totalRequested,
        totalConverted: funnel.totalConverted,
        overallConversionRate: funnel.overallConversionRate,
        stages: funnel.stages,
      },
      cac: {
        estimatedCACUSD,
        estimatedCACByCurrency,
        totalSpendUSD,
        totalConversions,
      },
      channels,
      campaigns,
      territories: territoryItems,
      calculatedAt: new Date().toISOString(),
    };

    return ok(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error generating revenue analytics";
    return fail("internal_error", message, 500);
  }
}
