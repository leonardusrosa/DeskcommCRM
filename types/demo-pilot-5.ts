/**
 * types/demo-pilot-5.ts
 *
 * Types for GTM Pilot #5 — Mexico Dental Market Replication.
 */

export type MexicoCity = "CDMX" | "Guadalajara" | "Monterrey";

export type MexicoLostReason =
  | "price"
  | "no_urgency"
  | "existing_software"
  | "whatsapp_workflow_mismatch"
  | "missing_feature"
  | "decision_maker_unavailable"
  | "trust"
  | "onboarding_concern"
  | "integration_requirement"
  | "other";

export interface Pilot5ClinicRecord {
  id: string;
  clinic: string;
  city: MexicoCity;
  contactPerson: string;
  whatsapp: string;
  chairs: number;
  chair_tier: "2-3 chairs" | "4-6 chairs";
  plan: "Starter" | "Professional";
  mrr_mxn: number;
  outreach_contacted: boolean;
  response: boolean;
  demo_requested: boolean;
  demo_activated: boolean;
  high_intent: boolean;
  meeting_link_presented: boolean;
  meeting_booked: boolean;
  meeting_attended: boolean;
  proposal_sent: boolean;
  proposal_flow: "consensus_assisted_v1";
  decision_received: boolean;
  closed_won: boolean;
  closed_lost: boolean;
  loss_reason?: MexicoLostReason;
  loss_reason_raw?: string;
  onboarding_started: boolean;
  first_value_reached: boolean;
  hours_to_first_value: number;
  day_7_active: boolean;
  day_14_active: boolean;
  day_30_retained: "pending";
  support_human_minutes: number;
  timestamps: Record<string, string | undefined> & { outreach: string };
}

export interface FunnelStageScorecard {
  stage: string;
  mexicoRatePct: number;
  colombiaRatePct: number;
  absoluteDiffPp: number;
  relativeDiffPct: number;
  sample: number;
  status: "REPLICATED" | "STRONGER" | "WEAKER" | "INCONCLUSIVE";
}

export interface Pilot5MetricsReport {
  totalClinicsContacted: number;
  cityBreakdown: Record<MexicoCity, { contacted: number; won: number }>;
  responses: number;
  responseRatePct: number;
  demoRequests: number;
  demoRequestRatePct: number;
  demoActivations: number;
  demoActivationRatePct: number;
  highIntentCount: number;
  highIntentRatePct: number;
  meetingsBooked: number;
  highIntentToMeetingRatePct: number;
  meetingsAttended: number;
  meetingAttendanceRatePct: number;
  proposalsSent: number;
  proposalRatePct: number;
  closedWon: number;
  closedLost: number;
  closeRatePct: number;
  mrrWonMxn: number;
  avgMrrMxn: number;
  planMix: { starterPct: number; professionalPct: number };
  medianProposalToDecisionHours: number;
  medianTimeToFirstValueHours: number;
  firstValueWithin48hPct: number;
  humanSupportMinutesPerCustomer: number;
  day7ActivePct: number;
  day14ActivePct: number;
  day30RetentionStatus: "PENDING";
  // Parallel track Colombia D30 retention from Pilot #4
  colombiaParallelTrack: {
    controlD30RetentionPct: number;
    guidedD30RetentionPct: number;
  };
  topLostReason: string;
  topLocalizationDifference: string;
  mexicoPlaybookResult: "REPLICATED" | "PARTIALLY REPLICATED" | "NOT REPLICATED" | "INCONCLUSIVE";
  scorecard: FunnelStageScorecard[];
  nextSingleBottleneck: string;
  productChangesRequired: string;
  productionSafetyIncidents: string;
  engineeringFreezeViolations: string;
}
