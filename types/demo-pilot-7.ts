/**
 * types/demo-pilot-7.ts
 *
 * Type definitions for GTM Pilot #7 — Mexico Controlled Commercial Scale (300 Clinics).
 * Covers acquisition, full funnel, billing routing (Routes A–E), activation,
 * operational retention cohorts (D7, D14, D30, D60), churn analysis,
 * Colombia reference comparison, and international expansion decision gates.
 */

export type MexicoCity = 'CDMX' | 'Guadalajara' | 'Monterrey';

export type Pilot7Stage =
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

export type BillingRoute =
  | 'A_no_document'
  | 'B_foreign_receipt_accepted'
  | 'C_tax_memo_escalated'
  | 'D_cfdi_blocked'
  | 'E_local_supplier_blocked';

export type ChurnReason =
  | 'low_usage'
  | 'whatsapp_issue'
  | 'agenda_issue'
  | 'staff_adoption'
  | 'missing_feature'
  | 'price'
  | 'billing_fiscal'
  | 'business_closure'
  | 'switched_software'
  | 'support'
  | 'other';

export interface Pilot7ClinicRecord {
  id: string;
  clinic: string;
  city: MexicoCity;
  chairs: number;
  whatsapp: string;
  stage: Pilot7Stage;
  billingRoute?: BillingRoute;
  plan?: 'starter' | 'professional';
  mrr?: number;
  timeToFirstValueHours?: number;
  firstValueWithin24h?: boolean;
  firstValueWithin48h?: boolean;
  humanSupportMinutes?: number;
  d7Active?: boolean;
  d14Active?: boolean;
  d30Retained?: boolean;
  d60Retained?: boolean;
  churned?: boolean;
  churnReason?: ChurnReason;
  churnExplanation?: string;
  timestamps: Record<string, string | undefined>;
}

export interface Pilot7FunnelMetrics {
  contacted: 300;
  responded: number;
  responseRatePct: number;
  demoRequested: number;
  demoRequestRatePct: number;
  activated: number;
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
  totalMrrMxn: number;
  averageMrrMxn: number;
  planMix: { starterPct: number; professionalPct: number };
  medianSalesCycleHours: number;
}

export interface Pilot7BillingMetrics {
  fiscalDocRequired: number;
  foreignReceiptsIssued: number;
  foreignReceiptsAccepted: number;
  taxMemoEscalations: number;
  cfdiBlockedCustomers: number;
  localSupplierBlockedCustomers: number;
  mrrUnlockedForeignReceipt: number;
  mrrBlockedCfdi: number;
  mrrBlockedLocalSupplier: number;
  cfdiEconomicGate: 'BELOW' | 'REACHED';
  cfdiThresholdMxn: number;
  avgBillingApprovalTimeHours: number;
}

export interface Pilot7ActivationRetentionMetrics {
  medianTimeToFirstValueHours: number;
  firstValueWithin24hPct: number;
  firstValueWithin48hPct: number;
  humanSupportMinutesPerCustomer: number;
  whatsappConnectionPct: number;
  agendaConfigurationPct: number;
  teamSetupPct: number;
  d7ActivePct: number;
  d14ActivePct: number;
  d30RetentionPct: number;
  d60RetentionPct: number | null;
  topChurnReason: ChurnReason | null;
}

export interface Pilot7DecisionGates {
  acquisition: 'HEALTHY' | 'NEEDS_WORK';
  sales: 'HEALTHY' | 'NEEDS_WORK';
  billing: 'HEALTHY' | 'NEEDS_WORK';
  activation: 'HEALTHY' | 'NEEDS_WORK';
  d30Retention: 'HEALTHY' | 'NEEDS_WORK' | 'INCONCLUSIVE';
  supportScalability: 'HEALTHY' | 'NEEDS_WORK';
  mexicoScaleResult: 'HEALTHY' | 'NEEDS_WORK' | 'INCONCLUSIVE';
  nextSingleBottleneck: string;
  spainPortugalExpansion: 'NOT YET' | 'READY FOR DECISION';
  nativeCfdi: 'DEFERRED' | 'REASSESS';
}

export interface ColombiaComparisonMetricRow {
  metric: string;
  mexicoValue: string;
  colombiaValue: string;
  status: 'AHEAD' | 'ON_PAR' | 'LAGGING';
}

export interface Pilot7FullReport {
  pilot: 7;
  status: 'COMPLETE' | 'PARTIAL' | 'FAIL';
  funnel: Pilot7FunnelMetrics;
  billing: Pilot7BillingMetrics;
  activationRetention: Pilot7ActivationRetentionMetrics;
  decisionGates: Pilot7DecisionGates;
  colombiaComparison: ColombiaComparisonMetricRow[];
  cityBreakdown: Record<MexicoCity, { contacted: number; won: number; mrrMxn: number }>;
  churnBreakdown: Partial<Record<ChurnReason, number>>;
  productionSafetyIncidents: 'NONE';
  engineeringFreezeViolations: 'NONE';
}
