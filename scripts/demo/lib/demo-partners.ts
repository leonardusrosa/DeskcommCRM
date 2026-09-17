/**
 * scripts/demo/lib/demo-partners.ts
 *
 * Demo Partner & Agency Revenue Share Engine (demo_partners).
 * Tracks partner attribution, commission tiers, and revenue share payouts for demo tenants.
 * Strictly isolated: operates only in demo storage (.demo/demo_partners.json).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { assertDemoEnvironmentSafety } from "./guards";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export interface DemoPartner {
  id: string;
  partnerCode: string;
  name: string;
  agencyName: string;
  email: string;
  commissionRatePercentage: number; // e.g. 20 (20%)
  status: "active" | "inactive";
  createdAt: string;
}

export interface PartnerAttributionRecord {
  id: string;
  partnerCode: string;
  tenantId: string;
  dealValue: number;
  currency: string;
  commissionRatePercentage: number;
  commissionEarned: number;
  status: "attributed" | "qualified" | "closed_won" | "commission_paid";
  attributedAt: string;
  updatedAt: string;
}

export interface PartnerRevenueShareSummary {
  partnerCode: string;
  partnerName: string;
  totalDemosAttributed: number;
  totalWonDeals: number;
  totalGrossRevenue: Record<string, number>;
  totalCommissionsEarned: Record<string, number>;
}

export interface DemoPartnersData {
  partners: DemoPartner[];
  attributions: PartnerAttributionRecord[];
}

export const DEFAULT_PARTNERS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_partners.json",
);

export function registerPartner(
  input: {
    partnerCode: string;
    name: string;
    agencyName: string;
    email: string;
    commissionRatePercentage?: number;
  },
  customFilePath = DEFAULT_PARTNERS_FILE,
  customEnv?: Record<string, string | undefined>,
): DemoPartner {
  assertDemoEnvironmentSafety(customEnv);
  const data = loadPartnersData(customFilePath);

  const code = input.partnerCode.toUpperCase().trim();
  const existing = data.partners.find((p) => p.partnerCode === code);
  if (existing) return existing;

  const partner: DemoPartner = {
    id: crypto.randomUUID(),
    partnerCode: code,
    name: input.name,
    agencyName: input.agencyName,
    email: input.email,
    commissionRatePercentage: input.commissionRatePercentage ?? 20,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  data.partners.push(partner);
  savePartnersData(data, customFilePath);

  return partner;
}

export function attributePartnerDemo(
  tenantId: string,
  partnerCode: string,
  options: {
    dealValue?: number;
    currency?: string;
    customFilePath?: string;
    customEnv?: Record<string, string | undefined>;
  } = {},
): PartnerAttributionRecord | null {
  assertDemoEnvironmentSafety(options.customEnv);
  const targetFile = options.customFilePath ?? DEFAULT_PARTNERS_FILE;
  const data = loadPartnersData(targetFile);

  const code = partnerCode.toUpperCase().trim();
  const partner = data.partners.find((p) => p.partnerCode === code && p.status === "active");
  if (!partner) return null;

  const dealValue = options.dealValue ?? 0;
  const currency = options.currency ?? "USD";
  const commissionEarned = Math.round(dealValue * (partner.commissionRatePercentage / 100));

  const record: PartnerAttributionRecord = {
    id: crypto.randomUUID(),
    partnerCode: code,
    tenantId,
    dealValue,
    currency,
    commissionRatePercentage: partner.commissionRatePercentage,
    commissionEarned,
    status: "attributed",
    attributedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.attributions.push(record);
  savePartnersData(data, targetFile);

  return record;
}

export function recordPartnerDealWon(
  tenantId: string,
  dealValue: number,
  currency: string,
  customFilePath = DEFAULT_PARTNERS_FILE,
): PartnerAttributionRecord | null {
  const data = loadPartnersData(customFilePath);
  const match = data.attributions.find((a) => a.tenantId === tenantId);
  if (!match) return null;

  match.dealValue = dealValue;
  match.currency = currency;
  match.commissionEarned = Math.round(dealValue * (match.commissionRatePercentage / 100));
  match.status = "closed_won";
  match.updatedAt = new Date().toISOString();

  savePartnersData(data, customFilePath);
  return match;
}

export function getPartnerSummary(
  partnerCode: string,
  customFilePath = DEFAULT_PARTNERS_FILE,
): PartnerRevenueShareSummary | null {
  const data = loadPartnersData(customFilePath);
  const code = partnerCode.toUpperCase().trim();
  const partner = data.partners.find((p) => p.partnerCode === code);
  if (!partner) return null;

  const attributions = data.attributions.filter((a) => a.partnerCode === code);
  const totalGrossRevenue: Record<string, number> = {};
  const totalCommissionsEarned: Record<string, number> = {};
  let totalWonDeals = 0;

  for (const a of attributions) {
    if (a.status === "closed_won") {
      totalWonDeals += 1;
      totalGrossRevenue[a.currency] = (totalGrossRevenue[a.currency] ?? 0) + a.dealValue;
      totalCommissionsEarned[a.currency] = (totalCommissionsEarned[a.currency] ?? 0) + a.commissionEarned;
    }
  }

  return {
    partnerCode: code,
    partnerName: partner.name,
    totalDemosAttributed: attributions.length,
    totalWonDeals,
    totalGrossRevenue,
    totalCommissionsEarned,
  };
}

export function listPartners(customFilePath = DEFAULT_PARTNERS_FILE): DemoPartner[] {
  return loadPartnersData(customFilePath).partners;
}

export function listPartnerAttributions(
  partnerCode?: string,
  customFilePath = DEFAULT_PARTNERS_FILE,
): PartnerAttributionRecord[] {
  const data = loadPartnersData(customFilePath);
  if (!partnerCode) return data.attributions;
  const code = partnerCode.toUpperCase().trim();
  return data.attributions.filter((a) => a.partnerCode === code);
}

function loadPartnersData(targetFile: string): DemoPartnersData {
  if (!fs.existsSync(targetFile)) return { partners: [], attributions: [] };
  try {
    return JSON.parse(fs.readFileSync(targetFile, "utf-8")) as DemoPartnersData;
  } catch {
    return { partners: [], attributions: [] };
  }
}

function savePartnersData(data: DemoPartnersData, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), "utf-8");
}
