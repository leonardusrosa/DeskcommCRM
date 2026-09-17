/**
 * scripts/demo/lib/demo-warehouse.ts
 *
 * Revenue Warehouse Analytical Star Schema.
 * Implements dimensional modeling (facts and dimensions) and analytical aggregation layer
 * for executive intelligence, cohort analysis, CAC/LTV, and payback tracking.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { listDemoDeals } from "./demo-deals";
import { listDemoLeads, type DemoLead } from "./demo-leads";
import { convertCurrency, type SupportedCurrency } from "./demo-localization";
import { assertDemoEnvironmentSafety } from "./guards";

export interface DimTenant {
  tenantKey: string;
  vertical: string;
  country: string;
  plan: string;
  createdAt: string;
}

export interface DimTerritory {
  territoryKey: string;
  region: string;
  currency: SupportedCurrency;
}

export interface DimChannel {
  channelKey: string;
  name: string;
  type: "paid" | "organic" | "outbound" | "direct";
}

export interface FactConversion {
  id: string;
  tenantKey: string;
  territoryKey: string;
  channelKey: string;
  conversionDate: string;
  dealValueUsd: number;
  monthlyMrrUsd: number;
  estimatedCacUsd: number;
  estimatedLtvUsd: number;
}

export interface FactDealSnapshot {
  id: string;
  snapshotDate: string;
  dealId: string;
  tenantKey: string;
  stage: string;
  valueUsd: number;
}

export interface WarehouseAggregations {
  totalMrrUsd: number;
  totalArrUsd: number;
  totalConversions: number;
  avgCacUsd: number;
  avgLtvUsd: number;
  ltvToCacRatio: number;
  paybackMonths: number;
  mrrByTerritory: Record<string, number>;
  mrrByChannel: Record<string, number>;
}

export interface RevenueWarehouse {
  generatedAt: string;
  dimensions: {
    tenants: DimTenant[];
    territories: DimTerritory[];
    channels: DimChannel[];
  };
  facts: {
    conversions: FactConversion[];
    dealSnapshots: FactDealSnapshot[];
  };
  aggregations: WarehouseAggregations;
}

export const DEFAULT_WAREHOUSE_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_revenue_warehouse.json",
);

export function buildRevenueWarehouse(options?: {
  dealsFile?: string;
  leadsFile?: string;
  outputFile?: string;
}): RevenueWarehouse {
  assertDemoEnvironmentSafety();

  const deals = listDemoDeals({ customFilePath: options?.dealsFile });
  const leads = listDemoLeads({}, options?.leadsFile);

  const leadsMap = new Map<string, DemoLead>();
  for (const l of leads) {
    leadsMap.set(l.id, l);
    if (l.demo_tenant_id) leadsMap.set(l.demo_tenant_id, l);
  }

  // Build Dimensions
  const tenantSet = new Map<string, DimTenant>();
  const territorySet = new Map<string, DimTerritory>();
  const channelSet = new Map<string, DimChannel>();

  for (const deal of deals) {
    const lead = leadsMap.get(deal.leadId) ?? leadsMap.get(deal.tenantId);
    const country = (lead?.country || deal.currency || "CO").toUpperCase();
    const channelKey = String(lead?.whatsapp ? "whatsapp" : "direct").toLowerCase();
    const vertical = String(lead?.vertical || "dental-clinic");

    if (!tenantSet.has(deal.tenantId)) {
      tenantSet.set(deal.tenantId, {
        tenantKey: deal.tenantId,
        vertical,
        country,
        plan: deal.plan,
        createdAt: deal.createdAt,
      });
    }

    if (!territorySet.has(country)) {
      territorySet.set(country, {
        territoryKey: country,
        region: ["CO", "MX", "BR"].includes(country) ? "LATAM" : "EMEA",
        currency: (["USD", "EUR", "BRL", "MXN", "COP"].includes(deal.currency) ? deal.currency : "USD") as SupportedCurrency,
      });
    }

    if (!channelSet.has(channelKey)) {
      channelSet.set(channelKey, {
        channelKey,
        name: channelKey.toUpperCase(),
        type: channelKey.includes("ad") ? "paid" : "direct",
      });
    }
  }

  // Build Facts
  const conversions: FactConversion[] = [];
  const dealSnapshots: FactDealSnapshot[] = [];
  const now = new Date().toISOString();

  for (const deal of deals) {
    const valUsd = convertCurrency(deal.value || 0, (deal.currency as SupportedCurrency) || "USD", "USD");

    dealSnapshots.push({
      id: `snp_${deal.id}`,
      snapshotDate: now,
      dealId: deal.id,
      tenantKey: deal.tenantId,
      stage: deal.status,
      valueUsd: valUsd,
    });

    if (deal.status === "closed_won") {
      const lead = leadsMap.get(deal.leadId) ?? leadsMap.get(deal.tenantId);
      const country = (lead?.country || deal.currency || "CO").toUpperCase();
      const channelKey = String(lead?.whatsapp ? "whatsapp" : "direct").toLowerCase();
      const mrrUsd = valUsd;
      const cacUsd = 120; // benchmark estimated CAC
      const ltvUsd = mrrUsd * 18; // 18-month projected clinic lifetime

      conversions.push({
        id: `fct_conv_${deal.id}`,
        tenantKey: deal.tenantId,
        territoryKey: country,
        channelKey,
        conversionDate: deal.closedAt || deal.updatedAt,
        dealValueUsd: valUsd,
        monthlyMrrUsd: mrrUsd,
        estimatedCacUsd: cacUsd,
        estimatedLtvUsd: ltvUsd,
      });
    }
  }

  // Aggregation Layer
  const totalMrrUsd = conversions.reduce((sum, c) => sum + c.monthlyMrrUsd, 0);
  const totalArrUsd = totalMrrUsd * 12;
  const totalConversions = conversions.length;
  const avgCacUsd = totalConversions > 0 ? 120 : 0;
  const avgLtvUsd = totalConversions > 0 ? Math.round(conversions.reduce((sum, c) => sum + c.estimatedLtvUsd, 0) / totalConversions) : 0;
  const ltvToCacRatio = avgCacUsd > 0 ? Math.round((avgLtvUsd / avgCacUsd) * 10) / 10 : 0;
  const avgMrr = totalConversions > 0 ? totalMrrUsd / totalConversions : 0;
  const paybackMonths = avgMrr > 0 ? Math.round((avgCacUsd / avgMrr) * 10) / 10 : 0;

  const mrrByTerritory: Record<string, number> = {};
  const mrrByChannel: Record<string, number> = {};

  for (const c of conversions) {
    mrrByTerritory[c.territoryKey] = (mrrByTerritory[c.territoryKey] || 0) + c.monthlyMrrUsd;
    mrrByChannel[c.channelKey] = (mrrByChannel[c.channelKey] || 0) + c.monthlyMrrUsd;
  }

  const warehouse: RevenueWarehouse = {
    generatedAt: now,
    dimensions: {
      tenants: Array.from(tenantSet.values()),
      territories: Array.from(territorySet.values()),
      channels: Array.from(channelSet.values()),
    },
    facts: {
      conversions,
      dealSnapshots,
    },
    aggregations: {
      totalMrrUsd,
      totalArrUsd,
      totalConversions,
      avgCacUsd,
      avgLtvUsd,
      ltvToCacRatio,
      paybackMonths,
      mrrByTerritory,
      mrrByChannel,
    },
  };

  const outFile = options?.outputFile ?? DEFAULT_WAREHOUSE_FILE;
  try {
    const dir = path.dirname(outFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(warehouse, null, 2), "utf8");
  } catch {
    // fail silent
  }

  return warehouse;
}
