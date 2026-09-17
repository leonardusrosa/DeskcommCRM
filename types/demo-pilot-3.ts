/**
 * types/demo-pilot-3.ts
 *
 * Types for GTM Pilot #3 — Colombia Dental Proposal Consensus Validation.
 */

export type Pilot3ProposalFlow = "standard_v1" | "consensus_assisted_v1";

export interface Pilot3ProposalRecord {
  id: string;
  clinic: string;
  city: "Bogotá" | "Medellín" | "Cali";
  chairs: number;
  chair_tier: "2-3 chairs" | "4-6 chairs";
  number_of_decision_makers: number;
  attendee_is_final_decision_maker: boolean;
  proposal_flow: Pilot3ProposalFlow;
  proposal_sent_at: string;
  proposal_opened_at?: string;
  proposal_shared: boolean;
  proposal_shared_at?: string;
  decision_makers_reached: number;
  roi_summary_viewed: boolean;
  proposal_question: boolean;
  proposal_approved: boolean;
  proposal_declined: boolean;
  closed_won: boolean;
  closed_lost: boolean;
  closed_at?: string;
  decision_hours: number;
  mrr: number;
  loss_reason?: "no_decision_timeout" | "budget_constraint" | "preferred_existing_system" | "partner_veto";
  status: "closed_won" | "closed_lost" | "no_decision";
}

export interface ConsensusProposalPackage {
  clinicSummary: {
    clinicName: string;
    city: string;
    dentistsCount: number;
    chairsCount: number;
    operationalProblem: string;
  };
  roiSummary: {
    averageAppointmentValueCop: number;
    estimatedMissedPerMonth: number;
    recoverableAppointmentsPerMonth: number;
    estimatedHoursSavedPerMonth: number;
    estimatedNetMonthlyImpactCop: number;
    disclaimer: string;
  };
  deskcommRecommendation: {
    recommendedPlan: "Starter" | "Professional";
    monthlyPriceCop: number;
    coreFeatures: string[];
    implementationSteps: string[];
  };
  decisionMakerSummary: {
    centralizedCapabilities: string[];
    monthlyInvestmentCop: number;
    expectedOperationalBenefit: string;
    forwardableText: string;
  };
  shareCta: {
    label: string;
    action: "share_with_partners";
  };
  decisionCta: {
    options: Array<{
      label: "Aprobar" | "Tengo una pregunta" | "No seguir";
      outcome: "approve" | "question" | "decline";
    }>;
  };
}

export interface ProposalCohortMetrics {
  totalProposals: number;
  openedCount: number;
  openRatePct: number;
  sharedCount: number;
  shareRatePct: number;
  multiDecisionMakerDeals: number;
  fullStakeholderCoverageCount: number;
  fullStakeholderCoveragePct: number;
  decisionsReceived: number;
  explicitDecisionRatePct: number;
  closedWon: number;
  closedLost: number;
  closeRatePct: number;
  noDecisionCount: number;
  noDecisionRatePct: number;
  totalMrrWonCop: number;
  avgMrrWonCustomerCop: number;
  avgProposalToDecisionHours: number;
  medianProposalToDecisionHours: number;
  p75ProposalToDecisionHours: number;
}

export interface Pilot3MetricsReport {
  totalProposals: number;
  controlProposals: number;
  treatmentProposals: number;
  control: ProposalCohortMetrics;
  treatment: ProposalCohortMetrics;
  velocityChangeHours: number;
  velocityChangePct: number;
  sampleSizeWarning: boolean;
  sampleSizeWarningDetails: string;
  consensusFlowResult: "IMPROVED" | "UNCHANGED" | "REGRESSED" | "INCONCLUSIVE";
  nextSingleBottleneck: string;
  productionSupabaseTouched: boolean;
  engineeringFreezeViolations: string;
  segmentation: {
    byCity: Record<string, { total: number; won: number }>;
    byChairs: Record<string, { total: number; won: number; medianHours: number }>;
    byDecisionMakers: Record<string, { total: number; fullCoveragePct: number; medianHours: number }>;
  };
}
