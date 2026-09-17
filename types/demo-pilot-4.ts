/**
 * types/demo-pilot-4.ts
 *
 * Types for GTM Pilot #4 — Colombia Dental Customer Activation & Time-to-First-Value.
 */

export type OnboardingFlow = "manual_v1" | "guided_48h_v1";

export type BlockerType =
  | "credentials"
  | "whatsapp"
  | "google_oauth"
  | "staff_availability"
  | "data_migration"
  | "agenda_config"
  | "training"
  | "unclear_ux"
  | "none";

export type PerceivedValueCategory =
  | "WhatsApp organization"
  | "Agenda"
  | "Google Calendar"
  | "team visibility"
  | "follow-up"
  | "patient history"
  | "other";

export interface OnboardingStepsTracking {
  clinic_setup_completed: boolean;
  clinic_setup_at?: string;
  team_invite_sent: boolean;
  team_member_joined: boolean;
  team_setup_completed: boolean;
  team_setup_at?: string;
  whatsapp_setup_started: boolean;
  whatsapp_connected: boolean;
  whatsapp_connected_at?: string;
  first_real_conversation: boolean;
  first_real_conversation_at?: string;
  agenda_setup_started: boolean;
  agenda_configured: boolean;
  agenda_configured_at?: string;
  google_connect_started: boolean;
  google_connected: boolean;
  google_connected_at?: string;
  first_real_appointment_created: boolean;
  first_real_appointment_at?: string;
}

export interface CustomerSupportTracking {
  onboarding_calls_count: number;
  support_messages_count: number;
  manual_interventions_count: number;
  total_human_minutes: number;
}

export interface BlockerTracking {
  type: BlockerType;
  started_at: string;
  resolved_at?: string;
  resolution_minutes: number;
}

export interface Pilot4CustomerRecord {
  id: string;
  clinic: string;
  city: "Bogotá" | "Medellín" | "Cali";
  chairs: number;
  chair_tier: "2-3 chairs" | "4-6 chairs";
  plan: "Starter" | "Professional";
  mrr: number;
  proposal_flow: "consensus_assisted_v1";
  onboarding_flow: OnboardingFlow;
  closed_won_at: string;
  expected_users: number;
  activated_users: number;
  steps: OnboardingStepsTracking;
  first_value_reached: boolean;
  first_value_at?: string;
  hours_to_first_value: number;
  day3_active: boolean;
  day7_active: boolean;
  day14_active: boolean;
  day30_retention: "pending";
  support: CustomerSupportTracking;
  blocker?: BlockerTracking;
  perceived_value_raw?: string;
  perceived_value_category?: PerceivedValueCategory;
  risk_signals: string[];
}

export interface OnboardingCohortMetrics {
  totalCustomers: number;
  firstValueCount: number;
  firstValueRatePct: number;
  medianHoursToFirstValue: number;
  meanHoursToFirstValue: number;
  p75HoursToFirstValue: number;
  firstValueWithin24hCount: number;
  firstValueWithin24hPct: number;
  firstValueWithin48hCount: number;
  firstValueWithin48hPct: number;
  firstValueWithin72hCount: number;
  firstValueWithin72hPct: number;
  // Step-level completion rates
  teamSetupRatePct: number;
  whatsappConnectionRatePct: number;
  agendaConfigurationRatePct: number;
  googleCalendarConnectionRatePct: number;
  // Engagement & Activity
  day3ActivationPct: number;
  day7ActivePct: number;
  day14ActivePct: number;
  day30RetentionStatus: "PENDING";
  // Support burden
  totalHumanMinutes: number;
  humanMinutesPerCustomer: number;
  topBlocker: string;
  topFirstValueMoment: string;
}

export interface Pilot4MetricsReport {
  totalNewCustomers: number;
  controlCustomers: number;
  treatmentCustomers: number;
  control: OnboardingCohortMetrics;
  treatment: OnboardingCohortMetrics;
  timeReductionHours: number;
  timeReductionPct: number;
  supportReductionMinutesPerCustomer: number;
  supportReductionPct: number;
  timeToFirstValueResult: "IMPROVED" | "UNCHANGED" | "REGRESSED" | "INCONCLUSIVE";
  supportBurdenResult: "IMPROVED" | "UNCHANGED" | "REGRESSED" | "INCONCLUSIVE";
  earlyCustomerActivityResult: "IMPROVED" | "UNCHANGED" | "REGRESSED" | "INCONCLUSIVE";
  nextSingleBottleneck: string;
  productizationRecommendation: string;
  productionSafetyIncidents: string;
  engineeringFreezeViolations: string;
}
