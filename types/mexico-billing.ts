/**
 * types/mexico-billing.ts
 *
 * Types for Mexico Billing Compliance & Foreign Fiscal Receipt Productionization.
 * Implements Part A, B, C, D, E, F of Mexico Billing Compliance Architecture.
 *
 * CRITICAL SECURITY & REGULATORY RULE:
 * Absolutely NO SAT credentials (e.firma, CSD, private keys, SAT password, PAC certs)
 * may ever be defined, collected, stored, or processed.
 */

export type MexicoFiscalDocumentPreference =
  | 'foreign_supplier_receipt'
  | 'cfdi_requested'
  | 'none';

export type ReceiptStatus =
  | 'issued'
  | 'delivered'
  | 'opened'
  | 'accepted'
  | 'disputed'
  | 'replaced'
  | 'cancelled';

export interface MexicoFiscalAddress {
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  neighborhood?: string;
  postalCode: string;
  city: string;
  state: string;
  country: 'MX';
}

export interface CustomerFiscalProfile {
  customerId: string;
  legalBusinessName: string;
  rfc: string; // Validated Mexican RFC format
  billingEmail: string;
  fiscalAddress?: MexicoFiscalAddress;
  country: 'MX';
  preferredCurrency: 'MXN' | 'USD';
  fiscalDocumentPreference: MexicoFiscalDocumentPreference;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ReceiptIssuerInfo {
  legalName: string;
  country: string;
  taxIdentifier: string; // Foreign tax ID, NOT Mexican RFC
  cityAndCountry: string;
  establishmentStatus: 'NO_PERMANENT_ESTABLISHMENT_IN_MEXICO';
}

export interface ReceiptCustomerSnapshot {
  customerId: string;
  legalBusinessName: string;
  rfc: string;
  billingEmail: string;
}

export interface ReceiptBillingPeriod {
  start: string;
  end: string;
}

export interface ReceiptLifecycleState {
  generatedAt: string;
  deliveredAt?: string;
  openedAt?: string;
  acceptedAt?: string;
  disputedAt?: string;
  disputeReason?: string;
  replacedByReceiptId?: string;
  replacedReceiptId?: string;
}

export interface ForeignFiscalReceipt {
  receiptId: string;
  receiptNumber: string;
  version: 'foreign_fiscal_receipt_v2_approved';
  issuer: ReceiptIssuerInfo;
  customer: ReceiptCustomerSnapshot;
  billingPeriod: ReceiptBillingPeriod;
  lineItems: ReceiptLineItem[];
  amountBeforeVat: number;
  vatRate: number; // 0.16
  vatAmount: number;
  totalAmount: number;
  currency: 'MXN';
  issueDate: string;
  status: ReceiptStatus;
  lifecycle: ReceiptLifecycleState;
  legalDisclaimer: string;
  renderedDocument: string;
}

export type FiscalAuditAction =
  | 'profile_created'
  | 'profile_updated'
  | 'receipt_generated'
  | 'receipt_delivered'
  | 'receipt_opened'
  | 'receipt_accepted'
  | 'receipt_disputed'
  | 'receipt_replaced'
  | 'receipt_cancelled';

export interface FiscalAuditEvent {
  id: string;
  timestamp: string;
  actor: { type: 'system' | 'operator'; id: string };
  customerId: string;
  rfcUsed: string;
  documentVersion: string;
  receiptId: string;
  action: FiscalAuditAction;
  details: Record<string, unknown>;
}

export interface MexicoBillingMetrics {
  fiscalDocumentRequests: number;
  foreignReceiptsIssued: number;
  foreignReceiptsAccepted: number;
  foreignReceiptsRejected: number;
  accountantEscalations: number;
  actualCfdiRequests: number;
  mrrUnblockedByForeignReceipt: number;
  mrrBlockedByCfdi: number;
  mrrBlockedByLocalEntityPolicy: number;
  averageBillingApprovalTimeHours: number;
}
