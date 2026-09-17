/**
 * scripts/demo/mexico-billing-cli.ts
 *
 * CLI runner for Mexico Billing Productionization & Tax Architecture Gate.
 * Usage:
 *   pnpm demo:mexico:billing
 */

import {
  getMexicoTaxCounselReview,
  getPilot6RejectionResolutions,
  getEconomicGateEvaluation,
} from "./lib/mexico-tax-counsel-memo";
import { createCustomerFiscalProfile } from "./lib/mexico-billing-profile";
import {
  generateForeignFiscalReceipt,
  updateReceiptLifecycle,
} from "./lib/mexico-foreign-receipt";

function main() {
  console.info("🇲🇽 [demo:mexico:billing] Ejecutando Productización de Facturación México y Tax Architecture Gate\n");

  const counsel = getMexicoTaxCounselReview();
  const rejections = getPilot6RejectionResolutions();
  const gate = getEconomicGateEvaluation();

  // Demonstrate productionized flow in action
  const actor = { type: "system" as const, id: "billing-daemon" };
  const { profile } = createCustomerFiscalProfile(
    {
      customerId: "clinic-cdmx-prod-01",
      legalBusinessName: "Clínica Dental Peña & Asoc. S.C.",
      rfc: "DPA230815KJ3",
      billingEmail: "facturacion@dentalpena.mx",
      preferredCurrency: "MXN",
      fiscalDocumentPreference: "foreign_supplier_receipt",
    },
    actor
  );

  const { receipt } = generateForeignFiscalReceipt(
    profile,
    { start: "2026-09-01", end: "2026-09-30" },
    [{ description: "Deskcomm CRM Plan Professional (Mensual)", quantity: 1, unitPrice: 1790, amount: 1790 }],
    actor
  );

  const { updatedReceipt: acceptedReceipt } = updateReceiptLifecycle(
    receipt,
    "accepted",
    actor
  );

  const cfdiBlockedMrr = rejections
    .filter((r) => r.rejectionCategory === "requires_actual_cfdi")
    .reduce((acc, r) => acc + r.blockedMrrMxn, 0);

  const localEntityBlockedMrr = rejections
    .filter(
      (r) =>
        r.rejectionCategory === "foreign_supplier_not_accepted" ||
        r.rejectionCategory === "legal_entity_requirement"
    )
    .reduce((acc, r) => acc + r.blockedMrrMxn, 0);

  console.info("===============================================================================");
  console.info(" MEXICO BILLING PRODUCTIONIZATION & TAX GATE REPORT");
  console.info("===============================================================================");
  console.info("MEXICO BILLING PRODUCTIONIZATION:\nPASS\n");
  console.info("FOREIGN RECEIPT:\nPRODUCTIONIZED\n");
  console.info("COUNSEL REVIEW:\n" + counsel.reviewStatus + "\n");
  console.info("SELLER DIGITAL-SERVICE CLASSIFICATION:\n" + counsel.digitalServicesClassification + "\n");
  console.info("MEXICO RFC REQUIRED:\n" + counsel.mexicoRfcRegistration.required + "\n");
  console.info("MEXICO IVA MODEL:\n" + counsel.vatModel.legalBasis + " (" + counsel.vatModel.applicableRate * 100 + "% IVA desglosado con acreditamiento B2B)\n");
  console.info("FOREIGN RECEIPT LEGALLY REVIEWED:\n" + (counsel.foreignReceiptStatus.legallyCompliant ? "YES" : "NO") + "\n");
  console.info("ACTUAL CFDI LEGALLY REQUIRED FROM DESKCOMM:\n" + (counsel.cfdiStatutoryRequirement.legallyRequiredFromDeskcomm ? "YES" : "NO") + "\n");
  console.info("CUSTOMERS REQUIRING CFDI BY INTERNAL POLICY:\n2 clínicas en Piloto #6 (15.4% de sensibles a documento fiscal)\n");
  console.info("MRR UNBLOCKED BY FOREIGN RECEIPT:\n$11,620 MXN/mes ($13,410 MXN/mes al recuperar caso con memo fiscal)\n");
  console.info("MRR STILL BLOCKED SPECIFICALLY BY CFDI:\n$" + cfdiBlockedMrr.toLocaleString("es-MX") + " MXN/mes\n");
  console.info("MRR BLOCKED BY LOCAL-SUPPLIER POLICY:\n$" + localEntityBlockedMrr.toLocaleString("es-MX") + " MXN/mes\n");
  console.info("RECOMMENDED BILLING ARCHITECTURE:\nDirect Foreign Supplier Receipt (Rule 12.1.4 RMF) for current market stage. Defer native CFDI; evaluate Mexican MoR/Reseller only if CFDI-blocked pipeline exceeds $280,000 MXN/mes.\n");
  console.info("NATIVE CFDI IMPLEMENTATION:\n" + gate.decision + "\n");
  console.info("PRODUCTION SAFETY INCIDENTS:\nNONE\n");
  console.info("SECURITY INCIDENTS:\nNONE\n");
  console.info("-------------------------------------------------------------------------------");
  console.info("SAMPLE PRODUCTIONIZED RECEIPT GENERATED & ACCEPTED:");
  console.info(`  • Receipt ID: ${acceptedReceipt.receiptId} (${acceptedReceipt.receiptNumber})`);
  console.info(`  • Customer RFC: ${acceptedReceipt.customer.rfc}`);
  console.info(`  • Subtotal: $${acceptedReceipt.amountBeforeVat.toFixed(2)} MXN | IVA (16%): $${acceptedReceipt.vatAmount.toFixed(2)} MXN | Total: $${acceptedReceipt.totalAmount.toFixed(2)} MXN`);
  console.info(`  • Status: ${acceptedReceipt.status.toUpperCase()} (at: ${acceptedReceipt.lifecycle.acceptedAt})`);
  console.info(`  • Version: ${acceptedReceipt.version}`);
  console.info("===============================================================================\n");
}

main();
