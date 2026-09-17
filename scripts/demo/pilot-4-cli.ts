/**
 * scripts/demo/pilot-4-cli.ts
 *
 * CLI runner for GTM Commercial Pilot #4 (Colombia Dental Customer Activation & Time-to-First-Value).
 * Usage:
 *   pnpm demo:pilot:4
 */

import { runPilot4 } from "./lib/demo-pilot-4";

function main() {
  console.info("🇨🇴 [demo:pilot:4] Ejecutando Piloto Comercial GTM #4 — Activación y Tiempo a Primer Valor");
  console.info("   Muestra: 30 Nuevas Clínicas Odontológicas Cerradas (Bogotá, Medellín, Cali)");
  console.info("   Variable experimental: manual_v1 (Control) vs guided_48h_v1 (Treatment)\n");

  const { metrics } = runPilot4();

  console.info("===============================================================================");
  console.info(" PILOT #4: FINAL COMMERCIAL EXPERIMENT REPORT");
  console.info("===============================================================================");
  console.info("PILOT #4:\nCOMPLETE\n");
  console.info(`NEW CLOSED-WON CUSTOMERS:\n${metrics.totalNewCustomers}\n`);
  console.info(`CONTROL:\n${metrics.controlCustomers} (${metrics.control.firstValueCount}/${metrics.controlCustomers} alcanzaron primer valor)\n`);
  console.info(`GUIDED ONBOARDING:\n${metrics.treatmentCustomers} (${metrics.treatment.firstValueCount}/${metrics.treatmentCustomers} alcanzaron primer valor)\n`);
  console.info(`CONTROL MEDIAN TIME TO FIRST VALUE:\n${metrics.control.medianHoursToFirstValue} horas (mean: ${metrics.control.meanHoursToFirstValue}h, p75: ${metrics.control.p75HoursToFirstValue}h)\n`);
  console.info(`TREATMENT MEDIAN TIME TO FIRST VALUE:\n${metrics.treatment.medianHoursToFirstValue} horas (mean: ${metrics.treatment.meanHoursToFirstValue}h, p75: ${metrics.treatment.p75HoursToFirstValue}h)\n`);
  console.info(`TIME REDUCTION:\n${metrics.timeReductionHours} horas (${metrics.timeReductionPct}%)\n`);
  console.info(`FIRST VALUE <=24H:\nControl ${metrics.control.firstValueWithin24hPct}% (${metrics.control.firstValueWithin24hCount}/${metrics.controlCustomers}) / Treatment ${metrics.treatment.firstValueWithin24hPct}% (${metrics.treatment.firstValueWithin24hCount}/${metrics.treatmentCustomers})\n`);
  console.info(`FIRST VALUE <=48H:\nControl ${metrics.control.firstValueWithin48hPct}% (${metrics.control.firstValueWithin48hCount}/${metrics.controlCustomers}) / Treatment ${metrics.treatment.firstValueWithin48hPct}% (${metrics.treatment.firstValueWithin48hCount}/${metrics.treatmentCustomers})\n`);
  console.info(`FIRST VALUE <=72H:\nControl ${metrics.control.firstValueWithin72hPct}% (${metrics.control.firstValueWithin72hCount}/${metrics.controlCustomers}) / Treatment ${metrics.treatment.firstValueWithin72hPct}% (${metrics.treatment.firstValueWithin72hCount}/${metrics.treatmentCustomers})\n`);
  console.info(`TEAM SETUP RATE:\nControl: ${metrics.control.teamSetupRatePct}% | Treatment: ${metrics.treatment.teamSetupRatePct}%\n`);
  console.info(`WHATSAPP CONNECTION RATE:\nControl: ${metrics.control.whatsappConnectionRatePct}% | Treatment: ${metrics.treatment.whatsappConnectionRatePct}%\n`);
  console.info(`AGENDA CONFIGURATION RATE:\nControl: ${metrics.control.agendaConfigurationRatePct}% | Treatment: ${metrics.treatment.agendaConfigurationRatePct}%\n`);
  console.info(`GOOGLE CALENDAR CONNECTION RATE:\nControl: ${metrics.control.googleCalendarConnectionRatePct}% | Treatment: ${metrics.treatment.googleCalendarConnectionRatePct}%\n`);
  console.info(`DAY 3 ACTIVATION:\nControl: ${metrics.control.day3ActivationPct}% | Treatment: ${metrics.treatment.day3ActivationPct}%\n`);
  console.info(`DAY 7 ACTIVE:\nControl: ${metrics.control.day7ActivePct}% | Treatment: ${metrics.treatment.day7ActivePct}%\n`);
  console.info(`DAY 14 ACTIVE:\nControl: ${metrics.control.day14ActivePct}% | Treatment: ${metrics.treatment.day14ActivePct}%\n`);
  console.info(`DAY 30 RETENTION:\n${metrics.treatment.day30RetentionStatus}\n`);
  console.info(`CONTROL HUMAN SUPPORT MINUTES / CUSTOMER:\n${metrics.control.humanMinutesPerCustomer} minutos/cliente (${metrics.control.totalHumanMinutes} min totales)\n`);
  console.info(`TREATMENT HUMAN SUPPORT MINUTES / CUSTOMER:\n${metrics.treatment.humanMinutesPerCustomer} minutos/cliente (${metrics.treatment.totalHumanMinutes} min totales, ${metrics.supportReductionPct}% de carga)\n`);
  console.info(`TOP ONBOARDING BLOCKER:\n${metrics.treatment.topBlocker}\n`);
  console.info(`TOP FIRST-VALUE MOMENT:\n${metrics.treatment.topFirstValueMoment}\n`);
  console.info(`TIME TO FIRST VALUE RESULT:\n${metrics.timeToFirstValueResult}\n`);
  console.info(`SUPPORT BURDEN RESULT:\n${metrics.supportBurdenResult}\n`);
  console.info(`NEXT SINGLE BOTTLENECK:\n${metrics.nextSingleBottleneck}\n`);
  console.info(`PRODUCTIZATION RECOMMENDATION:\n${metrics.productizationRecommendation}\n`);
  console.info(`PRODUCTION SAFETY INCIDENTS:\n${metrics.productionSafetyIncidents}\n`);
  console.info(`ENGINEERING FREEZE VIOLATIONS:\n${metrics.engineeringFreezeViolations}\n`);
  console.info("===============================================================================\n");
}

main();
