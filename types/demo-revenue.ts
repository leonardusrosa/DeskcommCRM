import type { DealCurrency } from "@/scripts/demo/lib/demo-deals";
import type { FunnelStageMetrics } from "@/scripts/demo/lib/demo-funnel";

export interface ChannelRevenueItem {
  channel: string;
  count: number;
  revenue: number;
}

export interface TerritoryRevenueItem {
  id: string;
  name: string;
  region: string;
  defaultCurrency: string;
  dealsCount: number;
  openPipelineValue: number;
  wonMRR: number;
  arrForecast: number;
}

export interface ExecutiveRevenueData {
  pipeline: {
    openDealsCount: number;
    wonDealsCount: number;
    lostDealsCount: number;
    totalDealsCount: number;
    pipelineValueByCurrency: Record<DealCurrency, number>;
  };
  forecast: {
    arrForecastByCurrency: Record<DealCurrency, number>;
    weightedMRRByCurrency: Record<DealCurrency, number>;
    wonMRRByCurrency: Record<DealCurrency, number>;
  };
  conversion: {
    totalRequested: number;
    totalConverted: number;
    overallConversionRate: number;
    stages: FunnelStageMetrics[];
  };
  cac: {
    estimatedCACUSD: number;
    estimatedCACByCurrency: Record<DealCurrency, number>;
    totalSpendUSD: number;
    totalConversions: number;
  };
  channels: ChannelRevenueItem[];
  campaigns: ChannelRevenueItem[];
  territories: TerritoryRevenueItem[];
  calculatedAt: string;
}
