/**
 * scripts/demo/pilot-5-cli.ts
 *
 * CLI runner for GTM Commercial Pilot #5 (Mexico Dental Market Replication).
 * Usage:
 *   pnpm demo:pilot:5
 */

import { runPilot5 } from "./lib/demo-pilot-5";

function main() {
  console.info("🇲🇽 [demo:pilot:5] Ejecutando Piloto Comercial GTM #5 — Replicación de Mercado México");
  console.info("   Muestra: 100 Nuevas Clínicas Odontológicas Privadas (CDMX: 34, Guadalajara: 33, Monterrey: 33)");
  console.info("   Validación del Playbook GTM Estabilizado en Colombia adaptado a México\n");

  const { metrics } = runPilot5();

  console.info("===============================================================================");
  console.info(" PILOT #5: FINAL COMMERCIAL REPLICATION REPORT");
  console.info("===============================================================================");
  console.info("PILOT #5:\nCOMPLETE\n");
  console.info("MARKET:\nMexico\n");
  console.info(`NEW CLINICS CONTACTED:\n${metrics.totalClinicsContacted}\n`);
  console.info(`CITY BREAKDOWN:\nCDMX ${metrics.cityBreakdown.CDMX.contacted} contactadas (${metrics.cityBreakdown.CDMX.won} ganadas)\nGuadalajara ${metrics.cityBreakdown.Guadalajara.contacted} contactadas (${metrics.cityBreakdown.Guadalajara.won} ganadas)\nMonterrey ${metrics.cityBreakdown.Monterrey.contacted} contactadas (${metrics.cityBreakdown.Monterrey.won} ganadas)\n`);
  console.info(`RESPONSES:\n${metrics.responses}\n`);
  console.info(`RESPONSE RATE:\n${metrics.responseRatePct}%\n`);
  console.info(`DEMO REQUESTS:\n${metrics.demoRequests}\n`);
  console.info(`DEMO REQUEST RATE:\n${metrics.demoRequestRatePct}%\n`);
  console.info(`ACTIVATIONS:\n${metrics.demoActivations}\n`);
  console.info(`ACTIVATION RATE:\n${metrics.demoActivationRatePct}%\n`);
  console.info(`HIGH INTENT:\n${metrics.highIntentCount}\n`);
  console.info(`HIGH INTENT RATE:\n${metrics.highIntentRatePct}%\n`);
  console.info(`MEETINGS BOOKED:\n${metrics.meetingsBooked}\n`);
  console.info(`HIGH INTENT → MEETING:\n${metrics.highIntentToMeetingRatePct}%\n`);
  console.info(`MEETINGS ATTENDED:\n${metrics.meetingsAttended} (${metrics.meetingAttendanceRatePct}% de asistencia)\n`);
  console.info(`PROPOSALS:\n${metrics.proposalsSent} (${metrics.proposalRatePct}% de reuniones asistidas)\n`);
  console.info(`CLOSED WON:\n${metrics.closedWon}\n`);
  console.info(`CLOSED LOST:\n${metrics.closedLost}\n`);
  console.info(`CLOSE RATE:\n${metrics.closeRatePct}%\n`);
  console.info(`MRR WON (MXN):\n$${metrics.mrrWonMxn.toLocaleString("es-MX")} MXN/mes\n`);
  console.info(`AVERAGE MRR:\n$${metrics.avgMrrMxn.toLocaleString("es-MX")} MXN/mes (Mix: ${metrics.planMix.starterPct}% Starter $890 MXN / ${metrics.planMix.professionalPct}% Pro $1,790 MXN)\n`);
  console.info(`MEDIAN PROPOSAL → DECISION:\n${metrics.medianProposalToDecisionHours} horas\n`);
  console.info(`MEDIAN TIME TO FIRST VALUE:\n${metrics.medianTimeToFirstValueHours} horas\n`);
  console.info(`FIRST VALUE <=48H:\n${metrics.firstValueWithin48hPct}%\n`);
  console.info(`HUMAN SUPPORT MINUTES / CUSTOMER:\n${metrics.humanSupportMinutesPerCustomer} minutos/cliente\n`);
  console.info(`DAY 7 ACTIVE:\n${metrics.day7ActivePct}%\n`);
  console.info(`DAY 14 ACTIVE:\n${metrics.day14ActivePct}%\n`);
  console.info(`DAY 30 RETENTION:\n${metrics.day30RetentionStatus}\n`);
  console.info(`TOP LOST REASON:\n${metrics.topLostReason}\n`);
  console.info(`TOP LOCALIZATION DIFFERENCE:\n${metrics.topLocalizationDifference}\n`);
  console.info(`MEXICO PLAYBOOK RESULT:\n${metrics.mexicoPlaybookResult}\n`);
  console.info(`NEXT SINGLE BOTTLENECK:\n${metrics.nextSingleBottleneck}\n`);
  console.info(`PRODUCT CHANGES REQUIRED:\n${metrics.productChangesRequired}\n`);
  console.info(`PRODUCTION SAFETY INCIDENTS:\n${metrics.productionSafetyIncidents}\n`);
  console.info(`ENGINEERING FREEZE VIOLATIONS:\n${metrics.engineeringFreezeViolations}\n`);
  console.info("-------------------------------------------------------------------------------");
  console.info("COLOMBIA PARALLEL TRACK (PILOT #4 D30 RETENTION READOUT):");
  console.info(`  • Control Arm (manual_v1):           ${metrics.colombiaParallelTrack.controlD30RetentionPct}% (5/15 retained)`);
  console.info(`  • Guided Arm (guided_48h_v1):        ${metrics.colombiaParallelTrack.guidedD30RetentionPct}% (12/15 retained)`);
  console.info("-------------------------------------------------------------------------------");
  console.info("STAGE-BY-STAGE SCORECARD (MEXICO VS COLOMBIA REFERENCE):");
  for (const s of metrics.scorecard) {
    const sign = s.absoluteDiffPp >= 0 ? "+" : "";
    console.info(`  • ${s.stage.padEnd(26)} MX: ${String(s.mexicoRatePct).padStart(5)}% | CO: ${String(s.colombiaRatePct).padStart(5)}% | Diff: ${sign}${s.absoluteDiffPp} pp | [${s.status}]`);
  }
  console.info("===============================================================================\n");
}

main();
