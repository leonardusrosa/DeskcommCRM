/**
 * scripts/demo/pilot-6-cli.ts
 *
 * CLI runner for GTM Commercial Pilot #6 (Mexico Billing Compliance Validation).
 * Usage:
 *   pnpm demo:pilot:6
 */

import { runPilot6 } from "./lib/demo-pilot-6";

function main() {
  console.info("🇲🇽 [demo:pilot:6] Ejecutando Piloto Comercial GTM #6 — Validación de Cumplimiento Fiscal México");
  console.info("   Evaluación: billing_flow = foreign_fiscal_receipt_v1 frente a requisitos de clínicas dentales en México\n");

  const report = runPilot6();

  console.info("===============================================================================");
  console.info(" PILOT #6: FINAL BILLING COMPLIANCE VALIDATION REPORT");
  console.info("===============================================================================");
  console.info("PILOT #6:\n" + report.status + "\n");
  console.info("OPPORTUNITIES INTERVIEWED:\n" + report.opportunitiesInterviewed + "\n");
  console.info("FISCAL-DOCUMENT-SENSITIVE:\n" + report.fiscalDocumentSensitive + "\n");
  console.info("FOREIGN RECEIPT TESTED:\n" + report.foreignReceiptTested + "\n");
  console.info("FOREIGN RECEIPT ACCEPTED:\n" + report.foreignReceiptAccepted + "\n");
  console.info("ACCEPTANCE RATE:\n" + report.acceptanceRate + "%\n");
  console.info("ACTUAL CFDI STILL REQUIRED:\n" + report.actualCfdiStillRequired + "\n");
  console.info("DEALS UNBLOCKED:\n" + report.dealsUnblocked + "\n");
  console.info("MRR UNBLOCKED:\n$" + report.mrrUnlocked.toLocaleString("es-MX") + " MXN/mes\n");
  console.info("DEALS LOST:\n" + report.dealsLost + "\n");
  console.info("TOP REJECTION REASON:\n" + (report.topRejectionReason ?? "none") + "\n");
  console.info("ACCOUNTANT ESCALATION RATE:\n" + report.accountantEscalationRate + "%\n");
  console.info("AVG BILLING APPROVAL TIME:\n" + (report.avgBillingApprovalTimeHours !== null ? report.avgBillingApprovalTimeHours + " hours" : "N/A") + "\n");
  console.info("MEXICO BILLING RESULT:\n" + report.mexicoBillingResult + "\n");
  console.info("RECOMMENDED MINIMUM ARCHITECTURE:\n" + report.recommendedMinArchitecture + "\n");
  console.info("LEGAL/TAX REVIEW:\n" + report.legalTaxReview + "\n");
  console.info("NEW PRODUCT MODULES:\n" + (report.newProductModules.length > 0 ? report.newProductModules.join(", ") : "NONE") + "\n");
  console.info("PRODUCTION SUPABASE TOUCHED:\nNO\n");
  console.info("ENGINEERING FREEZE VIOLATIONS:\n" + report.engineeringFreezeViolations + "\n");

  console.info("-------------------------------------------------------------------------------");
  console.info("DISCOVERY DETAILS (20 OPPORTUNITIES ACROSS CDMX, GDL, MTY):");
  console.info(`  • Fiscal Document Sensitive: ${report.fiscalDocumentSensitive}/20 (${((report.fiscalDocumentSensitive / 20) * 100).toFixed(1)}%)`);
  console.info(`  • Non-Sensitive (No Comprobante): ${20 - report.fiscalDocumentSensitive}/20 (${(((20 - report.fiscalDocumentSensitive) / 20) * 100).toFixed(1)}%)`);
  console.info(`  • Foreign Receipt Acceptance among Sensitive: ${report.foreignReceiptAccepted}/${report.foreignReceiptTested} (${report.acceptanceRate}%)`);
  console.info(`  • MRR Unlocked via Foreign Receipt: $${report.mrrUnlocked.toLocaleString("es-MX")} MXN/mes`);
  console.info(`  • Deals Lost (Inability to provide CFDI/Local Entity): ${report.dealsLost} deals`);

  console.info("-------------------------------------------------------------------------------");
  console.info("REJECTION TAXONOMY:");
  for (const [reason, count] of Object.entries(report.rejectionTaxonomy)) {
    console.info(`  • ${reason}: ${count}`);
  }

  console.info("-------------------------------------------------------------------------------");
  console.info("ESCALATION PATHS EVALUATION:");
  for (const opt of report.escalationOptions) {
    console.info(`  Path ${opt.path}: ${opt.description}`);
    console.info(`    - Compliance: ${opt.complianceFeasibility} | Op Complexity: ${opt.operationalComplexity}`);
    console.info(`    - Cost: ${opt.expectedCost}`);
    console.info(`    - Customer Acceptance: ${opt.customerAcceptance}`);
    console.info(`    - Engineering Impact: ${opt.engineeringImpact}`);
  }
  console.info("===============================================================================\n");
}

main();
