/**
 * scripts/demo/intelligence/deal-review.ts
 *
 * AI Deal Review & Risk Analysis.
 * Evaluates open commercial deals for stall risks, engagement decay, missing signals,
 * and produces algorithmic risk scores with actionable recovery playbooks.
 */

import { listDemoDeals, type DemoDeal, type DealStatus } from "../lib/demo-deals";
import { listDemoLeads, type DemoLead } from "../lib/demo-leads";
import { getTrackedDemoEvents, type DemoEventRecord } from "../lib/demo-events";
import { assertDemoEnvironmentSafety } from "../lib/guards";

export type DealRiskLevel = "low" | "medium" | "high" | "critical";

export interface DealRiskReview {
  dealId: string;
  leadId: string;
  tenantId: string;
  stage: DealStatus;
  dealValue: number;
  currency: string;
  riskLevel: DealRiskLevel;
  riskScore: number; // 0 (healthy) - 100 (critical stall)
  riskFactors: string[];
  stageDurationDays: number;
  inactivityHours: number;
  missingSignals: string[];
  actionablePlaybook: {
    recommendedAction: string;
    suggestedMessage: string;
    deadlineHours: number;
  };
  reviewedAt: string;
}

const STAGE_MAX_BENCHMARK_DAYS: Record<DealStatus, number> = {
  prospecting: 3,
  qualified: 5,
  proposal: 7,
  negotiation: 10,
  closed_won: 999,
  closed_lost: 999,
};

export function evaluateDealRisk(
  deal: DemoDeal,
  lead?: DemoLead,
  events: DemoEventRecord[] = [],
): DealRiskReview {
  const now = Date.now();
  const updatedMs = new Date(deal.updatedAt).getTime();
  const stageDurationDays = Math.max(0, Math.round((now - updatedMs) / (1000 * 60 * 60 * 24)));
  const inactivityHours = Math.max(0, Math.round((now - updatedMs) / (1000 * 60 * 60)));

  let riskScore = 0;
  const riskFactors: string[] = [];
  const missingSignals: string[] = [];

  // 1. Stage duration stall
  const benchmarkDays = STAGE_MAX_BENCHMARK_DAYS[deal.status] ?? 5;
  if (stageDurationDays > benchmarkDays) {
    const overdueDays = stageDurationDays - benchmarkDays;
    const stallPenalty = Math.min(35, overdueDays * 7);
    riskScore += stallPenalty;
    riskFactors.push(`Stalled in stage "${deal.status}" for ${stageDurationDays} days (target: <=${benchmarkDays} days)`);
  }

  // 2. Inactivity
  if (inactivityHours > 72) {
    riskScore += 30;
    riskFactors.push(`No sales interaction recorded in the past ${Math.round(inactivityHours / 24)} days`);
  } else if (inactivityHours > 48) {
    riskScore += 15;
    riskFactors.push(`Inactivity approaching critical threshold (${inactivityHours} hours)`);
  }

  // 3. Missing commercial signals
  const eventNames = new Set<string>(events.map((e) => String(e.event_name)));
  if (!eventNames.has("meeting_booked") && (deal.status === "proposal" || deal.status === "negotiation")) {
    riskScore += 20;
    missingSignals.push("No discovery meeting or live walkthrough booked");
  }
  if (!eventNames.has("feature_explored") && !eventNames.has("appointment_created")) {
    riskScore += 15;
    missingSignals.push("Low product engagement (no calendar appointments created in demo)");
  }
  if (!lead?.whatsapp && !lead?.email) {
    riskScore += 25;
    missingSignals.push("Incomplete direct contact coordinates for decision maker");
  }

  // Cap score 0 - 100
  const finalScore = Math.min(100, Math.max(0, riskScore));

  let riskLevel: DealRiskLevel = "low";
  if (finalScore >= 75) riskLevel = "critical";
  else if (finalScore >= 50) riskLevel = "high";
  else if (finalScore >= 25) riskLevel = "medium";

  // Actionable Playbook formulation
  let action = "Schedule standard weekly check-in";
  let message = "Hola, ¿cómo va la evaluación de Deskcomm en la clínica?";
  let deadline = 48;

  if (riskLevel === "critical") {
    action = "Immediate Executive Re-engagement & Trial Extension Offer";
    message = "Estimado doctor, detectamos que la demo está por vencer sin revisar la automatización de citas. ¿Le parece coordinar una llamada de 10 min mañana?";
    deadline = 4;
  } else if (riskLevel === "high") {
    action = "Direct WhatsApp Diagnostic with Clinical Objection Handling";
    message = "Hola doctor, queremos verificar si tuvieron algún inconveniente técnico configurando los sillones odontológicos en la plataforma.";
    deadline = 12;
  } else if (riskLevel === "medium") {
    action = "Deliver Interactive Product Video & ROI Calculator";
    message = "Compartimos un resumen en video de cómo Clínicas Odontológicas redujeron un 40% el ausentismo con nuestro recordatorio automatizado.";
    deadline = 24;
  }

  return {
    dealId: deal.id,
    leadId: deal.leadId,
    tenantId: deal.tenantId,
    stage: deal.status,
    dealValue: deal.value,
    currency: deal.currency,
    riskLevel,
    riskScore: finalScore,
    riskFactors,
    stageDurationDays,
    inactivityHours,
    missingSignals,
    actionablePlaybook: {
      recommendedAction: action,
      suggestedMessage: message,
      deadlineHours: deadline,
    },
    reviewedAt: new Date().toISOString(),
  };
}

export function reviewAllOpenDeals(options?: {
  dealsFile?: string;
  leadsFile?: string;
  eventsFile?: string;
}): DealRiskReview[] {
  assertDemoEnvironmentSafety();

  const deals = listDemoDeals({ customFilePath: options?.dealsFile });
  const leads = listDemoLeads({}, options?.leadsFile);

  const leadsMap = new Map<string, DemoLead>();
  for (const l of leads) {
    leadsMap.set(l.id, l);
    if (l.demo_tenant_id) leadsMap.set(l.demo_tenant_id, l);
  }

  // Open deals only
  const openDeals = deals.filter(
    (d) => d.status !== "closed_won" && d.status !== "closed_lost",
  );

  return openDeals.map((deal) => {
    const lead = leadsMap.get(deal.leadId) ?? leadsMap.get(deal.tenantId);
    const events = getTrackedDemoEvents(deal.tenantId, options?.eventsFile);
    return evaluateDealRisk(deal, lead, events);
  }).sort((a, b) => b.riskScore - a.riskScore);
}
