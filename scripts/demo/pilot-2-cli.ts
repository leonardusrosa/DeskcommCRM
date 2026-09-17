/**
 * scripts/demo/pilot-2-cli.ts
 *
 * CLI runner for Commercial GTM Pilot #2 (Colombia Dental Funnel Validation).
 * Usage:
 *   pnpm demo:pilot:2
 */

import { runPilot2 } from "./lib/demo-pilot-2";

function main() {
  console.info("🇨🇴 [demo:pilot:2] Ejecutando Piloto Comercial GTM #2 — Validación Funnel Odontológico Colombia");
  console.info("   Muestra: 100 NUEVAS clínicas odontológicas privadas (Bogotá: 34, Medellín: 33, Cali: 33)");
  console.info("   Variable experimental: meeting_flow = whatsapp_1click_v1\n");

  const { metrics } = runPilot2();

  console.info("===============================================================================");
  console.info("          GTM PILOT #2 FUNNEL REPORT (100 NEW COLOMBIA DENTAL CLINICS)         ");
  console.info("===============================================================================");
  console.info(`OUTREACH CONTACTS:              ${metrics.outreachContacts}`);
  console.info(`RESPONSES:                      ${metrics.responses} (${metrics.responseRatePct}%)`);
  console.info(`DEMO REQUESTS:                  ${metrics.demoRequests} (${metrics.demoRequestRatePct}%)`);
  console.info(`DEMO ACTIVATIONS:               ${metrics.demoActivations} (${metrics.demoActivationRatePct}%)`);
  console.info(`HIGH INTENT DEMOS:              ${metrics.highIntentCount} (${metrics.highIntentRatePct}%)`);
  console.info(`MEETING LINK PRESENTED:         ${metrics.meetingLinkPresentedCount} (100.0%)`);
  console.info(`MEETING LINK CLICKED:           ${metrics.meetingLinkClickedCount} (${metrics.meetingLinkClickRatePct}%)`);
  console.info(`MEETINGS BOOKED:                ${metrics.meetingsBooked} (${metrics.highIntentToMeetingBookedRatePct}%)`);
  console.info(`MEETINGS ATTENDED:              ${metrics.meetingsAttended} (${metrics.meetingAttendanceRatePct}% attendance, ${metrics.highIntentToMeetingAttendedRatePct}% of high intent)`);
  console.info(`PROPOSALS SENT:                 ${metrics.proposalsSent} (${metrics.proposalRatePct}%)`);
  console.info(`CLOSED WON:                     ${metrics.closedWon} (${metrics.closeRatePct}%)`);
  console.info(`CLOSED LOST:                    ${metrics.closedLost}`);
  console.info(`TOTAL MRR WON (COP):            $${metrics.totalMrrWonCop.toLocaleString()} COP/mes`);
  console.info(`TOTAL MRR WON (USD Equiv):      $${metrics.totalMrrWonUsd.toLocaleString()} USD/mes`);
  console.info(`AVG MRR PER CUSTOMER:           $${metrics.avgMrrPerCustomerCop.toLocaleString()} COP/mes`);
  console.info("-------------------------------------------------------------------------------");
  console.info("VELOCIDAD DE TRANSICIÓN:");
  console.info(`  • Tiempo promedio a activación:             ${metrics.avgTimeToActivationHours} horas`);
  console.info(`  • Tiempo promedio High Intent -> Reunión:   ${metrics.avgTimeHighIntentToMeetingHours} horas`);
  console.info(`  • Tiempo promedio Demo -> Cierre:           ${metrics.avgTimeDemoToCloseHours} horas`);
  console.info("===============================================================================");
  console.info("               COMPARACIÓN EXPERIMENTAL VS PILOTO #1 (BASELINE)                ");
  console.info("===============================================================================");
  console.info(`Pilot #1 Baseline (high_intent -> meeting_booked): ${metrics.pilot1BaselineMeetingRatePct}% (8 / 12)`);
  console.info(`Pilot #2 Result   (whatsapp_1click_v1):            ${metrics.highIntentToMeetingBookedRatePct}% (${metrics.meetingsBooked} / ${metrics.highIntentCount})`);
  console.info(`Cambio absoluto en puntos porcentuales:            +${metrics.absoluteChangePercentagePoints} pp`);
  console.info(`Cambio relativo:                                   +${metrics.relativeChangePct}%`);
  console.info("-------------------------------------------------------------------------------");
  console.info("CALIDAD DE REUNIÓN (MÉTRICA SECUNDARIA):");
  console.info(`  • Tasa de asistencia a reunión agendada:    ${metrics.meetingAttendanceRatePct}% (${metrics.meetingsAttended}/${metrics.meetingsBooked})`);
  console.info(`  • High Intent -> Reunión Atendida:          ${metrics.highIntentToMeetingAttendedRatePct}% (${metrics.meetingsAttended}/${metrics.highIntentCount})`);
  console.info("-------------------------------------------------------------------------------");
  console.info(`ALERTA DE TAMAÑO DE MUESTRA: ${metrics.sampleSizeWarning ? "SÍ" : "NO"}`);
  console.info(`  ${metrics.sampleSizeWarningDetails}`);
  console.info("===============================================================================");
  console.info(`CLASIFICACIÓN DEL EXPERIMENTO: [ MEETING FLOW: ${metrics.meetingFlowResult} ]`);
  console.info("===============================================================================");
  console.info("PRÓXIMO CUELLO DE BOTELLA ÚNICO DEL EMBUDO:");
  console.info(`  ${metrics.nextSingleFunnelBottleneck}`);
  console.info("===============================================================================\n");
}

main();
