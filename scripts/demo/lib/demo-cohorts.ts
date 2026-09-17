/**
 * scripts/demo/lib/demo-cohorts.ts
 *
 * Demo Cohort Analytics Engine.
 * Segments demo performance by country, vertical, or creation month.
 * Computes: demos count, activation rate, meetings count, conversion rate, and estimated MRR.
 * Strictly isolated: never accesses production customer data.
 */

import { listDemoLeads, type DemoLead } from "./demo-leads";
import { isDemoActivated } from "./demo-activation";
import { listDemoDeals, type DemoDeal, type DealCurrency } from "./demo-deals";
import { getTrackedDemoEvents } from "./demo-events";

export type CohortDimension = "country" | "vertical" | "month";

export interface CohortRow {
  dimension: CohortDimension;
  key: string;
  label: string;
  demosCount: number;
  activatedCount: number;
  activationRatePercentage: number;
  meetingsCount: number;
  convertedCount: number;
  conversionRatePercentage: number;
  estimatedMRR: Record<DealCurrency, number>;
  totalDealsWon: number;
}

export interface DemoCohortsReport {
  dimension: CohortDimension;
  cohorts: CohortRow[];
  totalDemos: number;
  totalConverted: number;
  calculatedAt: string;
}

const COUNTRY_LABELS: Record<string, string> = {
  CO: "🇨🇴 Colombia",
  MX: "🇲🇽 México",
  ES: "🇪🇸 España",
  PT: "🇵🇹 Portugal",
  BR: "🇧🇷 Brasil",
  US: "🇺🇸 Estados Unidos",
};

const VERTICAL_LABELS: Record<string, string> = {
  "dental-clinic": "Clínica Dental",
  aesthetic: "Clínica Estética",
  veterinary: "Clínica Veterinaria",
  legal: "Servicios Legales",
  real_estate: "Inmobiliaria",
};

/**
 * Extracts grouping key for a lead given a dimension.
 */
function getCohortKey(lead: DemoLead, dimension: CohortDimension): string {
  switch (dimension) {
    case "country":
      return lead.country?.toUpperCase() || "UNKNOWN";
    case "vertical":
      return lead.vertical || "general";
    case "month":
      if (!lead.created_at) return "UNKNOWN";
      return lead.created_at.slice(0, 7); // "YYYY-MM"
  }
}

function getCohortLabel(key: string, dimension: CohortDimension): string {
  if (dimension === "country") return COUNTRY_LABELS[key] ?? key;
  if (dimension === "vertical") return VERTICAL_LABELS[key] ?? key;
  return key; // YYYY-MM formatted
}

export function computeDemoCohorts(options: {
  dimension?: CohortDimension;
  leads?: DemoLead[];
  deals?: DemoDeal[];
  customLeadsFile?: string;
  customDealsFile?: string;
} = {}): DemoCohortsReport {
  const dimension = options.dimension ?? "month";
  const leads = options.leads ?? listDemoLeads(undefined, options.customLeadsFile);
  const deals = options.deals ?? listDemoDeals({ customFilePath: options.customDealsFile });
  const events = getTrackedDemoEvents();

  // Group leads by cohort key
  const groups: Record<string, DemoLead[]> = {};
  for (const lead of leads) {
    const key = getCohortKey(lead, dimension);
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(lead);
  }

  const cohorts: CohortRow[] = [];

  for (const [key, cohortLeads] of Object.entries(groups)) {
    const demosCount = cohortLeads.length;

    // Activation count
    let activatedCount = 0;
    let meetingsCount = 0;
    let convertedCount = 0;

    const cohortTenantIds = new Set(
      cohortLeads.map((l) => l.demo_tenant_id).filter(Boolean),
    );

    for (const lead of cohortLeads) {
      if (
        lead.status === "activated" ||
        lead.status === "engaged" ||
        lead.status === "meeting_booked" ||
        lead.status === "proposal_sent" ||
        lead.status === "converted" ||
        (lead.demo_tenant_id && isDemoActivated(lead.demo_tenant_id, events))
      ) {
        activatedCount += 1;
      }

      if (
        lead.status === "meeting_booked" ||
        lead.status === "proposal_sent" ||
        lead.status === "converted"
      ) {
        meetingsCount += 1;
      }

      if (lead.status === "converted") {
        convertedCount += 1;
      }
    }

    // Deals won in this cohort
    const cohortDeals = deals.filter(
      (d) => cohortTenantIds.has(d.tenantId) && d.status === "closed_won",
    );

    const estimatedMRR: Record<DealCurrency, number> = {
      BRL: 0,
      COP: 0,
      MXN: 0,
      EUR: 0,
      USD: 0,
    };

    for (const deal of cohortDeals) {
      estimatedMRR[deal.currency] = (estimatedMRR[deal.currency] ?? 0) + deal.value;
    }

    cohorts.push({
      dimension,
      key,
      label: getCohortLabel(key, dimension),
      demosCount,
      activatedCount,
      activationRatePercentage:
        demosCount > 0 ? Math.round((activatedCount / demosCount) * 100) : 0,
      meetingsCount,
      convertedCount,
      conversionRatePercentage:
        demosCount > 0 ? Math.round((convertedCount / demosCount) * 100) : 0,
      estimatedMRR,
      totalDealsWon: cohortDeals.length,
    });
  }

  // Sort chronologically if month, descending count if category
  cohorts.sort((a, b) => {
    if (dimension === "month") return b.key.localeCompare(a.key);
    return b.demosCount - a.demosCount;
  });

  return {
    dimension,
    cohorts,
    totalDemos: leads.length,
    totalConverted: leads.filter((l) => l.status === "converted").length,
    calculatedAt: new Date().toISOString(),
  };
}
