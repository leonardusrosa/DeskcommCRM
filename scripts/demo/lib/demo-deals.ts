/**
 * scripts/demo/lib/demo-deals.ts
 *
 * Deal Tracking (demo_deals) — commercial deal pipeline for demo leads.
 * Entirely isolated from customer CRM deal/revenue data.
 * Persisted locally in .demo/demo_deals.json.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type DealStatus =
  | "prospecting"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export type DealCurrency = "BRL" | "COP" | "MXN" | "EUR" | "USD";

export interface DemoPlan {
  name: "starter" | "professional" | "enterprise";
  monthlyPrice: Record<DealCurrency, number>;
}

export const DESKCOMM_PLANS: DemoPlan[] = [
  {
    name: "starter",
    monthlyPrice: { BRL: 397, COP: 180000, MXN: 799, EUR: 79, USD: 89 },
  },
  {
    name: "professional",
    monthlyPrice: { BRL: 797, COP: 360000, MXN: 1599, EUR: 149, USD: 169 },
  },
  {
    name: "enterprise",
    monthlyPrice: { BRL: 1497, COP: 680000, MXN: 2999, EUR: 279, USD: 319 },
  },
];

export interface DemoDeal {
  id: string;
  leadId: string;
  tenantId: string;
  plan: DemoPlan["name"];
  value: number;
  currency: DealCurrency;
  status: DealStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export const DEFAULT_DEALS_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_deals.json");

export function createDemoDeal(input: {
  leadId: string;
  tenantId: string;
  plan: DemoPlan["name"];
  currency: DealCurrency;
  notes?: string;
  customFilePath?: string;
}): DemoDeal {
  const plan = DESKCOMM_PLANS.find((p) => p.name === input.plan);
  const value = plan?.monthlyPrice[input.currency] ?? 0;

  const deal: DemoDeal = {
    id: crypto.randomUUID(),
    leadId: input.leadId,
    tenantId: input.tenantId,
    plan: input.plan,
    value,
    currency: input.currency,
    status: "prospecting",
    notes: input.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  persist(deal, input.customFilePath ?? DEFAULT_DEALS_FILE);
  return deal;
}

export function updateDealStatus(
  dealId: string,
  status: DealStatus,
  options: { notes?: string; customFilePath?: string } = {},
): DemoDeal | null {
  const targetFile = options.customFilePath ?? DEFAULT_DEALS_FILE;
  if (!fs.existsSync(targetFile)) return null;

  try {
    const all = JSON.parse(fs.readFileSync(targetFile, "utf-8")) as DemoDeal[];
    const deal = all.find((d) => d.id === dealId);
    if (!deal) return null;

    deal.status = status;
    deal.updatedAt = new Date().toISOString();
    if (options.notes) deal.notes = options.notes;
    if (status === "closed_won" || status === "closed_lost") {
      deal.closedAt = new Date().toISOString();
    }

    fs.writeFileSync(targetFile, JSON.stringify(all, null, 2), "utf-8");
    return deal;
  } catch {
    return null;
  }
}

export function listDemoDeals(
  options: { tenantId?: string; status?: DealStatus; customFilePath?: string } = {},
): DemoDeal[] {
  const file = options.customFilePath ?? DEFAULT_DEALS_FILE;
  if (!fs.existsSync(file)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(file, "utf-8")) as DemoDeal[];
    return all.filter((d) => {
      if (options.tenantId && d.tenantId !== options.tenantId) return false;
      if (options.status && d.status !== options.status) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export function estimateMRR(
  options: { customFilePath?: string } = {},
): Record<DealCurrency, number> {
  const deals = listDemoDeals({
    status: "closed_won",
    customFilePath: options.customFilePath,
  });

  const mrr: Record<DealCurrency, number> = {
    BRL: 0, COP: 0, MXN: 0, EUR: 0, USD: 0,
  };

  for (const deal of deals) {
    mrr[deal.currency] = (mrr[deal.currency] ?? 0) + deal.value;
  }

  return mrr;
}

function persist(deal: DemoDeal, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let list: DemoDeal[] = [];
  if (fs.existsSync(targetFile)) {
    try { list = JSON.parse(fs.readFileSync(targetFile, "utf-8")); } catch { list = []; }
  }
  list.push(deal);
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
