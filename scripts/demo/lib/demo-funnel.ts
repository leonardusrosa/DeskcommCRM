/**
 * scripts/demo/lib/demo-funnel.ts
 *
 * Demo Funnel Analytics Engine.
 * Tracks commercial conversion progression across 7 standardized stages:
 *   requested -> created -> activated -> qualified -> meeting_booked -> proposal_sent -> converted
 *
 * Isolated from customer CRM data. Never mutates production tenants.
 */

import { listDemoLeads, type DemoLead, type DemoLeadStatus } from "./demo-leads";
import { getTrackedDemoEvents } from "./demo-events";
import { isDemoActivated } from "./demo-activation";

export type FunnelStage =
  | "requested"
  | "created"
  | "activated"
  | "qualified"
  | "meeting_booked"
  | "proposal_sent"
  | "converted";

export const FUNNEL_STAGES: FunnelStage[] = [
  "requested",
  "created",
  "activated",
  "qualified",
  "meeting_booked",
  "proposal_sent",
  "converted",
];

const STAGE_ORDER: Record<FunnelStage, number> = {
  requested: 0,
  created: 1,
  activated: 2,
  qualified: 3,
  meeting_booked: 4,
  proposal_sent: 5,
  converted: 6,
};

export interface FunnelStageMetrics {
  stage: FunnelStage;
  label: string;
  exactCount: number;
  cumulativeCount: number;
  stageConversionRate: number; // % converted from previous stage
  dropOffRate: number; // % dropped off from previous stage
  overallConversionRate: number; // % converted from 'requested' stage
}

export interface DemoFunnelReport {
  totalRequested: number;
  totalConverted: number;
  overallConversionRate: number;
  stages: FunnelStageMetrics[];
  calculatedAt: string;
}

const STAGE_LABELS: Record<FunnelStage, string> = {
  requested: "Solicitada",
  created: "Demo Creada",
  activated: "Demo Activada",
  qualified: "Lead Calificado",
  meeting_booked: "Reunión Agendada",
  proposal_sent: "Propuesta Enviada",
  converted: "Cliente Convertido",
};

/**
 * Normalizes a DemoLeadStatus into the canonical FunnelStage hierarchy.
 */
export function mapLeadStatusToFunnelStage(status: DemoLeadStatus): FunnelStage {
  switch (status) {
    case "requested":
      return "requested";
    case "demo_created":
    case "active":
      return "created";
    case "activated":
    case "engaged":
      return "activated";
    case "qualified":
      return "qualified";
    case "meeting_booked":
      return "meeting_booked";
    case "proposal_sent":
      return "proposal_sent";
    case "converted":
      return "converted";
    case "lost":
      return "created"; // Lost drops out of forward progression
    default:
      return "requested";
  }
}

/**
 * Computes full funnel progression and conversion rates for demo leads.
 */
export function getDemoFunnelMetrics(options: {
  leads?: DemoLead[];
  country?: string;
  vertical?: string;
  customLeadsFile?: string;
} = {}): DemoFunnelReport {
  let leads = options.leads ?? listDemoLeads(undefined, options.customLeadsFile);

  if (options.country) {
    leads = leads.filter((l) => l.country === options.country);
  }
  if (options.vertical) {
    leads = leads.filter((l) => l.vertical === options.vertical);
  }

  const exactCounts: Record<FunnelStage, number> = {
    requested: 0,
    created: 0,
    activated: 0,
    qualified: 0,
    meeting_booked: 0,
    proposal_sent: 0,
    converted: 0,
  };

  for (const lead of leads) {
    const stage = mapLeadStatusToFunnelStage(lead.status);
    exactCounts[stage] = (exactCounts[stage] ?? 0) + 1;
  }

  // Cross-verify with activation events if tenant exists
  const events = getTrackedDemoEvents();
  for (const lead of leads) {
    if (lead.demo_tenant_id && exactCounts.activated === 0) {
      if (isDemoActivated(lead.demo_tenant_id, events)) {
        // Upgrade stage index if ahead
        const curStage = mapLeadStatusToFunnelStage(lead.status);
        if (STAGE_ORDER[curStage] < STAGE_ORDER.activated) {
          exactCounts[curStage] = Math.max(0, exactCounts[curStage] - 1);
          exactCounts.activated += 1;
        }
      }
    }
  }

  // Calculate cumulative counts (waterfall: a lead at stage N has reached all stages <= N)
  const cumulativeCounts: Record<FunnelStage, number> = {
    requested: 0,
    created: 0,
    activated: 0,
    qualified: 0,
    meeting_booked: 0,
    proposal_sent: 0,
    converted: 0,
  };

  for (const lead of leads) {
    const currentStage = mapLeadStatusToFunnelStage(lead.status);
    const order = STAGE_ORDER[currentStage];
    for (const stage of FUNNEL_STAGES) {
      if (STAGE_ORDER[stage] <= order) {
        cumulativeCounts[stage] += 1;
      }
    }
  }

  // If requested count is 0 but leads exist, ensure requested matches total leads
  if (cumulativeCounts.requested === 0 && leads.length > 0) {
    cumulativeCounts.requested = leads.length;
  }

  const topCount = cumulativeCounts.requested;
  const stages: FunnelStageMetrics[] = [];

  for (let i = 0; i < FUNNEL_STAGES.length; i++) {
    const stage = FUNNEL_STAGES[i]!;
    const count = cumulativeCounts[stage];
    const prevCount = i === 0 ? count : cumulativeCounts[FUNNEL_STAGES[i - 1]!];

    const stageConversionRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
    const dropOffRate = 100 - stageConversionRate;
    const overallConversionRate = topCount > 0 ? Math.round((count / topCount) * 100) : 0;

    stages.push({
      stage,
      label: STAGE_LABELS[stage],
      exactCount: exactCounts[stage],
      cumulativeCount: count,
      stageConversionRate: i === 0 ? 100 : stageConversionRate,
      dropOffRate: i === 0 ? 0 : Math.max(0, dropOffRate),
      overallConversionRate,
    });
  }

  const totalConverted = cumulativeCounts.converted;
  const overallConversionRate = topCount > 0 ? Math.round((totalConverted / topCount) * 100) : 0;

  return {
    totalRequested: topCount,
    totalConverted,
    overallConversionRate,
    stages,
    calculatedAt: new Date().toISOString(),
  };
}
