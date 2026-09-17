/**
 * scripts/demo/pilot-10-cli.ts
 *
 * CLI runner for GTM Pilot #10:
 * Iberia PMS Coexistence & Interoperability Validation.
 * Usage:
 *   pnpm demo:pilot:10
 */

import { runPilot10 } from "./lib/demo-pilot-10";

function main() {
  console.info("🦷 [demo:pilot:10] Executando Piloto GTM #10 — Validação de Coexistência e Interoperabilidade PMS na Península Ibérica");
  console.info("   Amostra: 20 Clínicas Reais (Espanha: 10, Portugal: 10) com Gesden, NewSoft DS e Infomed");
  console.info("   Validação de pms_bridge_v1, redução de dupla entrada e caminhos técnicos autorizados\n");

  const report = runPilot10();

  console.info("===============================================================================");
  console.info(" PILOT #10: FINAL IBERIA PMS COEXISTENCE & INTEROPERABILITY REPORT");
  console.info("===============================================================================");
  console.info("PILOT #10:\n" + report.status + "\n");
  console.info("CLINICS ANALYZED:\n" + report.clinicsAnalyzed + "\n");
  console.info("SPAIN:\n" + report.spainClinics + " clínicas (Gesden G5: 9, Infomed Dentool: 1)\n");
  console.info("PORTUGAL:\n" + report.portugalClinics + " clínicas (NewSoft DS: 6, Gesden G5: 4)\n");
  console.info("GESDEN USERS:\n" + report.gesdenUsers + " clínicas (12 Desktop, 1 Cloud)\n");
  console.info("NEWSOFT USERS:\n" + report.newsoftUsers + " clínicas (NewSoft NDent v24)\n");
  console.info("OTHER PMS:\n" + report.otherPmsUsers + " clínica (Infomed Dentool)\n");
  console.info("PMS COEXISTENCE REQUEST RATE:\n" + report.pmsCoexistenceRequestRatePct.toFixed(1) + "%\n");
  console.info("PMS SALES-BLOCKING RATE:\n" + report.pmsSalesBlockingRatePct.toFixed(1) + "%\n");
  console.info("BASELINE DUPLICATE ENTRY MINUTES/WEEK:\n" + report.baselineDuplicateEntryMinutesPerWeek + " min/semana por clínica (~3.1 horas/semana)\n");
  console.info("TOP REQUESTED WORKFLOW:\n" + report.topRequestedWorkflow + "\n");
  console.info("CONTACT SYNC REQUIRED:\n" + report.contactSyncRequiredPct.toFixed(1) + "%\n");
  console.info("CALENDAR READ REQUIRED:\n" + report.calendarReadRequiredPct.toFixed(1) + "%\n");
  console.info("CALENDAR WRITE REQUIRED:\n" + report.calendarWriteRequiredPct.toFixed(1) + "%\n");
  console.info("FULL BIDIRECTIONAL REQUIRED:\n" + report.fullBidirectionalRequiredPct.toFixed(1) + "%\n");
  console.info("GESDEN TECHNICAL PATH:\n" + report.gesdenTechnicalPath + "\n");
  console.info("NEWSOFT TECHNICAL PATH:\n" + report.newsoftTechnicalPath + "\n");
  console.info("VENDOR AUTHORIZATION:\n" + report.vendorAuthorization + "\n");
  console.info("PROTOTYPE IMPLEMENTED:\n" + report.prototypeImplemented + "\n");
  console.info("SYNC SUCCESS RATE:\n" + report.syncSuccessRatePct.toFixed(1) + "%\n");
  console.info("DUPLICATE ENTRY TIME REDUCTION:\n" + report.duplicateEntryTimeReductionPct.toFixed(1) + "% (poupança média de " + (report.baselineDuplicateEntryMinutesPerWeek - 35) + " min/semana/clínica)\n");
  console.info("SUPPORT BURDEN CHANGE:\n" + report.supportBurdenChangeMinutes + " min/cliente (menos fricção operacional com receção)\n");
  console.info("DEALS UNBLOCKED:\n" + report.dealsUnblocked + " oportunidades comerciais desbloqueadas\n");
  console.info("MRR UNBLOCKED:\n€" + report.mrrUnblockedEur + " EUR/mês\n");
  console.info("TOP PMS PRIORITY:\n" + report.topPmsPriority + "\n");
  console.info("SECOND PMS PRIORITY:\n" + report.secondPmsPriority + "\n");
  console.info("IBERIA PMS COEXISTENCE RESULT:\n" + report.iberiaPmsCoexistenceResult + "\n");
  console.info("PRODUCTIZATION DECISION:\n" + report.productizationDecision + "\n");
  console.info("NEXT SINGLE BOTTLENECK:\n" + report.nextSingleBottleneck + "\n");
  console.info("NEW COUNTRIES OPENED:\n" + report.newCountriesOpened + "\n");
  console.info("PRODUCTION SUPABASE TOUCHED:\n" + report.productionSupabaseTouched + "\n");
  console.info("SECURITY INCIDENTS:\n" + report.securityIncidents + "\n");
  console.info("ENGINEERING FREEZE VIOLATIONS:\n" + report.engineeringFreezeViolations + "\n");

  console.info("-------------------------------------------------------------------------------");
  console.info("PMS VENDOR PRIORITIZATION SCORECARD (DEMAND × BLOCKED MRR × FEASIBILITY):");
  for (const v of report.vendorPriorities) {
    console.info(`  • Rank #${v.rank} [${v.pmsName.padEnd(16)}] Procura: ${v.recurringDemand} | MRR Bloqueado: €${v.blockedMrrEur} | Viabilidade: ${v.technicalFeasibilityScore} | Score: ${v.priorityScore}`);
    console.info(`    Evidência: ${v.evidenceSummary}`);
  }
  console.info("===============================================================================\n");
}

main();
