/**
 * scripts/demo/lib/demo-forecast.ts
 *
 * Revenue Forecasting & Pipeline Projection Engine.
 * Calculates:
 *   - Pipeline Value: unweighted sum of active pipeline deals
 *   - Weighted Revenue: probability-weighted MRR based on stage
 *   - ARR Forecast: annualized run-rate (Won MRR * 12 + Weighted Pipeline MRR * 12)
 *
 * Isolated from production: operates on demo deals (.demo/demo_deals.json).
 */

import { listDemoDeals, type DemoDeal, type DealCurrency, type DealStatus } from "./demo-deals";

export const STAGE_PROBABILITIES: Record<DealStatus, number> = {
  prospecting: 0.1,
  qualified: 0.3,
  proposal: 0.6,
  negotiation: 0.8,
  closed_won: 1.0,
  closed_lost: 0.0,
};

export interface CurrencyForecast {
  currency: DealCurrency;
  pipelineValue: number; // Unweighted open pipeline
  weightedRevenue: number; // Probability-weighted pipeline MRR
  wonMRR: number; // Actual closed won MRR
  arrForecast: number; // (wonMRR * 12) + (weightedRevenue * 12)
  dealsCount: number;
}

export interface RevenueForecastReport {
  totalDeals: number;
  openDealsCount: number;
  wonDealsCount: number;
  lostDealsCount: number;
  forecastsByCurrency: Record<DealCurrency, CurrencyForecast>;
  calculatedAt: string;
}

const SUPPORTED_CURRENCIES: DealCurrency[] = ["BRL", "COP", "MXN", "EUR", "USD"];

export function calculateRevenueForecast(options: {
  deals?: DemoDeal[];
  customDealsFile?: string;
} = {}): RevenueForecastReport {
  const deals = options.deals ?? listDemoDeals({ customFilePath: options.customDealsFile });

  const forecastsByCurrency: Record<DealCurrency, CurrencyForecast> = {
    BRL: initForecast("BRL"),
    COP: initForecast("COP"),
    MXN: initForecast("MXN"),
    EUR: initForecast("EUR"),
    USD: initForecast("USD"),
  };

  let openDealsCount = 0;
  let wonDealsCount = 0;
  let lostDealsCount = 0;

  for (const deal of deals) {
    const cur = deal.currency;
    if (!forecastsByCurrency[cur]) {
      forecastsByCurrency[cur] = initForecast(cur);
    }
    const f = forecastsByCurrency[cur]!;
    f.dealsCount += 1;

    const prob = STAGE_PROBABILITIES[deal.status] ?? 0;

    if (deal.status === "closed_won") {
      wonDealsCount += 1;
      f.wonMRR += deal.value;
    } else if (deal.status === "closed_lost") {
      lostDealsCount += 1;
    } else {
      // Open pipeline deal
      openDealsCount += 1;
      f.pipelineValue += deal.value;
      f.weightedRevenue += Math.round(deal.value * prob);
    }
  }

  // Calculate ARR Forecast: (Won MRR * 12) + (Weighted MRR * 12)
  for (const cur of SUPPORTED_CURRENCIES) {
    const f = forecastsByCurrency[cur]!;
    f.arrForecast = (f.wonMRR * 12) + (f.weightedRevenue * 12);
  }

  return {
    totalDeals: deals.length,
    openDealsCount,
    wonDealsCount,
    lostDealsCount,
    forecastsByCurrency,
    calculatedAt: new Date().toISOString(),
  };
}

function initForecast(currency: DealCurrency): CurrencyForecast {
  return {
    currency,
    pipelineValue: 0,
    weightedRevenue: 0,
    wonMRR: 0,
    arrForecast: 0,
    dealsCount: 0,
  };
}
