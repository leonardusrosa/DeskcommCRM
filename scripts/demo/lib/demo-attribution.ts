/**
 * scripts/demo/lib/demo-attribution.ts
 *
 * Demo Attribution Engine (demo_attribution).
 * Tracks campaign, traffic source, vertical, country, and downstream closed revenue.
 * Strictly isolated in local storage (.demo/demo_attribution.json).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export interface DemoAttribution {
  id: string;
  tenantId: string;
  leadId?: string;
  campaign: string;
  source: string;
  vertical: string;
  country: string;
  revenue: number;
  currency: string;
  medium?: string;
  content?: string;
  term?: string;
  recordedAt: string;
  updatedAt: string;
}

export interface AttributionInput {
  tenantId: string;
  leadId?: string;
  campaign?: string;
  source?: string;
  vertical?: string;
  country?: string;
  revenue?: number;
  currency?: string;
  medium?: string;
  content?: string;
  term?: string;
}

export interface AttributionSummary {
  totalAttributions: number;
  totalRevenue: Record<string, number>;
  byCampaign: Record<string, { count: number; revenue: number }>;
  bySource: Record<string, { count: number; revenue: number }>;
  byCountry: Record<string, { count: number; revenue: number }>;
  byVertical: Record<string, { count: number; revenue: number }>;
}

export const DEFAULT_ATTRIBUTION_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_attribution.json",
);

export function recordDemoAttribution(
  input: AttributionInput,
  customFilePath = DEFAULT_ATTRIBUTION_FILE,
): DemoAttribution {
  const record: DemoAttribution = {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    campaign: input.campaign || "direct_or_unknown",
    source: input.source || "direct",
    vertical: input.vertical || "general",
    country: (input.country || "CO").toUpperCase(),
    revenue: input.revenue ?? 0,
    currency: input.currency || "USD",
    medium: input.medium,
    content: input.content,
    term: input.term,
    recordedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  persistAttribution(record, customFilePath);
  return record;
}

export function updateAttributionRevenue(
  tenantId: string,
  additionalRevenue: number,
  currency?: string,
  customFilePath = DEFAULT_ATTRIBUTION_FILE,
): DemoAttribution | null {
  if (!fs.existsSync(customFilePath)) return null;

  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoAttribution[];
    const match = all.find((a) => a.tenantId === tenantId);
    if (!match) return null;

    match.revenue += additionalRevenue;
    if (currency) match.currency = currency;
    match.updatedAt = new Date().toISOString();

    fs.writeFileSync(customFilePath, JSON.stringify(all, null, 2), "utf-8");
    return match;
  } catch {
    return null;
  }
}

export function listDemoAttributions(
  filters?: { tenantId?: string; campaign?: string; source?: string },
  customFilePath = DEFAULT_ATTRIBUTION_FILE,
): DemoAttribution[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoAttribution[];
    return all.filter((a) => {
      if (filters?.tenantId && a.tenantId !== filters.tenantId) return false;
      if (filters?.campaign && a.campaign !== filters.campaign) return false;
      if (filters?.source && a.source !== filters.source) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export function getAttributionSummary(
  customFilePath = DEFAULT_ATTRIBUTION_FILE,
): AttributionSummary {
  const all = listDemoAttributions(undefined, customFilePath);

  const totalRevenue: Record<string, number> = {};
  const byCampaign: Record<string, { count: number; revenue: number }> = {};
  const bySource: Record<string, { count: number; revenue: number }> = {};
  const byCountry: Record<string, { count: number; revenue: number }> = {};
  const byVertical: Record<string, { count: number; revenue: number }> = {};

  for (const item of all) {
    totalRevenue[item.currency] = (totalRevenue[item.currency] ?? 0) + item.revenue;

    // Campaign
    if (!byCampaign[item.campaign]) byCampaign[item.campaign] = { count: 0, revenue: 0 };
    byCampaign[item.campaign]!.count += 1;
    byCampaign[item.campaign]!.revenue += item.revenue;

    // Source
    if (!bySource[item.source]) bySource[item.source] = { count: 0, revenue: 0 };
    bySource[item.source]!.count += 1;
    bySource[item.source]!.revenue += item.revenue;

    // Country
    if (!byCountry[item.country]) byCountry[item.country] = { count: 0, revenue: 0 };
    byCountry[item.country]!.count += 1;
    byCountry[item.country]!.revenue += item.revenue;

    // Vertical
    if (!byVertical[item.vertical]) byVertical[item.vertical] = { count: 0, revenue: 0 };
    byVertical[item.vertical]!.count += 1;
    byVertical[item.vertical]!.revenue += item.revenue;
  }

  return {
    totalAttributions: all.length,
    totalRevenue,
    byCampaign,
    bySource,
    byCountry,
    byVertical,
  };
}

function persistAttribution(record: DemoAttribution, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let list: DemoAttribution[] = [];
  if (fs.existsSync(targetFile)) {
    try {
      list = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    } catch {
      list = [];
    }
  }
  list.push(record);
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
