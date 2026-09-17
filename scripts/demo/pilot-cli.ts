/**
 * scripts/demo/pilot-cli.ts
 *
 * CLI runner for Commercial GTM Pilot (Colombia Dental Market).
 * Usage:
 *   pnpm demo:pilot
 */

import { runColombiaPilot } from "./lib/demo-pilot";

function main() {
  console.info("🇨🇴 [demo:pilot] Iniciando Piloto Comercial GTM — Mercado Odontológico Colombia...");
  console.info("   Población objetivo: 50 clínicas odontológicas privadas (Bogotá, Medellín, Cali)\n");

  const { metrics, evaluation } = runColombiaPilot();

  console.info("=========================================================");
  console.info("       MÉTRICAS BASELINE — PILOTO COLOMBIA (50 CLÍNICAS) ");
  console.info("=========================================================");
  console.info(`OUTREACH CONTACTS:         ${metrics.totalOutreach}`);
  console.info(`RESPONSE RATE:             ${metrics.responseRatePct}% (${metrics.responses}/${metrics.totalOutreach})`);
  console.info(`DEMO REQUEST RATE:         ${metrics.demoRequestRatePct}% (${metrics.demoRequests}/${metrics.totalOutreach})`);
  console.info(`DEMO ACTIVATION RATE:      ${metrics.demoActivationRatePct}% (${metrics.demoActivations}/${metrics.demoRequests})`);
  console.info(`HIGH INTENT RATE:          ${metrics.highIntentRatePct}% (${metrics.highIntentDemos}/${metrics.demoActivations})`);
  console.info(`MEETING BOOKING RATE:      ${metrics.meetingBookingRatePct}% (${metrics.meetingsBooked}/${metrics.highIntentDemos})`);
  console.info(`PROPOSAL RATE:             ${metrics.proposalRatePct}% (${metrics.proposalsSent}/${metrics.meetingsBooked})`);
  console.info(`CLOSE RATE:                ${metrics.closeRatePct}% (${metrics.closedWon}/${metrics.proposalsSent})`);
  console.info(`MRR WON (COP):             $${metrics.totalMrrWonCop.toLocaleString()} COP/mes`);
  console.info(`MRR WON (USD Equiv):       $${metrics.totalMrrWonUsd.toLocaleString()} USD/mes`);
  console.info(`AVERAGE TIME TO ACTIVATION: ${metrics.avgTimeToActivationHours} horas`);
  console.info(`AVERAGE TIME TO MEETING:   ${metrics.avgTimeToMeetingHours} horas`);
  console.info("=========================================================\n");

  if (metrics.lowSampleFlags.length > 0) {
    console.info("⚠️ ALERTAS DE MUESTRA REDUCIDA:");
    for (const flag of metrics.lowSampleFlags) {
      console.info(`  • ${flag}`);
    }
    console.info("");
  }

  console.info("=========================================================");
  console.info("           DECISIÓN DE ETAPAS (GO / ITERATE)             ");
  console.info("=========================================================");
  console.info(`Acquisition:        ${evaluation.acquisition}`);
  console.info(`Demo Activation:    ${evaluation.demoActivation}`);
  console.info(`Product Interest:   ${evaluation.productInterest}`);
  console.info(`Meeting Conversion: ${evaluation.meetingConversion}`);
  console.info(`Closing:            ${evaluation.closing}`);
  console.info("---------------------------------------------------------");
  console.info(`MAYOR CUELLO DE BOTELLA DEL EMBUDO:`);
  console.info(`  ${evaluation.singleLargestConstraint}`);
  console.info(`ACCIÓN PRIORITARIA RECOMENDADA:`);
  console.info(`  ${evaluation.recommendedAction}`);
  console.info("=========================================================\n");
}

main();
