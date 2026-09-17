/**
 * scripts/demo/pilot-8-cli.ts
 *
 * CLI runner for GTM Commercial Pilot #8 (Spain Dental Market Replication).
 * Usage:
 *   pnpm demo:pilot:8
 */

import { runPilot8 } from "./lib/demo-pilot-8";

function main() {
  console.info("🇪🇸 [demo:pilot:8] Ejecutando Piloto Comercial GTM #8 — Replicación de Mercado España");
  console.info("   Muestra: 100 Nuevas Clínicas Odontológicas Privadas (Madrid: 34, Barcelona: 33, Valencia: 33)");
  console.info("   Validación del Playbook GTM en Europa, staff_handoff_15min_v1 y facturación reverse-charge\n");

  const report = runPilot8();

  console.info("===============================================================================");
  console.info(" PILOT #8: FINAL SPAIN MARKET REPLICATION REPORT");
  console.info("===============================================================================");
  console.info("PILOT #8:\n" + report.status + "\n");
  console.info("MARKET:\n" + report.market + "\n");
  console.info("CONTACTED:\n" + report.contacted + "\n");
  console.info(`MADRID:\n${report.cityBreakdown.Madrid.contacted} contactadas (${report.cityBreakdown.Madrid.won} ganadas, €${report.cityBreakdown.Madrid.mrrEur} EUR/mes)\n`);
  console.info(`BARCELONA:\n${report.cityBreakdown.Barcelona.contacted} contactadas (${report.cityBreakdown.Barcelona.won} ganadas, €${report.cityBreakdown.Barcelona.mrrEur} EUR/mes)\n`);
  console.info(`VALENCIA:\n${report.cityBreakdown.Valencia.contacted} contactadas (${report.cityBreakdown.Valencia.won} ganadas, €${report.cityBreakdown.Valencia.mrrEur} EUR/mes)\n`);
  console.info(`RESPONSES:\n${report.responses}\n`);
  console.info(`RESPONSE RATE:\n${report.responseRatePct}%\n`);
  console.info(`DEMO REQUESTS:\n${report.demoRequests}\n`);
  console.info(`DEMO REQUEST RATE:\n${report.demoRequestRatePct}%\n`);
  console.info(`ACTIVATIONS:\n${report.activations}\n`);
  console.info(`ACTIVATION RATE:\n${report.activationRatePct}%\n`);
  console.info(`HIGH INTENT:\n${report.highIntent} (${report.highIntentRatePct}% de activaciones)\n`);
  console.info(`MEETINGS BOOKED:\n${report.meetingsBooked} (${report.meetingBookingRatePct}% de high intent)\n`);
  console.info(`MEETINGS ATTENDED:\n${report.meetingsAttended} (${report.attendanceRatePct}% de asistencia)\n`);
  console.info(`PROPOSALS:\n${report.proposalsSent} (${report.proposalRatePct}% de asistidas)\n`);
  console.info(`CLOSED WON:\n${report.closedWon} (${report.closeRatePct}% de propuestas)\n`);
  console.info(`CLOSED LOST:\n${report.closedLost}\n`);
  console.info(`MRR WON EUR:\n€${report.mrrWonEur} EUR/mes\n`);
  console.info(`AVERAGE MRR EUR:\n€${report.averageMrrEur} EUR/mes (Tarifas congeladas: Starter €49 / Pro €99)\n`);
  console.info(`MEDIAN PROPOSAL → DECISION:\n${report.medianProposalToDecisionHours} horas\n`);
  console.info(`MEDIAN TIME TO FIRST VALUE:\n${report.medianTimeToFirstValueHours.toFixed(1)} horas\n`);
  console.info(`FIRST VALUE <=48H:\n${report.firstValueWithin48hPct}%\n`);
  console.info(`HUMAN SUPPORT MINUTES/CUSTOMER:\n${report.humanSupportMinutesPerCustomer} minutos/cliente\n`);
  console.info(`D7 ACTIVE:\n${report.d7ActivePct}%\n`);
  console.info(`D14 ACTIVE:\n${report.d14ActivePct}%\n`);
  console.info(`D30 RETENTION:\n${report.d30RetentionPct}%\n`);
  console.info(`D60 RETENTION:\n${report.d60RetentionStatus}\n`);
  console.info(`BILLING/TAX BLOCKED DEALS:\n${report.billingTaxBlockedDeals} (Facturas Delaware con NIF/CIF aceptadas bajo Reverse Charge)\n`);
  console.info(`TOP LOST REASON:\n${report.topLostReason}\n`);
  console.info(`TOP SPAIN LOCALIZATION DIFFERENCE:\n${report.topSpainLocalizationDifference}\n`);
  console.info(`STAFF HANDOFF EVENTS:\n${report.staffHandoffMetrics.eventsCount}\n`);
  console.info(`STAFF HANDOFF COMPLETION:\n${report.staffHandoffMetrics.completionRatePct}% (promedio ${report.staffHandoffMetrics.averageDurationMinutes} min)\n`);
  console.info(`STAFF HANDOFF SUPPORT MINUTES:\n${report.staffHandoffMetrics.supportMinutesTotal} minutos totales\n`);
  console.info(`STAFF HANDOFF VALIDATION:\n${report.staffHandoffMetrics.validationResult}\n`);
  console.info(`SPAIN PLAYBOOK RESULT:\n${report.spainPlaybookResult}\n`);
  console.info(`NEXT SINGLE BOTTLENECK:\n${report.nextSingleBottleneck}\n`);
  console.info(`PORTUGAL:\n${report.portugalStatus}\n`);
  console.info(`PRODUCTION SAFETY INCIDENTS:\n${report.productionSafetyIncidents}\n`);
  console.info(`ENGINEERING FREEZE VIOLATIONS:\n${report.engineeringFreezeViolations}\n`);

  console.info("-------------------------------------------------------------------------------");
  console.info("STAGE-BY-STAGE SCORECARD (SPAIN VS MEXICO REFERENCE):");
  for (const s of report.scorecard) {
    const sign = s.differencePp >= 0 ? "+" : "";
    console.info(`  • ${s.stage.padEnd(26)} ES: ${String(s.spainRatePct).padStart(5)}% | MX: ${String(s.mexicoReferencePct).padStart(5)}% | Diff: ${sign}${s.differencePp} pp | [${s.status}]`);
  }
  console.info("===============================================================================\n");
}

main();
