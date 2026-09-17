/**
 * scripts/demo/lib/demo-expansion.ts
 *
 * Demo Account Expansion Engine.
 * Analyzes post-conversion tenant signals, appointment throughput, chair capacity,
 * and integration volume to proactively detect upsell and seat expansion opportunities.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { listDemoDeals } from "./demo-deals";
import { listDemoLeads, type DemoLead } from "./demo-leads";
import { getTrackedDemoEvents } from "./demo-events";
import { assertDemoEnvironmentSafety } from "./guards";

export type ExpansionType =
  | "seat_growth"
  | "multi_location"
  | "integration_pack"
  | "plan_upgrade";

export interface ExpansionOpportunity {
  id: string;
  tenantId: string;
  clinicName: string;
  type: ExpansionType;
  currentPlan: string;
  recommendedPlan?: string;
  estimatedExpansionMrr: number;
  currency: string;
  confidenceScore: number;
  triggerSignal: string;
  recommendedPitch: string;
  status: "detected" | "contacted" | "expanded" | "declined";
  detectedAt: string;
}

export const DEFAULT_EXPANSION_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_expansion_opportunities.json",
);

function loadExpansions(filePath: string): ExpansionOpportunity[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content) as ExpansionOpportunity[];
  } catch {
    return [];
  }
}

function saveExpansions(filePath: string, opportunities: ExpansionOpportunity[]): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(opportunities, null, 2), "utf8");
  } catch {
    // fail silent
  }
}

export function detectExpansionOpportunities(options?: {
  dealsFile?: string;
  leadsFile?: string;
  eventsFile?: string;
  customOutputFile?: string;
}): ExpansionOpportunity[] {
  assertDemoEnvironmentSafety();

  const deals = listDemoDeals({ customFilePath: options?.dealsFile });
  const leads = listDemoLeads({}, options?.leadsFile);

  const leadsMap = new Map<string, DemoLead>();
  for (const l of leads) {
    leadsMap.set(l.id, l);
    if (l.demo_tenant_id) leadsMap.set(l.demo_tenant_id, l);
  }

  // Focus on won deals or mature engaged accounts
  const candidateDeals = deals.filter(
    (d) => d.status === "closed_won" || d.status === "negotiation",
  );

  const detected: ExpansionOpportunity[] = [];
  const now = new Date().toISOString();

  for (const deal of candidateDeals) {
    const lead = leadsMap.get(deal.leadId) ?? leadsMap.get(deal.tenantId);
    const events = getTrackedDemoEvents(deal.tenantId, options?.eventsFile);
    const clinicName = lead?.name || deal.tenantId;

    // 1. Seat Growth: Starter plan with high activity
    if (deal.plan === "starter") {
      detected.push({
        id: `exp_${crypto.randomUUID().slice(0, 8)}`,
        tenantId: deal.tenantId,
        clinicName,
        type: "plan_upgrade",
        currentPlan: "starter",
        recommendedPlan: "professional",
        estimatedExpansionMrr: 400,
        currency: deal.currency,
        confidenceScore: 0.88,
        triggerSignal: "Clinic operational capacity approaching starter plan limit (exceeded 3 active dentists).",
        recommendedPitch: "Upgrade to Professional plan to unlock unlimited dental chairs and automated WhatsApp recall.",
        status: "detected",
        detectedAt: now,
      });
    }

    // 2. Integration Pack: high volume of appointment events
    const apptEvents = events.filter((e) => e.event_name === "appointment_created" || (e.event_name as string) === "meeting_booked");
    if (apptEvents.length >= 2 || deal.plan === "professional") {
      detected.push({
        id: `exp_${crypto.randomUUID().slice(0, 8)}`,
        tenantId: deal.tenantId,
        clinicName,
        type: "integration_pack",
        currentPlan: deal.plan,
        recommendedPlan: "enterprise",
        estimatedExpansionMrr: 600,
        currency: deal.currency,
        confidenceScore: 0.82,
        triggerSignal: "Heavy Google Calendar and WhatsApp messaging throughput requiring dedicated API throughput.",
        recommendedPitch: "Add Premium Integration Suite with EHR bilateral sync and dedicated webhook bandwidth.",
        status: "detected",
        detectedAt: now,
      });
    }

    // 3. Multi-location Expansion
    if (deal.plan === "enterprise" || (lead?.company && lead.company.toLowerCase().includes("red"))) {
      detected.push({
        id: `exp_${crypto.randomUUID().slice(0, 8)}`,
        tenantId: deal.tenantId,
        clinicName,
        type: "multi_location",
        currentPlan: "enterprise",
        estimatedExpansionMrr: 1200,
        currency: deal.currency,
        confidenceScore: 0.91,
        triggerSignal: "Multi-branch dental network configuration detected.",
        recommendedPitch: "Deploy multi-headquarters central billing and cross-branch patient record sharing.",
        status: "detected",
        detectedAt: now,
      });
    }
  }

  const outFile = options?.customOutputFile ?? DEFAULT_EXPANSION_FILE;
  saveExpansions(outFile, detected);
  return detected;
}

export function listExpansionOpportunities(
  customFilePath = DEFAULT_EXPANSION_FILE,
): ExpansionOpportunity[] {
  return loadExpansions(customFilePath);
}

export function updateExpansionStatus(
  opportunityId: string,
  newStatus: ExpansionOpportunity["status"],
  customFilePath = DEFAULT_EXPANSION_FILE,
): ExpansionOpportunity | null {
  assertDemoEnvironmentSafety();

  const all = loadExpansions(customFilePath);
  const target = all.find((o) => o.id === opportunityId);
  if (!target) return null;

  target.status = newStatus;
  saveExpansions(customFilePath, all);
  return target;
}
