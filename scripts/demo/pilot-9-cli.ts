/**
 * scripts/demo/pilot-9-cli.ts
 *
 * CLI runner for GTM Commercial Pilot #9 (Portugal Dental Market Replication).
 * Usage:
 *   pnpm demo:pilot:9
 */

import { runPilot9 } from "./lib/demo-pilot-9";

function main() {
  console.info("🇵🇹 [demo:pilot:9] Executando Piloto Comercial GTM #9 — Replicação de Mercado Portugal");
  console.info("   Amostra: 100 Novas Clínicas Dentárias Privadas (Lisboa: 34, Porto: 33, Braga: 33)");
  console.info("   Validação de Playbook GTM, Onboarding 48h, Staff Handoff e Coexistência com NewSoft NDent / Gesden\n");

  const report = runPilot9();

  console.info("===============================================================================");
  console.info(" PILOT #9: FINAL PORTUGAL MARKET REPLICATION REPORT");
  console.info("===============================================================================");
  console.info("PILOT #9:\n" + report.status + "\n");
  console.info("MARKET:\n" + report.market + "\n");
  console.info("CONTACTED:\n" + report.contacted + "\n");
  console.info(`LISBOA:\n${report.cityBreakdown.Lisboa.contacted} contactadas (${report.cityBreakdown.Lisboa.won} ganhas, €${report.cityBreakdown.Lisboa.mrrEur} EUR/mês)\n`);
  console.info(`PORTO:\n${report.cityBreakdown.Porto.contacted} contactadas (${report.cityBreakdown.Porto.won} ganhas, €${report.cityBreakdown.Porto.mrrEur} EUR/mês)\n`);
  console.info(`BRAGA:\n${report.cityBreakdown.Braga.contacted} contactadas (${report.cityBreakdown.Braga.won} ganhas, €${report.cityBreakdown.Braga.mrrEur} EUR/mês)\n`);
  console.info(`RESPONSES:\n${report.responses}\n`);
  console.info(`RESPONSE RATE:\n${report.responseRatePct.toFixed(1)}%\n`);
  console.info(`DEMO REQUESTS:\n${report.demoRequests}\n`);
  console.info(`DEMO REQUEST RATE:\n${report.demoRequestRatePct.toFixed(1)}%\n`);
  console.info(`ACTIVATIONS:\n${report.activations}\n`);
  console.info(`ACTIVATION RATE:\n${report.activationRatePct.toFixed(1)}%\n`);
  console.info(`HIGH INTENT:\n${report.highIntent}\n`);
  console.info(`HIGH INTENT RATE:\n${report.highIntentRatePct.toFixed(1)}%\n`);
  console.info(`MEETINGS BOOKED:\n${report.meetingsBooked}\n`);
  console.info(`HIGH INTENT -> MEETING:\n${report.highIntentToMeetingRatePct.toFixed(1)}%\n`);
  console.info(`MEETINGS ATTENDED:\n${report.meetingsAttended}\n`);
  console.info(`ATTENDANCE RATE:\n${report.attendanceRatePct.toFixed(1)}%\n`);
  console.info(`PROPOSALS:\n${report.proposalsSent}\n`);
  console.info(`CLOSED WON:\n${report.closedWon}\n`);
  console.info(`CLOSED LOST:\n${report.closedLost}\n`);
  console.info(`CLOSE RATE:\n${report.closeRatePct.toFixed(1)}%\n`);
  console.info(`MRR WON EUR:\n€${report.mrrWonEur}\n`);
  console.info(`AVERAGE MRR:\n€${report.averageMrrEur.toFixed(2)}\n`);
  console.info(`PLAN MIX:\nStarter ${report.planMix.starterPct.toFixed(1)}% / Professional ${report.planMix.professionalPct.toFixed(1)}%\n`);
  console.info(`MEDIAN PROPOSAL -> DECISION:\n${report.medianProposalToDecisionHours} horas\n`);
  console.info(`MEDIAN TIME TO FIRST VALUE:\n${report.medianTimeToFirstValueHours.toFixed(1)}h\n`);
  console.info(`FIRST VALUE <=24H:\n${report.firstValueWithin24hPct.toFixed(1)}%\n`);
  console.info(`FIRST VALUE <=48H:\n${report.firstValueWithin48hPct.toFixed(1)}%\n`);
  console.info(`FIRST VALUE <=72H:\n${report.firstValueWithin72hPct.toFixed(1)}%\n`);
  console.info(`HUMAN SUPPORT MINUTES/CUSTOMER:\n${report.humanSupportMinutesPerCustomer.toFixed(1)}\n`);
  console.info(`D7 ACTIVE:\n${report.d7ActivePct.toFixed(1)}%\n`);
  console.info(`D14 ACTIVE:\n${report.d14ActivePct.toFixed(1)}%\n`);
  console.info(`D30 RETENTION:\n${report.d30RetentionPct.toFixed(1)}%\n`);
  console.info(`D60 RETENTION:\n${report.d60RetentionStatus}\n`);
  console.info(`BILLING/TAX BLOCKED:\n${report.billingTaxBlocked}\n`);
  console.info(`PMS COEXISTENCE REQUESTS:\n${report.pmsCoexistenceRequests}\n`);
  console.info(`PMS INTEGRATION BLOCKED:\n${report.pmsIntegrationBlocked}\n`);
  console.info(`TOP EXISTING PMS:\n${report.topExistingPms}\n`);
  console.info(`TOP LOST REASON:\n${report.topLostReason}\n`);
  console.info(`TOP PORTUGAL LOCALIZATION DIFFERENCE:\n${report.topPortugalLocalizationDifference}\n`);
  console.info(`STAFF HANDOFF EVENTS:\n${report.staffHandoffMetrics.eventsCount}\n`);
  console.info(`STAFF HANDOFF COMPLETION:\n${report.staffHandoffMetrics.completionRatePct.toFixed(1)}%\n`);
  console.info(`STAFF HANDOFF SUPPORT MINUTES:\n${report.staffHandoffMetrics.supportMinutesTotal}\n`);
  console.info(`PORTUGAL PLAYBOOK RESULT:\n${report.portugalPlaybookResult}\n`);
  console.info(`NEXT SINGLE BOTTLENECK:\n${report.nextSingleBottleneck}\n`);
  console.info(`PRODUCT CHANGES REQUIRED:\n${report.productChangesRequired}\n`);
  console.info(`PRODUCTION SUPABASE TOUCHED:\n${report.productionSupabaseTouched}\n`);
  console.info(`PRODUCTION SAFETY INCIDENTS:\n${report.productionSafetyIncidents}\n`);
  console.info(`ENGINEERING FREEZE VIOLATIONS:\n${report.engineeringFreezeViolations}\n`);

  console.info("-------------------------------------------------------------------------------");
  console.info("REPLICATION SCORECARD (PORTUGAL VS SPAIN & MEXICO REFERENCE):");
  for (const s of report.scorecard) {
    console.info(`  • ${s.stage.padEnd(28)} PT: ${String(s.portugalRatePct).padStart(5)}% | ES: ${String(s.spainReferencePct).padStart(5)}% | MX: ${String(s.mexicoReferencePct).padStart(5)}% | [${s.status}]`);
  }
  console.info("===============================================================================\n");
}

main();
