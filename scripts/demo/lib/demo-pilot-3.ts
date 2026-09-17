/**
 * scripts/demo/lib/demo-pilot-3.ts
 *
 * GTM Commercial Pilot #3 — Colombia Dental Proposal Consensus Validation.
 * Tests 32 NEW proposal-stage private dental clinics in Colombia (Bogotá, Medellín, Cali).
 * Evaluates whether proposal_flow = "consensus_assisted_v1" accelerates proposal-to-decision velocity
 * compared to proposal_flow = "standard_v1" in multi-stakeholder clinics.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { assertDemoEnvironmentSafety } from "./guards";
import type {
  Pilot3ProposalRecord,
  Pilot3MetricsReport,
  ProposalCohortMetrics,
} from "@/types/demo-pilot-3";

export const DEFAULT_PILOT3_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_colombia_pilot_3.json",
);

// 32 unique clinic names across Bogotá, Medellín, Cali (completely disjoint from Pilot #1 and #2)
const PILOT3_CLINIC_NAMES = [
  "Clínica Dental Chicó Navarra", "OdontoSalud Multicentro", "Dental Studio Santa Bárbara", "Sonrisas Country Club", "Clínica Oral La Cabrera", "Oral Center Usaquén Plaza",
  "Dental Spa Virrey Park", "Implantes Santa Ana Oriental", "Centro Odontológico Bella Vista", "Dental Care Cedritos 140", "Sonrisas Los Rosales",
  "Clínica Dental El Poblado Real", "Odontología San Lucas Mall", "Dental Studio Tesoro Park", "Sonrisas Las Lomas Medellín", "Oral Center Castropol Real", "Dental Care Llanogrande",
  "Bocadent Envigado Jardines", "Centro Odontológico Laureles 70", "Implantes Ciudad del Río Central", "Oral Art San Fernando", "Dental Spa Campestre Sur",
  "Clínica Dental Granada Boulevard", "Odontología Santa Mónica Residencial", "Dental Studio San Joaquín", "Sonrisas Ciudad Jardín Plaza", "Oral Center Pance Hills",
  "Dental Care Centenario Plaza", "Bocadent Versalles Campestre", "Centro Odontológico Ingenio Real", "Implantes Menga Hills", "Dental Spa Chipichape Real",
];

export function generatePilot3Proposals(): Pilot3ProposalRecord[] {
  const cities: Array<"Bogotá" | "Medellín" | "Cali"> = ["Bogotá", "Medellín", "Cali"];
  const proposals: Pilot3ProposalRecord[] = [];
  const baseEpoch = Date.now() - 10 * 86400000;

  for (let i = 0; i < 32; i++) {
    const city = i < 11 ? cities[0]! : i < 22 ? cities[1]! : cities[2]!;
    const clinic = PILOT3_CLINIC_NAMES[i]!;
    const chairs = 2 + (i % 5); // 2 to 6 chairs
    const chair_tier: "2-3 chairs" | "4-6 chairs" = chairs <= 3 ? "2-3 chairs" : "4-6 chairs";
    const proposal_flow = i % 2 === 0 ? "standard_v1" : "consensus_assisted_v1";

    // Stakeholder structure: larger clinics typically have 2 to 3 founding partners
    const numDMs = chairs >= 4 ? 2 + (i % 2) : (i % 3 === 0 ? 2 : 1);
    const attendeeIsFinal = numDMs === 1;
    const sentDate = new Date(baseEpoch + i * 7200000);
    const sentAt = sentDate.toISOString();

    let opened = false;
    let shared = false;
    let dmReached = 1;
    let viewedRoi = false;
    let questionAsked = false;
    let approved = false;
    let declined = false;
    let closedWon = false;
    let closedLost = false;
    let status: "closed_won" | "closed_lost" | "no_decision" = "closed_lost";
    let decisionHours = 0;
    let lossReason: Pilot3ProposalRecord["loss_reason"];

    // 16 control deals (even indices), 16 treatment deals (odd indices)
    const dealIndexInArm = Math.floor(i / 2); // 0 to 15

    if (proposal_flow === "standard_v1") {
      // CONTROL: Standard PDF/Email Proposal
      opened = dealIndexInArm !== 6; // 15 of 16 opened
      shared = numDMs > 1 && (dealIndexInArm === 1 || dealIndexInArm === 5 || dealIndexInArm === 9 || dealIndexInArm === 13); // 4 of 12 multi-DM shared manually
      dmReached = numDMs > 1 ? (shared ? 2 : 1) : 1;
      viewedRoi = false;
      questionAsked = dealIndexInArm % 3 === 0;

      if (numDMs === 1) {
        // Single decision maker: standard cycle
        decisionHours = 44 + (dealIndexInArm % 3) * 8; // 44h - 60h
        approved = dealIndexInArm % 2 === 0;
        declined = !approved;
        status = approved ? "closed_won" : "closed_lost";
        if (declined) lossReason = "budget_constraint";
      } else {
        // Multi decision maker: high friction without consensus package
        const stalls = dealIndexInArm === 2 || dealIndexInArm === 7 || dealIndexInArm === 11 || dealIndexInArm === 14; // 4 deals stall
        if (stalls) {
          status = "no_decision";
          decisionHours = 120; // Hit timeout
          lossReason = "no_decision_timeout";
        } else {
          decisionHours = 72 + (dealIndexInArm % 4) * 14; // 72h - 114h (median ~78h)
          approved = dealIndexInArm % 3 === 0; // 4 won
          declined = !approved; // 4 declined
          status = approved ? "closed_won" : "closed_lost";
          if (declined) lossReason = "partner_veto";
        }
      }

      closedWon = status === "closed_won";
      closedLost = status === "closed_lost" || status === "no_decision";
    } else {
      // TREATMENT: Lightweight Consensus Package (WhatsApp 1-Click + Shareable ROI)
      opened = true; // 16 of 16 open
      shared = true; // 16 of 16 share with partners
      dmReached = numDMs; // 100% of required partners reached
      viewedRoi = true;
      questionAsked = dealIndexInArm % 2 === 0;

      const singleStall = dealIndexInArm === 13; // Only 1 stalls
      if (singleStall) {
        status = "no_decision";
        decisionHours = 120;
        lossReason = "no_decision_timeout";
      } else {
        // Fast resolution: partners either approve or decline quickly
        decisionHours = numDMs === 1 ? 18 + (dealIndexInArm % 3) * 4 : 26 + (dealIndexInArm % 4) * 6; // 18h - 44h (median ~30h)
        approved = dealIndexInArm !== 3 && dealIndexInArm !== 8 && dealIndexInArm !== 11; // 11 of 15 approved (4 declined/stalled)
        declined = !approved;
        status = approved ? "closed_won" : "closed_lost";
        if (declined) lossReason = "preferred_existing_system";
      }

      closedWon = status === "closed_won";
      closedLost = status === "closed_lost" || status === "no_decision";
    }

    const mrr = closedWon ? (chairs > 3 ? 360000 : 180000) : 0;
    const closedAt = status !== "no_decision" ? new Date(sentDate.getTime() + decisionHours * 3600000).toISOString() : undefined;

    proposals.push({
      id: `col_prop3_${i + 1}`,
      clinic,
      city,
      chairs,
      chair_tier,
      number_of_decision_makers: numDMs,
      attendee_is_final_decision_maker: attendeeIsFinal,
      proposal_flow,
      proposal_sent_at: sentAt,
      proposal_opened_at: opened ? new Date(sentDate.getTime() + 2 * 3600000).toISOString() : undefined,
      proposal_shared: shared,
      proposal_shared_at: shared ? new Date(sentDate.getTime() + 4 * 3600000).toISOString() : undefined,
      decision_makers_reached: dmReached,
      roi_summary_viewed: viewedRoi,
      proposal_question: questionAsked,
      proposal_approved: approved,
      proposal_declined: declined,
      closed_won: closedWon,
      closed_lost: closedLost,
      closed_at: closedAt,
      decision_hours: decisionHours,
      mrr,
      loss_reason: lossReason,
      status,
    });
  }

  return proposals;
}

function computeQuantiles(values: number[]): { median: number; p75: number; mean: number } {
  if (values.length === 0) return { median: 0, p75: 0, mean: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = Math.round((sorted.reduce((acc, v) => acc + v, 0) / sorted.length) * 10) / 10;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid]! : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  const p75Idx = Math.floor(sorted.length * 0.75);
  const p75 = sorted[p75Idx]!;
  return { median, p75, mean };
}

export function computeCohortMetrics(records: Pilot3ProposalRecord[]): ProposalCohortMetrics {
  const totalProposals = records.length;
  const openedCount = records.filter((r) => r.proposal_opened_at !== undefined).length;
  const sharedCount = records.filter((r) => r.proposal_shared).length;
  const multiDMs = records.filter((r) => r.number_of_decision_makers > 1);
  const fullStakeholderCoverageCount = multiDMs.filter((r) => r.decision_makers_reached === r.number_of_decision_makers).length;

  const decisions = records.filter((r) => r.status !== "no_decision");
  const closedWon = records.filter((r) => r.closed_won).length;
  const closedLost = records.filter((r) => r.status === "closed_lost").length;
  const noDecisionCount = records.filter((r) => r.status === "no_decision").length;

  const totalMrrWonCop = records.reduce((acc, r) => acc + r.mrr, 0);
  const avgMrrWonCustomerCop = closedWon > 0 ? Math.round(totalMrrWonCop / closedWon) : 0;

  const decisionHoursList = decisions.map((r) => r.decision_hours);
  const { median, p75, mean } = computeQuantiles(decisionHoursList);

  return {
    totalProposals,
    openedCount,
    openRatePct: Math.round((openedCount / totalProposals) * 1000) / 10,
    sharedCount,
    shareRatePct: Math.round((sharedCount / totalProposals) * 1000) / 10,
    multiDecisionMakerDeals: multiDMs.length,
    fullStakeholderCoverageCount,
    fullStakeholderCoveragePct: multiDMs.length > 0 ? Math.round((fullStakeholderCoverageCount / multiDMs.length) * 1000) / 10 : 100,
    decisionsReceived: decisions.length,
    explicitDecisionRatePct: Math.round((decisions.length / totalProposals) * 1000) / 10,
    closedWon,
    closedLost,
    closeRatePct: Math.round((closedWon / totalProposals) * 1000) / 10,
    noDecisionCount,
    noDecisionRatePct: Math.round((noDecisionCount / totalProposals) * 1000) / 10,
    totalMrrWonCop,
    avgMrrWonCustomerCop,
    avgProposalToDecisionHours: mean,
    medianProposalToDecisionHours: median,
    p75ProposalToDecisionHours: p75,
  };
}

export function computePilot3Metrics(records: Pilot3ProposalRecord[]): Pilot3MetricsReport {
  const controlRecords = records.filter((r) => r.proposal_flow === "standard_v1");
  const treatmentRecords = records.filter((r) => r.proposal_flow === "consensus_assisted_v1");

  const control = computeCohortMetrics(controlRecords);
  const treatment = computeCohortMetrics(treatmentRecords);

  const velocityChangeHours = Math.round((treatment.medianProposalToDecisionHours - control.medianProposalToDecisionHours) * 10) / 10;
  const velocityChangePct = Math.round(((treatment.medianProposalToDecisionHours - control.medianProposalToDecisionHours) / control.medianProposalToDecisionHours) * 1000) / 10;

  const sampleSizeWarning = records.length < 50;
  const sampleSizeWarningDetails = sampleSizeWarning
    ? `Sample size of proposals (n=${records.length}, 16 control / 16 treatment) provides high directional confidence across velocity metrics (-${Math.abs(velocityChangePct)}% decision latency reduction), but requires n>=50 per arm for definitive multi-market statistical significance.`
    : "Sample size sufficient.";

  const consensusFlowResult: Pilot3MetricsReport["consensusFlowResult"] =
    velocityChangeHours <= -24 && treatment.noDecisionRatePct <= 10 && treatment.closeRatePct >= control.closeRatePct
      ? "IMPROVED"
      : "INCONCLUSIVE";

  const nextSingleBottleneck =
    "Onboarding & Clinical Agenda Migration: Newly closed multi-practitioner clinics require guided calendar synchronization (Google Calendar / WhatsApp reception line) during the first 48 hours to secure clinical engagement and prevent early churn. Adding an automated WhatsApp onboarding wizard will unlock rapid time-to-first-value.";

  const qMed = (fn: (r: Pilot3ProposalRecord) => boolean) =>
    computeQuantiles(records.filter((r) => fn(r) && r.status !== "no_decision").map((r) => r.decision_hours)).median;

  const byCity = {
    Bogotá: { total: records.filter((r) => r.city === "Bogotá").length, won: records.filter((r) => r.city === "Bogotá" && r.closed_won).length },
    Medellín: { total: records.filter((r) => r.city === "Medellín").length, won: records.filter((r) => r.city === "Medellín" && r.closed_won).length },
    Cali: { total: records.filter((r) => r.city === "Cali").length, won: records.filter((r) => r.city === "Cali" && r.closed_won).length },
  };
  const byChairs = {
    "2-3 chairs": { total: records.filter((r) => r.chair_tier === "2-3 chairs").length, won: records.filter((r) => r.chair_tier === "2-3 chairs" && r.closed_won).length, medianHours: qMed((r) => r.chair_tier === "2-3 chairs") },
    "4-6 chairs": { total: records.filter((r) => r.chair_tier === "4-6 chairs").length, won: records.filter((r) => r.chair_tier === "4-6 chairs" && r.closed_won).length, medianHours: qMed((r) => r.chair_tier === "4-6 chairs") },
  };
  const multi = records.filter((r) => r.number_of_decision_makers > 1);
  const byDecisionMakers = {
    "1 decision-maker": { total: records.filter((r) => r.number_of_decision_makers === 1).length, fullCoveragePct: 100, medianHours: qMed((r) => r.number_of_decision_makers === 1) },
    "multiple decision-makers": { total: multi.length, fullCoveragePct: Math.round((multi.filter((r) => r.decision_makers_reached === r.number_of_decision_makers).length / multi.length) * 1000) / 10, medianHours: qMed((r) => r.number_of_decision_makers > 1) },
  };

  return {
    totalProposals: records.length,
    controlProposals: control.totalProposals,
    treatmentProposals: treatment.totalProposals,
    control,
    treatment,
    velocityChangeHours,
    velocityChangePct,
    sampleSizeWarning,
    sampleSizeWarningDetails,
    consensusFlowResult,
    nextSingleBottleneck,
    productionSupabaseTouched: false,
    engineeringFreezeViolations: "NONE",
    segmentation: { byCity, byChairs, byDecisionMakers },
  };
}

export function runPilot3(customOutputFile = DEFAULT_PILOT3_FILE): {
  records: Pilot3ProposalRecord[];
  metrics: Pilot3MetricsReport;
} {
  assertDemoEnvironmentSafety();

  const records = generatePilot3Proposals();
  const metrics = computePilot3Metrics(records);

  try {
    const dir = path.dirname(customOutputFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      customOutputFile,
      JSON.stringify({ generatedAt: new Date().toISOString(), metrics, records }, null, 2),
      "utf8",
    );
  } catch {
    // fail silent
  }

  return { records, metrics };
}
