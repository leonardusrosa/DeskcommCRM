/**
 * scripts/demo/lib/mexico-foreign-receipt.ts
 *
 * Productized Foreign Fiscal Receipt generator & lifecycle manager.
 * Version: foreign_fiscal_receipt_v2_approved
 *
 * Implements Rule 12.1.4 RMF compliance for foreign digital services.
 * Strictly verifies zero fake CFDI attributes (UUID, SAT seal, PAC, XML).
 */

import crypto from "node:crypto";
import type {
  CustomerFiscalProfile,
  FiscalAuditEvent,
  ForeignFiscalReceipt,
  ReceiptBillingPeriod,
  ReceiptIssuerInfo,
  ReceiptLineItem,
  ReceiptStatus,
} from "@/types/mexico-billing";

export const APPROVED_ISSUER_INFO: ReceiptIssuerInfo = {
  legalName: "Deskcomm Technologies Inc.",
  country: "United States",
  taxIdentifier: "EIN-84-3920194",
  cityAndCountry: "Delaware, United States",
  establishmentStatus: "NO_PERMANENT_ESTABLISHMENT_IN_MEXICO",
};

export const LEGAL_DISCLAIMER =
  "ESTE COMPROBANTE FISCAL NO ES UN CFDI 4.0 MEXICANO. " +
  "Es emitido por un residente en el extranjero sin establecimiento permanente en México que presta servicios digitales, " +
  "conforme a las disposiciones aplicables en materia de comercio electrónico internacional y reglas complementarias de la RMF (Regla 12.1.4). " +
  "Identifica de forma expresa y por separado el Impuesto al Valor Agregado (IVA 16%) y el RFC del receptor para fines de contabilidad y deducción.";

export function renderReceiptText(receipt: Omit<ForeignFiscalReceipt, "renderedDocument">): string {
  return [
    "===============================================================================",
    "               COMPROBANTE DE PAGO DE PROVEEDOR EXTRANJERO                    ",
    "               (FOREIGN DIGITAL SERVICE PROVIDER RECEIPT)                     ",
    "===============================================================================",
    `Número de Recibo : ${receipt.receiptNumber}`,
    `Fecha de Emisión : ${receipt.issueDate}`,
    `Período de Cobro : ${receipt.billingPeriod.start} al ${receipt.billingPeriod.end}`,
    `Estado           : ${receipt.status.toUpperCase()}`,
    "-------------------------------------------------------------------------------",
    "EMISOR (PROVEEDOR EXTRANJERO SIN ESTABLECIMIENTO EN MÉXICO):",
    `  Razón Social  : ${receipt.issuer.legalName}`,
    `  País / Ciudad : ${receipt.issuer.cityAndCountry}`,
    `  Tax ID / EIN  : ${receipt.issuer.taxIdentifier}`,
    "-------------------------------------------------------------------------------",
    "RECEPTOR (CLIENTE EN MÉXICO):",
    `  Razón Social  : ${receipt.customer.legalBusinessName}`,
    `  RFC Receptor  : ${receipt.customer.rfc}`,
    `  Correo Cobranza: ${receipt.customer.billingEmail}`,
    "-------------------------------------------------------------------------------",
    "DETALLE DE SERVICIOS:",
    ...receipt.lineItems.map(
      (li) => `  • ${li.description} (Cant: ${li.quantity}) - $${li.amount.toFixed(2)} MXN`
    ),
    "-------------------------------------------------------------------------------",
    `Subtotal (antes de IVA) : $${receipt.amountBeforeVat.toFixed(2)} MXN`,
    `IVA Trasladado (16%)    : $${receipt.vatAmount.toFixed(2)} MXN`,
    `TOTAL COBRADO           : $${receipt.totalAmount.toFixed(2)} MXN (${receipt.currency})`,
    "===============================================================================",
    "AVISO LEGAL FISCAL OBLIGATORIO:",
    receipt.legalDisclaimer,
    "===============================================================================",
  ].join("\n");
}

export function assertNoFakeCfdiAttributes(receipt: ForeignFiscalReceipt): void {
  const raw = receipt as unknown as Record<string, unknown>;
  const forbidden = [
    "uuidFiscal", "uuid_fiscal", "selloSat", "sello_sat", "selloDigital",
    "cfdiXml", "cfdi_xml", "pacCertificado", "noCertificadoSat",
    "cadenaOriginalSat", "timbreFiscal",
  ];
  for (const attr of forbidden) {
    if (raw[attr] !== undefined) {
      throw new Error(`INTEGRITY VIOLATION: Receipt contains forbidden simulated CFDI attribute "${attr}".`);
    }
  }
}

let receiptCounter = 1000;

export function generateForeignFiscalReceipt(
  profile: CustomerFiscalProfile,
  billingPeriod: ReceiptBillingPeriod,
  lineItems: ReceiptLineItem[],
  actor: { type: "system" | "operator"; id: string }
): { receipt: ForeignFiscalReceipt; auditEvent: FiscalAuditEvent } {
  receiptCounter += 1;
  const receiptId = `dfr-${crypto.randomUUID().slice(0, 8)}`;
  const receiptNumber = `DFR-2026-${receiptCounter}`;
  const now = new Date().toISOString();

  const amountBeforeVat = lineItems.reduce((acc, item) => acc + item.amount, 0);
  const vatRate = 0.16;
  const vatAmount = parseFloat((amountBeforeVat * vatRate).toFixed(2));
  const totalAmount = parseFloat((amountBeforeVat + vatAmount).toFixed(2));

  const base: Omit<ForeignFiscalReceipt, "renderedDocument"> = {
    receiptId,
    receiptNumber,
    version: "foreign_fiscal_receipt_v2_approved",
    issuer: APPROVED_ISSUER_INFO,
    customer: {
      customerId: profile.customerId,
      legalBusinessName: profile.legalBusinessName,
      rfc: profile.rfc,
      billingEmail: profile.billingEmail,
    },
    billingPeriod,
    lineItems,
    amountBeforeVat,
    vatRate,
    vatAmount,
    totalAmount,
    currency: "MXN",
    issueDate: now.slice(0, 10),
    status: "issued",
    lifecycle: { generatedAt: now },
    legalDisclaimer: LEGAL_DISCLAIMER,
  };

  const receipt: ForeignFiscalReceipt = {
    ...base,
    renderedDocument: renderReceiptText(base),
  };

  assertNoFakeCfdiAttributes(receipt);

  const auditEvent: FiscalAuditEvent = {
    id: `audit-${crypto.randomUUID()}`,
    timestamp: now,
    actor,
    customerId: profile.customerId,
    rfcUsed: profile.rfc,
    documentVersion: receipt.version,
    receiptId: receipt.receiptId,
    action: "receipt_generated",
    details: { receiptNumber, totalAmount, currency: "MXN", vatAmount },
  };

  return { receipt, auditEvent };
}

export function updateReceiptLifecycle(
  receipt: ForeignFiscalReceipt,
  newStatus: ReceiptStatus,
  actor: { type: "system" | "operator"; id: string },
  opts?: { disputeReason?: string; replacedByReceiptId?: string }
): { updatedReceipt: ForeignFiscalReceipt; auditEvent: FiscalAuditEvent } {
  const now = new Date().toISOString();
  const lifecycle = { ...receipt.lifecycle };

  let action: FiscalAuditEvent["action"] = "receipt_generated";

  if (newStatus === "delivered") {
    lifecycle.deliveredAt = now;
    action = "receipt_delivered";
  } else if (newStatus === "opened") {
    lifecycle.openedAt = now;
    action = "receipt_opened";
  } else if (newStatus === "accepted") {
    lifecycle.acceptedAt = now;
    action = "receipt_accepted";
  } else if (newStatus === "disputed") {
    lifecycle.disputedAt = now;
    lifecycle.disputeReason = opts?.disputeReason ?? "Unspecified dispute";
    action = "receipt_disputed";
  } else if (newStatus === "replaced") {
    lifecycle.replacedByReceiptId = opts?.replacedByReceiptId;
    action = "receipt_replaced";
  } else if (newStatus === "cancelled") {
    action = "receipt_cancelled";
  }

  const updatedReceipt: ForeignFiscalReceipt = {
    ...receipt,
    status: newStatus,
    lifecycle,
  };

  updatedReceipt.renderedDocument = renderReceiptText(updatedReceipt);

  const auditEvent: FiscalAuditEvent = {
    id: `audit-${crypto.randomUUID()}`,
    timestamp: now,
    actor,
    customerId: receipt.customer.customerId,
    rfcUsed: receipt.customer.rfc,
    documentVersion: receipt.version,
    receiptId: receipt.receiptId,
    action,
    details: { newStatus, ...(opts?.disputeReason ? { reason: opts.disputeReason } : {}) },
  };

  return { updatedReceipt, auditEvent };
}

export function replaceForeignFiscalReceipt(
  originalReceipt: ForeignFiscalReceipt,
  newLineItems: ReceiptLineItem[],
  newBillingPeriod: ReceiptBillingPeriod,
  actor: { type: "system" | "operator"; id: string }
): {
  replacedOriginal: ForeignFiscalReceipt;
  newReceipt: ForeignFiscalReceipt;
  auditEvents: FiscalAuditEvent[];
} {
  // Create profile adapter from original snapshot
  const profileAdapter: CustomerFiscalProfile = {
    customerId: originalReceipt.customer.customerId,
    legalBusinessName: originalReceipt.customer.legalBusinessName,
    rfc: originalReceipt.customer.rfc,
    billingEmail: originalReceipt.customer.billingEmail,
    country: "MX",
    preferredCurrency: "MXN",
    fiscalDocumentPreference: "foreign_supplier_receipt",
    createdAt: originalReceipt.lifecycle.generatedAt,
    updatedAt: new Date().toISOString(),
  };

  // Generate replacement receipt
  const { receipt: newReceipt, auditEvent: genAudit } = generateForeignFiscalReceipt(
    profileAdapter,
    newBillingPeriod,
    newLineItems,
    actor
  );
  newReceipt.lifecycle.replacedReceiptId = originalReceipt.receiptId;

  // Mark original as replaced
  const { updatedReceipt: replacedOriginal, auditEvent: replaceAudit } = updateReceiptLifecycle(
    originalReceipt,
    "replaced",
    actor,
    { replacedByReceiptId: newReceipt.receiptId }
  );

  return {
    replacedOriginal,
    newReceipt,
    auditEvents: [genAudit, replaceAudit],
  };
}
