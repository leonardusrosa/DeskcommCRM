/**
 * scripts/demo/pilot-3-cli.ts
 *
 * CLI runner for GTM Commercial Pilot #3 (Colombia Dental Proposal Consensus Validation).
 * Usage:
 *   pnpm demo:pilot:3
 */

import { runPilot3 } from "./lib/demo-pilot-3";

function main() {
  console.info("🇨🇴 [demo:pilot:3] Ejecutando Piloto Comercial GTM #3 — Validación de Consenso en Propuestas");
  console.info("   Muestra: 32 Oportunidades en etapa de propuesta (Bogotá, Medellín, Cali)");
  console.info("   Variable experimental: standard_v1 (Control) vs consensus_assisted_v1 (Treatment)\n");

  const { metrics } = runPilot3();

  console.info("===============================================================================");
  console.info(" PILOT #3: FINAL COMMERCIAL EXPERIMENT REPORT");
  console.info("===============================================================================");
  console.info("PILOT #3:\nCOMPLETE\n");
  console.info(`TOTAL PROPOSALS:\n${metrics.totalProposals}\n`);
  console.info(`CONTROL PROPOSALS:\n${metrics.controlProposals}\n`);
  console.info(`CONSENSUS-ASSISTED PROPOSALS:\n${metrics.treatmentProposals}\n`);
  console.info(`MULTI-DECISION-MAKER DEALS:\n${metrics.control.multiDecisionMakerDeals + metrics.treatment.multiDecisionMakerDeals} (${metrics.control.multiDecisionMakerDeals} control, ${metrics.treatment.multiDecisionMakerDeals} treatment)\n`);
  console.info(`PROPOSAL OPEN RATE:\nControl: ${metrics.control.openRatePct}% | Treatment: ${metrics.treatment.openRatePct}%\n`);
  console.info(`PROPOSAL SHARE RATE:\nControl: ${metrics.control.shareRatePct}% | Treatment: ${metrics.treatment.shareRatePct}%\n`);
  console.info(`FULL STAKEHOLDER COVERAGE:\nControl: ${metrics.control.fullStakeholderCoveragePct}% | Treatment: ${metrics.treatment.fullStakeholderCoveragePct}%\n`);
  console.info(`CONTROL MEDIAN PROPOSAL → DECISION:\n${metrics.control.medianProposalToDecisionHours} horas (mean: ${metrics.control.avgProposalToDecisionHours}h, p75: ${metrics.control.p75ProposalToDecisionHours}h)\n`);
  console.info(`TREATMENT MEDIAN PROPOSAL → DECISION:\n${metrics.treatment.medianProposalToDecisionHours} horas (mean: ${metrics.treatment.avgProposalToDecisionHours}h, p75: ${metrics.treatment.p75ProposalToDecisionHours}h)\n`);
  console.info(`VELOCITY CHANGE:\n${metrics.velocityChangeHours} horas (${metrics.velocityChangePct}% de latencia)\n`);
  console.info(`CONTROL CLOSE RATE:\n${metrics.control.closeRatePct}% (${metrics.control.closedWon}/${metrics.control.totalProposals})\n`);
  console.info(`TREATMENT CLOSE RATE:\n${metrics.treatment.closeRatePct}% (${metrics.treatment.closedWon}/${metrics.treatment.totalProposals})\n`);
  console.info(`CONTROL NO-DECISION RATE:\n${metrics.control.noDecisionRatePct}% (${metrics.control.noDecisionCount}/${metrics.control.totalProposals})\n`);
  console.info(`TREATMENT NO-DECISION RATE:\n${metrics.treatment.noDecisionRatePct}% (${metrics.treatment.noDecisionCount}/${metrics.treatment.totalProposals})\n`);
  console.info(`MRR WON:\n$${(metrics.control.totalMrrWonCop + metrics.treatment.totalMrrWonCop).toLocaleString("es-CO")} COP/mes (Control: $${metrics.control.totalMrrWonCop.toLocaleString("es-CO")}, Treatment: $${metrics.treatment.totalMrrWonCop.toLocaleString("es-CO")})\n`);
  console.info(`AVERAGE MRR / WON CUSTOMER:\nControl: $${metrics.control.avgMrrWonCustomerCop.toLocaleString("es-CO")} COP | Treatment: $${metrics.treatment.avgMrrWonCustomerCop.toLocaleString("es-CO")} COP\n`);
  console.info(`SAMPLE SIZE WARNING:\n${metrics.sampleSizeWarning ? "YES" : "NO"}\n${metrics.sampleSizeWarningDetails}\n`);
  console.info(`CONSENSUS FLOW RESULT:\n${metrics.consensusFlowResult}\n`);
  console.info(`NEXT SINGLE BOTTLENECK:\n${metrics.nextSingleBottleneck}\n`);
  console.info(`PRODUCTION SUPABASE TOUCHED:\nNO\n`);
  console.info(`ENGINEERING FREEZE VIOLATIONS:\n${metrics.engineeringFreezeViolations}\n`);
  console.info("===============================================================================");
  console.info("SEGMENTATION BREAKDOWN:");
  console.info(`  • Por Ciudad: Bogotá ${metrics.segmentation.byCity["Bogotá"]?.won}/${metrics.segmentation.byCity["Bogotá"]?.total} won | Medellín ${metrics.segmentation.byCity["Medellín"]?.won}/${metrics.segmentation.byCity["Medellín"]?.total} won | Cali ${metrics.segmentation.byCity["Cali"]?.won}/${metrics.segmentation.byCity["Cali"]?.total} won`);
  console.info(`  • Por Sillones: 2-3 sillas (mediana: ${metrics.segmentation.byChairs["2-3 chairs"]?.medianHours}h, won: ${metrics.segmentation.byChairs["2-3 chairs"]?.won}/${metrics.segmentation.byChairs["2-3 chairs"]?.total}) | 4-6 sillas (mediana: ${metrics.segmentation.byChairs["4-6 chairs"]?.medianHours}h, won: ${metrics.segmentation.byChairs["4-6 chairs"]?.won}/${metrics.segmentation.byChairs["4-6 chairs"]?.total})`);
  console.info(`  • Por Decisores: 1 decisor (mediana: ${metrics.segmentation.byDecisionMakers["1 decision-maker"]?.medianHours}h) | Múltiples decisores (cobertura: ${metrics.segmentation.byDecisionMakers["multiple decision-makers"]?.fullCoveragePct}%, mediana: ${metrics.segmentation.byDecisionMakers["multiple decision-makers"]?.medianHours}h)`);
  console.info("===============================================================================\n");
}

main();
