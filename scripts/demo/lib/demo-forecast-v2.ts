/**
 * scripts/demo/lib/demo-forecast-v2.ts
 *
 * Forecast Engine 2.0: Multi-Scenario Revenue Forecasting.
 * Projects revenue across three probabilistic scenarios:
 *   - Conservative: defensive weighting for financial planning
 *   - Expected: health-score & territory adjusted baseline
 *   - Aggressive: expansion scenario assuming accelerated conversion velocity
 *
 * Isolated in demo environment.
 */

import { listDemoDeals, type DemoDeal, type DealCurrency, type DealStatus } from "./demo-deals";
import { calculateDemoHealthScore } from "./demo-health-score";

export interface ScenarioForecast {
  wonMRR: number;
  weightedPipelineMRR: number;
  arrForecast: number;
}

export interface CurrencyForecastV2 {
  currency: DealCurrency;
  dealsCount: number;
  openPipelineValue: number;
  conservative: ScenarioForecast;
  expected: ScenarioForecast;
  aggressive: ScenarioForecast;
}

export interface ForecastV2Report {
  totalDeals: number;
  openDealsCount: number;
  wonDealsCount: number;
  lostDealsCount: number;
  byCurrency: Record<DealCurrency, CurrencyForecastV2>;
  calculatedAt: string;
}

const BASE_PROBABILITIES: Record<DealStatus, number> = {
  prospecting: 0.1,
  qualified: 0.3,
  proposal: 0.6,
  negotiation: 0.8,
  closed_won: 1.0,
  closed_lost: 0.0,
};

const SUPPORTED_CURRENCIES: DealCurrency[] = ["BRL", "COP", "MXN", "EUR", "USD"];

function initCurrencyForecast(currency: DealCurrency): CurrencyForecastV2 {
  return {
    currency,
    dealsCount: 0,
    openPipelineValue: 0,
    conservative: { wonMRR: 0, weightedPipelineMRR: 0, arrForecast: 0 },
    expected: { wonMRR: 0, weightedPipelineMRR: 0, arrForecast: 0 },
    aggressive: { wonMRR: 0, weightedPipelineMRR: 0, arrForecast: 0 },
  };
}

export function calculateForecastV2(options: {
  deals?: DemoDeal[];
  customDealsFile?: string;
} = {}): ForecastV2Report {
  const deals = options.deals ?? listDemoDeals({ customFilePath: options.customDealsFile });

  const byCurrency: Record<DealCurrency, CurrencyForecastV2> = {
    BRL: initCurrencyForecast("BRL"),
    COP: initCurrencyForecast("COP"),
    MXN: initCurrencyForecast("MXN"),
    EUR: initCurrencyForecast("EUR"),
    USD: initCurrencyForecast("USD"),
  };

  let openDealsCount = 0;
  let wonDealsCount = 0;
  let lostDealsCount = 0;

  for (const deal of deals) {
    const cur = deal.currency;
    if (!byCurrency[cur]) byCurrency[cur] = initCurrencyForecast(cur);
    const item = byCurrency[cur]!;
    item.dealsCount += 1;

    if (deal.status === "closed_won") {
      wonDealsCount += 1;
      item.conservative.wonMRR += deal.value;
      item.expected.wonMRR += deal.value;
      item.aggressive.wonMRR += deal.value;
      continue;
    }

    if (deal.status === "closed_lost") {
      lostDealsCount += 1;
      continue;
    }

    // Open pipeline deal
    openDealsCount += 1;
    item.openPipelineValue += deal.value;

    const baseProb = BASE_PROBABILITIES[deal.status] ?? 0.2;

    // Calculate Health Score adjustment factor
    let healthFactor = 1.0;
    try {
      const health = calculateDemoHealthScore(deal.tenantId);
      healthFactor = Math.min(Math.max(health.healthScore / 60, 0.7), 1.25);
    } catch {
      healthFactor = 1.0;
    }

    // 1. Conservative probability: 0.7x base
    const consProb = Math.min(baseProb * 0.7, 0.75);
    item.conservative.weightedPipelineMRR += Math.round(deal.value * consProb);

    // 2. Expected probability: base * healthFactor
    const expProb = Math.min(baseProb * healthFactor, 0.85);
    item.expected.weightedPipelineMRR += Math.round(deal.value * expProb);

    // 3. Aggressive probability: 1.3x base with 10% expansion upside
    const aggProb = Math.min(baseProb * 1.3, 0.95);
    const aggValue = Math.round(deal.value * 1.1);
    item.aggressive.weightedPipelineMRR += Math.round(aggValue * aggProb);
  }

  // Finalize annualized run rate (ARR = Won MRR * 12 + Weighted MRR * 12)
  for (const cur of SUPPORTED_CURRENCIES) {
    const c = byCurrency[cur]!;
    c.conservative.arrForecast = (c.conservative.wonMRR * 12) + (c.conservative.weightedPipelineMRR * 12);
    c.expected.arrForecast = (c.expected.wonMRR * 12) + (c.expected.weightedPipelineMRR * 12);
    c.aggressive.arrForecast = (c.aggressive.wonMRR * 12) + (c.aggressive.weightedPipelineMRR * 12);
  }

  return {
    totalDeals: deals.length,
    openDealsCount,
    wonDealsCount,
    lostDealsCount,
    byCurrency,
    calculatedAt: new Date().toISOString(),
  };
}
