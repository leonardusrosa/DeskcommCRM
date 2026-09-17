/**
 * scripts/demo/pilot-11-cli.ts
 *
 * CLI runner for GTM Pilot #11:
 * PMS Bridge Productionization & Vendor Certification.
 * Usage:
 *   pnpm demo:pilot:11
 */

import { runPilot11 } from "./lib/demo-pilot-11";

function main() {
  console.info("⚙️ [demo:pilot:11] Executando Piloto GTM #11 — Produção do PMS Bridge & Certificação de Fornecedores");
  console.info("   Track A: Produção do Conector NewSoft DS (Rollout em 3 fases, 6 clínicas de Portugal)");
  console.info("   Track B: Dossiê e Rota Oficial de Parceria Henry Schein One para Gesden G5 Desktop\n");

  const report = runPilot11();

  console.info("===============================================================================");
  console.info(" PILOT #11: FINAL PMS PRODUCTIONIZATION & VENDOR CERTIFICATION REPORT");
  console.info("===============================================================================");
  console.info("PILOT #11:\n" + report.status + "\n");
  console.info("NEWSOFT AUTHORIZATION:\n" + report.newsoftAuthorization + "\n");
  console.info("NEWSOFT CLINICS CONNECTED:\n" + report.newsoftClinicsConnected + "\n");
  console.info("NEWSOFT SYNC SUCCESS:\n" + report.newsoftSyncSuccess.toFixed(1) + "%\n");
  console.info("NEWSOFT DUPLICATES:\n" + report.newsoftDuplicates + "\n");
  console.info("NEWSOFT CONFLICT RATE:\n" + report.newsoftConflictRatePct.toFixed(1) + "%\n");
  console.info("NEWSOFT CLINICAL DATA INGESTED:\n" + report.newsoftClinicalDataIngested + "\n");
  console.info("NEWSOFT DUPLICATE-ENTRY REDUCTION:\n" + report.newsoftDuplicateEntryReductionPct.toFixed(1) + "%\n");
  console.info("NEWSOFT SUPPORT CHANGE:\n" + report.newsoftSupportChangeMinutes.toFixed(1) + " min/cliente\n");
  console.info("NEWSOFT DEALS UNBLOCKED:\n" + report.newsoftDealsUnblocked + "\n");
  console.info("NEWSOFT MRR UNBLOCKED:\n€" + report.newsoftMrrUnblockedEur + " EUR/mês\n");
  console.info("NEWSOFT CONNECTOR RESULT:\n" + report.newsoftConnectorResult + "\n");
  console.info("GESDEN VENDOR CONTACT:\n" + report.gesdenVendorContact + "\n");
  console.info("GESDEN G5 API CONFIRMED:\n" + report.gesdenG5ApiConfirmed + "\n");
  console.info("GESDEN AUTHORIZED PATH:\n" + report.gesdenAuthorizedPath + "\n");
  console.info("GESDEN PARTNER STATUS:\n" + report.gesdenPartnerStatus + "\n");
  console.info("GESDEN CLINICS WAITING:\n" + report.gesdenClinicsWaiting + "\n");
  console.info("GESDEN MRR WAITING:\n€" + report.gesdenMrrWaitingEur + " EUR/mês\n");
  console.info("GESDEN INTERIM PATH:\n" + report.gesdenInterimPath + "\n");
  console.info("GESDEN CONNECTOR RESULT:\n" + report.gesdenConnectorResult + "\n");
  console.info("INFOMED DENTOOL:\n" + report.infomedDentool + "\n");
  console.info("STRATEGIC OPPORTUNITY LEADER:\n" + report.strategicOpportunityLeader + "\n");
  console.info("BUILD-NOW READINESS LEADER:\n" + report.buildNowReadinessLeader + "\n");
  console.info("PRODUCTION SAFETY INCIDENTS:\n" + report.productionSafetyIncidents + "\n");
  console.info("SECURITY INCIDENTS:\n" + report.securityIncidents + "\n");
  console.info("CLINICAL DATA INCIDENTS:\n" + report.clinicalDataIncidents + "\n");
  console.info("NEXT SINGLE BOTTLENECK:\n" + report.nextSingleBottleneck + "\n");

  console.info("-------------------------------------------------------------------------------");
  console.info("PROGRESSIVE ROLLOUT STAGES (TRACK A — NEWSOFT DS):");
  for (const st of report.rolloutStages) {
    console.info(`  • Fase ${st.stage} (${st.clinicsCount} clínicas): [${st.status}] | Sync: ${st.syncSuccessRatePct}% | Duplicados: ${st.duplicateObjects} | Redução de Tarefa: ${st.duplicateEntryReductionPct}%`);
    console.info(`    Clínicas: ${st.clinics.join(", ")}`);
  }
  console.info("===============================================================================\n");
}

main();
