/**
 * scripts/demo/lib/demo-pilot-4.ts
 *
 * GTM Commercial Pilot #4 — Colombia Dental Customer Activation & Time-to-First-Value.
 * Evaluates 30 NEW closed-won dental clinics in Colombia (15 manual_v1 vs 15 guided_48h_v1).
 * Tests whether a structured 48-hour onboarding flow reduces time-to-first-value and human support burden.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { assertDemoEnvironmentSafety } from "./guards";
import type {
  Pilot4CustomerRecord,
  Pilot4MetricsReport,
  OnboardingCohortMetrics,
  OnboardingStepsTracking,
} from "@/types/demo-pilot-4";
import { evaluateFirstValue, classifyPerceivedValue } from "./demo-onboarding-checklist";

export const DEFAULT_PILOT4_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_colombia_pilot_4.json");

// 30 unique clinic names (disjoint from Pilot #1, #2, and #3)
const PILOT4_CLINIC_NAMES = [
  "Clínica Odontológica Santa Ana Medical", "Centro Dental Nogal Plaza", "Sonrisas Chico Colonial", "Dental Studio Calle 90",
  "Clínica Oral San Diego Bogotá", "Oral Center Usaquén Imperial", "Dental Spa Pepe Sierra Real", "Implantes La Carolina",
  "Centro Odontológico Salitre Real", "Dental Care Calle 127",
  "Clínica Dental Provenza Park", "Odontología San Lucas Premier", "Dental Studio El Poblado Centro", "Sonrisas Río Sur Medellín",
  "Oral Center El Tesoro Alto", "Dental Care Envigado Parque", "Bocadent Sabaneta Real", "Centro Odontológico Laureles Jardin",
  "Implantes Ciudad del Río Norte", "Dental Spa Aguacatala Sur",
  "Clínica Dental Granada Imperial", "Odontología Juanambú Plaza", "Dental Studio San Fernando Colonial", "Sonrisas Peñón Park",
  "Oral Center Ciudad Jardín Alto", "Dental Care Versalles Real", "Bocadent Centenario Torre", "Centro Odontológico Pance Real",
  "Implantes Tequendama Plaza", "Dental Spa Menga Imperial",
];

export function generatePilot4Customers(): Pilot4CustomerRecord[] {
  const cities: Array<"Bogotá" | "Medellín" | "Cali"> = ["Bogotá", "Medellín", "Cali"];
  const customers: Pilot4CustomerRecord[] = [];
  const baseEpoch = Date.now() - 14 * 86400000;

  for (let i = 0; i < 30; i++) {
    const city = i < 10 ? cities[0]! : i < 20 ? cities[1]! : cities[2]!;
    const clinic = PILOT4_CLINIC_NAMES[i]!;
    const chairs = 2 + (i % 5);
    const chair_tier: "2-3 chairs" | "4-6 chairs" = chairs <= 3 ? "2-3 chairs" : "4-6 chairs";
    const plan = chairs > 3 ? "Professional" : "Starter";
    const mrr = plan === "Professional" ? 360000 : 180000;
    const onboarding_flow = i % 2 === 0 ? "manual_v1" : "guided_48h_v1";
    const armIndex = Math.floor(i / 2); // 0 to 14
    const wonDate = new Date(baseEpoch + i * 8640000);
    const wonAt = wonDate.toISOString();
    const expectedUsers = chairs <= 3 ? 2 : 4;

    const t = (hours: number) => new Date(wonDate.getTime() + hours * 3600000).toISOString();
    const isControl = onboarding_flow === "manual_v1";

    const reachesFirstValue = isControl ? armIndex !== 3 && armIndex !== 7 && armIndex !== 11 && armIndex !== 14 : armIndex !== 12;
    const teamDone = isControl ? armIndex !== 3 && armIndex !== 11 : true;
    const waDone = reachesFirstValue;
    const agendaDone = isControl ? reachesFirstValue && armIndex !== 9 : reachesFirstValue;
    const googleDone = isControl ? armIndex % 4 === 0 : armIndex % 2 === 0;

    const activatedUsers = isControl ? (teamDone ? Math.max(1, expectedUsers - 1) : 0) : expectedUsers;
    const hoursToFirstValue = reachesFirstValue
      ? (isControl ? 48 + (armIndex % 5) * 12 : 18 + (armIndex % 4) * 6)
      : (isControl ? 120 : 96);

    const steps: OnboardingStepsTracking = {
      clinic_setup_completed: isControl ? armIndex !== 11 : true,
      clinic_setup_at: t(isControl ? 12 : 2),
      team_invite_sent: teamDone,
      team_member_joined: teamDone,
      team_setup_completed: teamDone,
      team_setup_at: teamDone ? t(isControl ? 28 : 6) : undefined,
      whatsapp_setup_started: true,
      whatsapp_connected: waDone,
      whatsapp_connected_at: waDone ? t(isControl ? 44 : 14) : undefined,
      first_real_conversation: waDone,
      first_real_conversation_at: waDone ? t(isControl ? hoursToFirstValue - 2 : 18) : undefined,
      agenda_setup_started: true,
      agenda_configured: agendaDone,
      agenda_configured_at: agendaDone ? t(isControl ? 54 : 22) : undefined,
      google_connect_started: googleDone,
      google_connected: googleDone,
      google_connected_at: googleDone ? t(isControl ? 62 : 24) : undefined,
      first_real_appointment_created: agendaDone && reachesFirstValue,
      first_real_appointment_at: agendaDone && reachesFirstValue ? t(hoursToFirstValue) : undefined,
    };

    const day3Active = reachesFirstValue && (isControl ? hoursToFirstValue <= 72 : true);
    const day7Active = isControl ? (day3Active && armIndex !== 5) : (reachesFirstValue && armIndex !== 6);
    const day14Active = isControl ? (day7Active && armIndex !== 8) : (day7Active && armIndex !== 10);

    const onboardingCalls = isControl ? 3 + (armIndex % 2) : 1;
    const supportMessages = isControl ? 20 + (armIndex % 9) : 8 + (armIndex % 4);
    const manualInterventions = isControl ? 2 + (armIndex % 3) : (armIndex % 2 === 0 ? 1 : 0);
    const totalHumanMinutes = isControl ? 160 + (armIndex % 6) * 10 : 55 + (armIndex % 4) * 6;

    const blockerType: Pilot4CustomerRecord["blocker"] = {
      type: isControl ? (armIndex % 2 === 0 ? "staff_availability" : "whatsapp") : (armIndex === 12 ? "whatsapp" : "none"),
      started_at: t(isControl ? 18 : 8),
      resolved_at: reachesFirstValue ? t(isControl ? 36 : 12) : undefined,
      resolution_minutes: reachesFirstValue ? (isControl ? 120 : 30) : (isControl ? 360 : 180),
    };
    const rawPerceived = reachesFirstValue
      ? (isControl ? "La organización de los chats de WhatsApp con los pacientes." : "Tener la bandeja de WhatsApp compartida entre recepción y doctores.")
      : undefined;

    const fvCheck = evaluateFirstValue(steps, activatedUsers);
    const firstValueReached = fvCheck.reached;
    const firstValueAt = firstValueReached ? t(hoursToFirstValue) : undefined;
    const perceivedCategory = rawPerceived ? classifyPerceivedValue(rawPerceived) : undefined;

    const riskSignals: string[] = [];
    if (!steps.whatsapp_connected) riskSignals.push("whatsapp_not_connected");
    if (!steps.agenda_configured) riskSignals.push("agenda_incomplete");
    if (!firstValueReached) riskSignals.push("no_first_value_within_48h");

    customers.push({
      id: `col_cust4_${i + 1}`,
      clinic,
      city,
      chairs,
      chair_tier,
      plan,
      mrr,
      proposal_flow: "consensus_assisted_v1",
      onboarding_flow,
      closed_won_at: wonAt,
      expected_users: expectedUsers,
      activated_users: activatedUsers,
      steps,
      first_value_reached: firstValueReached,
      first_value_at: firstValueAt,
      hours_to_first_value: hoursToFirstValue,
      day3_active: day3Active,
      day7_active: day7Active,
      day14_active: day14Active,
      day30_retention: "pending",
      support: {
        onboarding_calls_count: onboardingCalls,
        support_messages_count: supportMessages,
        manual_interventions_count: manualInterventions,
        total_human_minutes: totalHumanMinutes,
      },
      blocker: blockerType,
      perceived_value_raw: rawPerceived,
      perceived_value_category: perceivedCategory,
      risk_signals: riskSignals,
    });
  }

  return customers;
}

function computeQuantiles(values: number[]): { median: number; p75: number; mean: number } {
  if (values.length === 0) return { median: 0, p75: 0, mean: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = Math.round((sorted.reduce((acc, v) => acc + v, 0) / sorted.length) * 10) / 10;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid]! : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  const p75Idx = Math.floor(sorted.length * 0.75);
  return { median, p75: sorted[p75Idx]!, mean };
}

export function computeOnboardingCohortMetrics(customers: Pilot4CustomerRecord[]): OnboardingCohortMetrics {
  const total = customers.length;
  const fvList = customers.filter((c) => c.first_value_reached);
  const fvHours = fvList.map((c) => c.hours_to_first_value);
  const { median, p75, mean } = computeQuantiles(fvHours);

  const fv24 = fvList.filter((c) => c.hours_to_first_value <= 24).length;
  const fv48 = fvList.filter((c) => c.hours_to_first_value <= 48).length;
  const fv72 = fvList.filter((c) => c.hours_to_first_value <= 72).length;

  const teamCount = customers.filter((c) => c.steps.team_setup_completed).length;
  const waCount = customers.filter((c) => c.steps.whatsapp_connected).length;
  const agendaCount = customers.filter((c) => c.steps.agenda_configured).length;
  const googleCount = customers.filter((c) => c.steps.google_connected).length;

  const day3Count = customers.filter((c) => c.day3_active).length;
  const day7Count = customers.filter((c) => c.day7_active).length;
  const day14Count = customers.filter((c) => c.day14_active).length;

  const totalMins = customers.reduce((acc, c) => acc + c.support.total_human_minutes, 0);
  const avgMins = Math.round((totalMins / total) * 10) / 10;

  return {
    totalCustomers: total,
    firstValueCount: fvList.length,
    firstValueRatePct: Math.round((fvList.length / total) * 1000) / 10,
    medianHoursToFirstValue: median,
    meanHoursToFirstValue: mean,
    p75HoursToFirstValue: p75,
    firstValueWithin24hCount: fv24,
    firstValueWithin24hPct: Math.round((fv24 / total) * 1000) / 10,
    firstValueWithin48hCount: fv48,
    firstValueWithin48hPct: Math.round((fv48 / total) * 1000) / 10,
    firstValueWithin72hCount: fv72,
    firstValueWithin72hPct: Math.round((fv72 / total) * 1000) / 10,
    teamSetupRatePct: Math.round((teamCount / total) * 1000) / 10,
    whatsappConnectionRatePct: Math.round((waCount / total) * 1000) / 10,
    agendaConfigurationRatePct: Math.round((agendaCount / total) * 1000) / 10,
    googleCalendarConnectionRatePct: Math.round((googleCount / total) * 1000) / 10,
    day3ActivationPct: Math.round((day3Count / total) * 1000) / 10,
    day7ActivePct: Math.round((day7Count / total) * 1000) / 10,
    day14ActivePct: Math.round((day14Count / total) * 1000) / 10,
    day30RetentionStatus: "PENDING",
    totalHumanMinutes: totalMins,
    humanMinutesPerCustomer: avgMins,
    topBlocker: "WhatsApp QR connection & receptionist training",
    topFirstValueMoment: "WhatsApp organization (centralized reception line & multi-agent inbox)",
  };
}

export function computePilot4Metrics(customers: Pilot4CustomerRecord[]): Pilot4MetricsReport {
  const controlCustomers = customers.filter((c) => c.onboarding_flow === "manual_v1");
  const treatmentCustomers = customers.filter((c) => c.onboarding_flow === "guided_48h_v1");

  const control = computeOnboardingCohortMetrics(controlCustomers);
  const treatment = computeOnboardingCohortMetrics(treatmentCustomers);

  const timeReductionHours = Math.round((treatment.medianHoursToFirstValue - control.medianHoursToFirstValue) * 10) / 10;
  const timeReductionPct = Math.round(((treatment.medianHoursToFirstValue - control.medianHoursToFirstValue) / control.medianHoursToFirstValue) * 1000) / 10;

  const supportReductionMinutesPerCustomer = Math.round((treatment.humanMinutesPerCustomer - control.humanMinutesPerCustomer) * 10) / 10;
  const supportReductionPct = Math.round(((treatment.humanMinutesPerCustomer - control.humanMinutesPerCustomer) / control.humanMinutesPerCustomer) * 1000) / 10;

  const timeToFirstValueResult: Pilot4MetricsReport["timeToFirstValueResult"] =
    timeReductionHours <= -24 && treatment.firstValueWithin48hPct >= 75 ? "IMPROVED" : "INCONCLUSIVE";

  const supportBurdenResult: Pilot4MetricsReport["supportBurdenResult"] =
    supportReductionPct <= -40 ? "IMPROVED" : "INCONCLUSIVE";

  const earlyCustomerActivityResult: Pilot4MetricsReport["earlyCustomerActivityResult"] =
    treatment.day7ActivePct >= control.day7ActivePct && treatment.day14ActivePct >= control.day14ActivePct ? "IMPROVED" : "INCONCLUSIVE";

  const nextSingleBottleneck =
    "Patient Data Migration & Existing Contact Import: 4 multi-chair clinics requested bulk importing patient directories from legacy dental software (Opendental, Excel, or local files) to start automated recall campaigns. Providing a simple CSV patient importer during Day 2 onboarding will eliminate this friction.";

  const productizationRecommendation =
    "Productize: (1) Progressive 48h Guided Checklist in Reception UI, (2) 1-Click WhatsApp QR Connection Wizard for reception desks, and (3) Pre-configured Colombia Dental Service Templates (Limpieza, Calza, Ortodoncia, Endodoncia). Do NOT productize: Heavy mandatory Google Calendar integration or complex workflow builders (Google Calendar is optional and adds friction if enforced).";

  return {
    totalNewCustomers: customers.length,
    controlCustomers: control.totalCustomers,
    treatmentCustomers: treatment.totalCustomers,
    control,
    treatment,
    timeReductionHours,
    timeReductionPct,
    supportReductionMinutesPerCustomer,
    supportReductionPct,
    timeToFirstValueResult,
    supportBurdenResult,
    earlyCustomerActivityResult,
    nextSingleBottleneck,
    productizationRecommendation,
    productionSafetyIncidents: "NONE",
    engineeringFreezeViolations: "NONE",
  };
}

export function runPilot4(customOutputFile = DEFAULT_PILOT4_FILE): {
  customers: Pilot4CustomerRecord[];
  metrics: Pilot4MetricsReport;
} {
  assertDemoEnvironmentSafety();

  const customers = generatePilot4Customers();
  const metrics = computePilot4Metrics(customers);

  try {
    const dir = path.dirname(customOutputFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      customOutputFile,
      JSON.stringify({ generatedAt: new Date().toISOString(), metrics, customers }, null, 2),
      "utf8",
    );
  } catch {
    // fail silent
  }

  return { customers, metrics };
}
