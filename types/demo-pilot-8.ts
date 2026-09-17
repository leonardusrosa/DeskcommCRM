/**
 * types/demo-pilot-8.ts
 *
 * Type definitions for GTM Pilot #8 — Spain Dental Market Replication.
 * Evaluates 100 NEW qualified private dental clinics across Madrid (34),
 * Barcelona (33), and Valencia (33).
 *
 * Validates:
 *   - Playbook replication from Colombia & Mexico to Spain
 *   - European Spanish terminology (gabinete, presupuesto, recepción)
 *   - EUR pricing structure (Starter €49, Pro €99)
 *   - staff_handoff_15min_v1 retention intervention
 *   - Reverse-charge EU billing discovery
 */

export type SpainCity = 'Madrid' | 'Barcelona' | 'Valencia';

export type Pilot8Stage =
  | 'contacted'
  | 'responded'
  | 'demo_requested'
  | 'activated'
  | 'high_intent'
  | 'meeting_booked'
  | 'meeting_attended'
  | 'proposal_sent'
  | 'closed_won'
  | 'closed_lost';

export type IncumbentSoftware =
  | 'gesden'
  | 'infomed_dentool'
  | 'dasi_clinic'
  | 'clinicorp'
  | 'whatsapp_business_only'
  | 'paper_manual';

export type SpainLostReason =
  | 'price'
  | 'no_urgency'
  | 'existing_software'
  | 'whatsapp_workflow_mismatch'
  | 'missing_feature'
  | 'decision_maker_unavailable'
  | 'trust'
  | 'billing_tax'
  | 'onboarding_concern'
  | 'local_supplier_requirement'
  | 'other';

export type ReplicationScorecardStatus =
  | 'REPLICATED'
  | 'STRONGER'
  | 'WEAKER'
  | 'INCONCLUSIVE';

export interface StaffHandoffStep {
  step: number;
  name: string;
  completed: boolean;
  completedAt?: string;
}

export interface StaffHandoffEvent {
  clinicId: string;
  clinicName: string;
  startedAt: string;
  completedAt?: string;
  durationMinutes: number;
  completed: boolean;
  steps: StaffHandoffStep[];
  supportMinutes: number;
  postHandoffRetentionMaintained: boolean;
}

export interface Pilot8ClinicRecord {
  id: string;
  clinic: string;
  city: SpainCity;
  cabinets: number; // gabinetes (2–6)
  phone: string; // +34
  cifNif?: string; // B87654321, etc.
  stage: Pilot8Stage;
  incumbentSoftware: IncumbentSoftware;
  plan?: 'starter' | 'professional';
  mrrEur?: number;
  timeToFirstValueHours?: number;
  firstValueWithin48h?: boolean;
  humanSupportMinutes?: number;
  d7Active?: boolean;
  d14Active?: boolean;
  d30Retained?: boolean;
  lostReason?: SpainLostReason;
  lostExplanation?: string;
  staffHandoff?: StaffHandoffEvent;
  timestamps: Record<string, string | undefined>;
}

export interface FunnelStageScorecard {
  stage: string;
  spainRatePct: number;
  mexicoReferencePct: number;
  differencePp: number;
  status: ReplicationScorecardStatus;
}

export interface Pilot8MetricsReport {
  pilot: 8;
  status: 'COMPLETE' | 'PARTIAL' | 'FAIL';
  market: 'Spain';
  contacted: 100;
  cityBreakdown: Record<SpainCity, { contacted: number; won: number; mrrEur: number }>;
  responses: number;
  responseRatePct: number;
  demoRequests: number;
  demoRequestRatePct: number;
  activations: number;
  activationRatePct: number;
  highIntent: number;
  highIntentRatePct: number;
  meetingsBooked: number;
  meetingBookingRatePct: number;
  meetingsAttended: number;
  attendanceRatePct: number;
  proposalsSent: number;
  proposalRatePct: number;
  closedWon: number;
  closedLost: number;
  closeRatePct: number;
  mrrWonEur: number;
  averageMrrEur: number;
  planMix: { starterPct: number; professionalPct: number };
  medianProposalToDecisionHours: number;
  medianTimeToFirstValueHours: number;
  firstValueWithin48hPct: number;
  humanSupportMinutesPerCustomer: number;
  d7ActivePct: number;
  d14ActivePct: number;
  d30RetentionPct: number;
  d60RetentionStatus: 'PENDING';
  billingTaxBlockedDeals: number;
  topLostReason: string;
  topSpainLocalizationDifference: string;
  staffHandoffMetrics: {
    eventsCount: number;
    completionRatePct: number;
    averageDurationMinutes: number;
    supportMinutesTotal: number;
    validationResult: 'IMPROVED' | 'UNCHANGED' | 'REGRESSED' | 'INCONCLUSIVE';
  };
  scorecard: FunnelStageScorecard[];
  spainPlaybookResult: 'REPLICATED' | 'PARTIALLY REPLICATED' | 'NOT REPLICATED' | 'INCONCLUSIVE';
  nextSingleBottleneck: string;
  portugalStatus: 'NOT STARTED';
  productionSafetyIncidents: 'NONE';
  engineeringFreezeViolations: 'NONE';
}
