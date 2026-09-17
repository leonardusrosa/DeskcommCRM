/**
 * types/demo-pilot-9.ts
 *
 * Type definitions for GTM Pilot #9 — Portugal Dental Market Replication.
 * Evaluates 100 NEW qualified private dental clinics across Lisboa (34),
 * Porto (33), and Braga (33).
 *
 * Validates:
 *   - Lead qualification data with legitimate public business info
 *   - European Portuguese outreach copy and terminology
 *   - WhatsApp-led acquisition, guided_48h_v1 onboarding, and staff_handoff_15min_v1
 *   - NewSoft NDent / Gesden PMS coexistence discovery
 *   - Cross-border EU reverse-charge billing discovery
 */

export type PortugalCity = 'Lisboa' | 'Porto' | 'Braga';

export type ClinicType =
  | 'independent'
  | 'multi_location'
  | 'small_group'
  | 'franchise_chain';

export type Pilot9Stage =
  | 'contacted'
  | 'responded'
  | 'demo_requested'
  | 'demo_created'
  | 'first_login'
  | 'activated'
  | 'high_intent'
  | 'meeting_booked'
  | 'meeting_attended'
  | 'proposal_sent'
  | 'closed_won'
  | 'closed_lost';

export type ResponseType =
  | 'interested'
  | 'curious'
  | 'not_now'
  | 'no_interest'
  | 'wrong_contact'
  | 'existing_solution'
  | 'price_concern'
  | 'other';

export type PortugalLostReason =
  | 'price'
  | 'no_urgency'
  | 'existing_software'
  | 'missing_integration'
  | 'whatsapp_mismatch'
  | 'decision_maker_unavailable'
  | 'billing_tax'
  | 'trust'
  | 'onboarding'
  | 'local_supplier'
  | 'other';

export type ReplicationStatus = 'REPLICATED' | 'STRONGER' | 'WEAKER' | 'INCONCLUSIVE';

export interface Pilot9ClinicRecord {
  id: string;
  clinic: string;
  city: PortugalCity;
  website: string;
  phone: string; // +351 ...
  whatsapp: string;
  email: string;
  instagram: string;
  clinicType: ClinicType;
  chairs: number; // 2–6
  dentistsCount: number;
  onlineBookingSignal: boolean;
  pmsSignal: string; // e.g. "NewSoft NDent", "Gesden", "ClinicWeb"
  personalizationNote: string;
  sourceUrl: string;
  outreachStatus: 'sent' | 'responded' | 'ignored';
  stage: Pilot9Stage;
  responseType?: ResponseType;
  plan?: 'starter' | 'professional';
  mrrEur?: number;
  timeToFirstValueHours?: number;
  firstValueWithin24h?: boolean;
  firstValueWithin48h?: boolean;
  firstValueWithin72h?: boolean;
  humanSupportMinutes?: number;
  d7Active?: boolean;
  d14Active?: boolean;
  d30Retained?: boolean;
  lostReason?: PortugalLostReason;
  lostExplanation?: string;
  pmsCoexistenceRequired?: boolean;
  pmsIntegrationRequested?: boolean;
  pmsIntegrationBlockedSale?: boolean;
  nif?: string;
  staffHandoff?: {
    completed: boolean;
    durationMinutes: number;
    supportMinutes: number;
  };
  timestamps: Record<string, string | undefined>;
}

export interface FunnelStageComparison {
  stage: string;
  portugalRatePct: number;
  spainReferencePct: number;
  mexicoReferencePct: number;
  status: ReplicationStatus;
}

export interface Pilot9MetricsReport {
  pilot: 9;
  status: 'COMPLETE' | 'PARTIAL' | 'FAIL';
  market: 'Portugal';
  contacted: 100;
  cityBreakdown: Record<PortugalCity, { contacted: number; won: number; mrrEur: number }>;
  responses: number;
  responseRatePct: number;
  demoRequests: number;
  demoRequestRatePct: number;
  activations: number;
  activationRatePct: number;
  highIntent: number;
  highIntentRatePct: number;
  meetingsBooked: number;
  highIntentToMeetingRatePct: number;
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
  meanTimeToFirstValueHours: number;
  p75TimeToFirstValueHours: number;
  firstValueWithin24hPct: number;
  firstValueWithin48hPct: number;
  firstValueWithin72hPct: number;
  humanSupportMinutesPerCustomer: number;
  d7ActivePct: number;
  d14ActivePct: number;
  d30RetentionPct: number;
  d60RetentionStatus: 'PENDING';
  billingTaxBlocked: number;
  pmsCoexistenceRequests: number;
  pmsIntegrationBlocked: number;
  topExistingPms: string;
  topLostReason: string;
  topPortugalLocalizationDifference: string;
  staffHandoffMetrics: {
    eventsCount: number;
    completionRatePct: number;
    averageDurationMinutes: number;
    supportMinutesTotal: number;
  };
  scorecard: FunnelStageComparison[];
  portugalPlaybookResult: 'REPLICATED' | 'PARTIALLY REPLICATED' | 'NOT REPLICATED' | 'INCONCLUSIVE';
  nextSingleBottleneck: string;
  productChangesRequired: 'NONE';
  productionSupabaseTouched: 'NO';
  productionSafetyIncidents: 'NONE';
  engineeringFreezeViolations: 'NONE';
}
