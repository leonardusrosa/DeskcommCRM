/**
 * types/demo-pilot-6.ts
 *
 * Type definitions for GTM Pilot #6 — Mexico Billing Compliance Validation.
 * Tests billing_flow = foreign_fiscal_receipt_v1 against Mexican dental clinic
 * procurement requirements.
 *
 * SECURITY: No fiscal credentials, RFC private keys, CSD, e-firma, or PAC
 * certificates may be committed to source control under any circumstance.
 */

export type RejectionReason =
  | 'requires_actual_cfdi'
  | 'missing_rfc'
  | 'missing_vat_detail'
  | 'foreign_supplier_not_accepted'
  | 'internal_procurement_policy'
  | 'accountant_uncertainty'
  | 'legal_entity_requirement'
  | 'payment_method_requirement'
  | 'other';

export type FiscalDocumentType =
  | 'cfdi_4_0'
  | 'foreign_supplier_receipt'
  | 'factura_simple'
  | 'nota_de_venta'
  | 'no_document_required'
  | 'unknown';

export type BillingFlow = 'foreign_fiscal_receipt_v1';

export type MexicoBillingResult =
  | 'FOREIGN_RECEIPT_SUFFICIENT'
  | 'LOCAL_CFDI_REQUIRED_FOR_MATERIAL_SEGMENT'
  | 'MIXED'
  | 'INCONCLUSIVE';

export type EscalationPath = 'A' | 'B' | 'C' | 'D';

export interface Pilot6Opportunity {
  id: string;
  clinic: string;
  city: string;
  legalEntityBuyer: string;
  rfcRequested: string | null;
  fiscalDocumentRequired: boolean;
  requestedDocumentType: FiscalDocumentType;
  /** Raw customer wording — must NOT be normalized away. */
  exactCustomerWording: string;
  accountantInvolved: boolean;
  documentAccepted: boolean | null;
  documentRejected: boolean | null;
  rejectionReason: RejectionReason | null;
  rejectionNotes: string | null;
  dealBlocked: boolean;
  dealUnblocked: boolean;
  decisionTimeHours: number | null;
  mrr: number; // MXN
  billingFlow: BillingFlow;
  pilot5Carryover: boolean;
}

/**
 * Foreign supplier receipt template.
 * NOT a Mexican CFDI 4.0. Must not contain UUID fiscal, SAT seal,
 * CFDI XML, certificate numbers, PAC certification, or RFC of issuer.
 * Legal entity fields are placeholders pending tax counsel review.
 */
export interface ForeignFiscalReceiptTemplate {
  issuerLegalName: string;
  issuerCityCountry: string;
  /** Foreign tax ID — NOT an RFC. Requires tax counsel review. */
  issuerTaxId: string;
  serviceDescription: string;
  amountBeforeVat: number; // MXN
  vatRate: number; // e.g. 0.16
  vatAmount: number; // MXN
  totalAmount: number; // MXN
  issueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  customerRfc: string | null;
  /** Explicit disclaimer required on every copy of this document. */
  warning: string;
}

export interface EscalationOption {
  path: EscalationPath;
  description: string;
  complianceFeasibility: 'high' | 'medium' | 'low' | 'unknown';
  operationalComplexity: 'low' | 'medium' | 'high';
  expectedCost: string;
  customerAcceptance: string;
  engineeringImpact: string;
}

export interface Pilot6MetricsReport {
  pilot: 6;
  status: 'COMPLETE' | 'PARTIAL' | 'FAIL';
  opportunitiesInterviewed: number;
  fiscalDocumentSensitive: number;
  foreignReceiptTested: number;
  foreignReceiptAccepted: number;
  acceptanceRate: number; // pct
  actualCfdiStillRequired: number;
  dealsUnblocked: number;
  mrrUnlocked: number; // MXN
  dealsLost: number;
  topRejectionReason: RejectionReason | null;
  accountantEscalationRate: number; // pct
  avgBillingApprovalTimeHours: number | null;
  mexicoBillingResult: MexicoBillingResult;
  recommendedMinArchitecture: string;
  legalTaxReview: 'COMPLETE' | 'REQUIRED';
  newProductModules: string[];
  productionSupabaseTouched: false;
  engineeringFreezeViolations: 'NONE';
  escalationOptions: EscalationOption[];
  cityBreakdown: Record<string, number>;
  rejectionTaxonomy: Partial<Record<RejectionReason, number>>;
  foreignFiscalReceiptTemplate: ForeignFiscalReceiptTemplate;
}
