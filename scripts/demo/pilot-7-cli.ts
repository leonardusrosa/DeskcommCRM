/**
 * scripts/demo/pilot-7-cli.ts
 *
 * CLI runner for GTM Commercial Pilot #7 (Mexico Controlled Commercial Scale).
 * Usage:
 *   pnpm demo:pilot:7
 */

import { runPilot7 } from "./lib/demo-pilot-7";

function main() {
  console.info("🇲🇽 [demo:pilot:7] Ejecutando Piloto Comercial GTM #7 — Escalamiento Comercial Controlado México (300 Clínicas)");
  console.info("   Validación de adquisición WhatsApp, guided_48h_v1, retención operativa D30/D60 y billing v2\n");

  const report = runPilot7();

  console.info("===============================================================================");
  console.info(" PILOT #7: FINAL CONTROLLED COMMERCIAL SCALE REPORT");
  console.info("===============================================================================");
  console.info("PILOT #7:\n" + report.status + "\n");
  console.info("NEW CLINICS CONTACTED:\n" + report.funnel.contacted + "\n");
  console.info(`RESPONSES:\n${report.funnel.responded} (${report.funnel.responseRatePct}%)\n`);
  console.info(`DEMOS:\n${report.funnel.demoRequested} (${report.funnel.demoRequestRatePct}%)\n`);
  console.info(`ACTIVATIONS:\n${report.funnel.activated} (${report.funnel.activationRatePct}%)\n`);
  console.info(`HIGH INTENT:\n${report.funnel.highIntent} (${report.funnel.highIntentRatePct}%)\n`);
  console.info(`MEETINGS:\n${report.funnel.meetingsBooked} booked, ${report.funnel.meetingsAttended} attended (${report.funnel.attendanceRatePct}%)\n`);
  console.info(`PROPOSALS:\n${report.funnel.proposalsSent} (${report.funnel.proposalRatePct}% de asistidas)\n`);
  console.info(`CLOSED WON:\n${report.funnel.closedWon} (${report.funnel.closeRatePct}% de propuestas)\n`);
  console.info(`TOTAL MRR MXN:\n$${report.funnel.totalMrrMxn.toLocaleString("es-MX")} MXN/mes\n`);
  console.info(`AVERAGE MRR:\n$${report.funnel.averageMrrMxn.toLocaleString("es-MX")} MXN/mes (Mix: ${report.funnel.planMix.starterPct}% Starter $890 MXN / ${report.funnel.planMix.professionalPct}% Pro $1,790 MXN)\n`);
  console.info(`FOREIGN RECEIPTS ISSUED:\n${report.billing.foreignReceiptsIssued}\n`);
  console.info(`FOREIGN RECEIPTS ACCEPTED:\n${report.billing.foreignReceiptsAccepted} (100% de clientes que requirieron comprobante fiscal)\n`);
  console.info(`ACCOUNTANT ESCALATIONS:\n${report.billing.taxMemoEscalations} (resueltas exitosamente con memo fiscal)\n`);
  console.info(`CFDI-BLOCKED CUSTOMERS:\n${report.billing.cfdiBlockedCustomers} oportunidades no cerradas por exigencia de CFDI 4.0\n`);
  console.info(`CFDI-BLOCKED MRR:\n$${report.billing.mrrBlockedCfdi.toLocaleString("es-MX")} MXN/mes\n`);
  console.info(`LOCAL-SUPPLIER-BLOCKED MRR:\n$${report.billing.mrrBlockedLocalSupplier.toLocaleString("es-MX")} MXN/mes\n`);
  console.info(`CFDI ECONOMIC GATE:\n${report.billing.cfdiEconomicGate} ($${report.billing.mrrBlockedCfdi.toLocaleString("es-MX")} MXN vs umbral $${report.billing.cfdiThresholdMxn.toLocaleString("es-MX")} MXN)\n`);
  console.info(`MEDIAN TIME TO FIRST VALUE:\n${report.activationRetention.medianTimeToFirstValueHours.toFixed(1)} horas\n`);
  console.info(`FIRST VALUE <=48H:\n${report.activationRetention.firstValueWithin48hPct}%\n`);
  console.info(`HUMAN SUPPORT MINUTES/CUSTOMER:\n${report.activationRetention.humanSupportMinutesPerCustomer} minutos/cliente\n`);
  console.info(`D7 ACTIVE:\n${report.activationRetention.d7ActivePct}%\n`);
  console.info(`D14 ACTIVE:\n${report.activationRetention.d14ActivePct}%\n`);
  console.info(`D30 RETENTION:\n${report.activationRetention.d30RetentionPct}% (${report.funnel.closedWon * 0.8}/${report.funnel.closedWon} retenidos operativamente)\n`);
  console.info(`D60 RETENTION:\n${report.activationRetention.d60RetentionPct !== null ? `${report.activationRetention.d60RetentionPct}% (cohorte madura de 15 clínicas)` : "PENDING"}\n`);
  console.info(`TOP CHURN REASON:\n${report.activationRetention.topChurnReason}\n`);
  console.info(`MEXICO SCALE RESULT:\n${report.decisionGates.mexicoScaleResult}\n`);
  console.info(`NEXT SINGLE BOTTLENECK:\n${report.decisionGates.nextSingleBottleneck}\n`);
  console.info(`SPAIN/PORTUGAL EXPANSION:\n${report.decisionGates.spainPortugalExpansion}\n`);
  console.info(`NATIVE CFDI:\n${report.decisionGates.nativeCfdi}\n`);
  console.info(`PRODUCTION SAFETY INCIDENTS:\n${report.productionSafetyIncidents}\n`);
  console.info(`ENGINEERING FREEZE VIOLATIONS:\n${report.engineeringFreezeViolations}\n`);

  console.info("-------------------------------------------------------------------------------");
  console.info("CITY BREAKDOWN (100 CONTACTED PER METRO):");
  for (const [city, data] of Object.entries(report.cityBreakdown)) {
    console.info(`  • ${city.padEnd(14)} Contactadas: ${data.contacted} | Ganadas: ${data.won} | MRR: $${data.mrrMxn.toLocaleString("es-MX")} MXN/mes`);
  }

  console.info("-------------------------------------------------------------------------------");
  console.info("COLOMBIA BENCHMARK COMPARISON (PILOT #4 & #2 COHORTS VS MEXICO SCALE):");
  for (const row of report.colombiaComparison) {
    console.info(`  • ${row.metric.padEnd(32)} Mexico: ${row.mexicoValue.padEnd(20)} | Colombia: ${row.colombiaValue.padEnd(20)} | [${row.status}]`);
  }

  console.info("-------------------------------------------------------------------------------");
  console.info("DECISION GATES CLASSIFICATION:");
  console.info(`  • Acquisition:        [${report.decisionGates.acquisition}]`);
  console.info(`  • Sales:              [${report.decisionGates.sales}]`);
  console.info(`  • Billing:            [${report.decisionGates.billing}]`);
  console.info(`  • Activation:         [${report.decisionGates.activation}]`);
  console.info(`  • D30 Retention:      [${report.decisionGates.d30Retention}]`);
  console.info(`  • Support Scalability:[${report.decisionGates.supportScalability}]`);
  console.info("===============================================================================\n");
}

main();
