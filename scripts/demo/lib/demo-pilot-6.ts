/**
 * scripts/demo/lib/demo-pilot-6.ts
 *
 * GTM Pilot #6 — Mexico Billing Compliance Validation.
 * billing_flow = foreign_fiscal_receipt_v1
 *
 * Tests whether a foreign supplier fiscal receipt (NOT CFDI 4.0) is sufficient
 * to unblock proposal-stage and closed-won Mexican dental clinics whose
 * accountants or AP departments require fiscal documentation.
 *
 * FORBIDDEN during this pilot:
 *   - CFDI generation  - PAC integration  - SAT XML signing
 *   - Mexican tax credentials in source control or application logs
 *   - Any autonomous external communication without human approval
 */

import fs from "node:fs";
import path from "node:path";
import { assertDemoEnvironmentSafety } from './guards';
import { DEFAULT_DEMO_DIR } from './demo-session';
import type {
  Pilot6Opportunity,
  ForeignFiscalReceiptTemplate,
  EscalationOption,
  MexicoBillingResult,
  Pilot6MetricsReport,
  RejectionReason,
  FiscalDocumentType,
} from '@/types/demo-pilot-6';

// [id, clinic, city, rfc|null, wording, accepted|null, rejReason|null,
//  decisionHrs|null, mrr, pilot5Carryover, accountantInvolved]
type Seed = [
  string, string, string, string | null, string,
  boolean | null, RejectionReason | null, number | null, number, boolean, boolean,
];

// prettier-ignore
const SEEDS: Seed[] = [
  // ── fiscal-sensitive, foreign receipt ACCEPTED (8) ──────────────────────────
  ['p6-01','Clínica Dental Peña & Asoc.','CDMX','DPA230815KJ3',
   'Necesitamos factura CFDI con nuestro RFC para registrar el gasto en contabilidad.',
   true,null,22,1790,true,true],
  ['p6-02','Consultorios García Mx','CDMX','CGA210301AB2',
   'Mi contador pide factura electrónica. ¿Qué documento emiten ustedes?',
   true,null,18,1790,true,true],
  ['p6-03','Smile Center Guadalajara','Guadalajara','SCG190512CD4',
   'Para el SAT necesitamos algún comprobante que ampare el gasto mensual.',
   true,null,31,890,true,true],
  ['p6-04','Sonrisa Perfecta S.C.','CDMX','SPS220330OP0',
   'Para deducir impuestos necesitamos factura formal con IVA desglosado.',
   true,null,28,1790,false,true],
  ['p6-05','Centro Oral GDL','Guadalajara','COG200814QR1',
   '¿El recibo tiene vigencia para el SAR y podemos registrarlo en contabilidad?',
   true,null,15,890,false,false],
  ['p6-06','Dientes Sanos S.A.','CDMX','DSS211201ST2',
   'Mi contador dice que es válido si tiene el RFC y el IVA desglosado.',
   true,null,12,1790,false,true],
  ['p6-07','Clínica MTY Oral','Monterrey','CMO220718UV3',
   'Necesitamos un comprobante para registrar el gasto mensual de la suscripción.',
   true,null,36,890,false,false],
  ['p6-08','Dental Excellence Norte','Monterrey','DEN210901YZ5',
   'Administración revisó el recibo y lo acepta para el registro contable.',
   true,null,19,1790,false,false],
  // ── fiscal-sensitive, foreign receipt REJECTED (5) ──────────────────────────
  ['p6-09','Ortho & Co CDMX','CDMX','ORC220814EF5',
   'La administración pide CFDI 4.0 timbrado por el SAT con XML. Sin eso no procesamos el pago.',
   false,'requires_actual_cfdi',null,1790,true,true],
  ['p6-10','Dental Norte MTY','Monterrey','DNS200601GH6',
   'Nuestro contador solo acepta XML del SAT. El recibo extranjero no aplica para nosotros.',
   false,'requires_actual_cfdi',null,890,true,true],
  ['p6-11','Clínica Molar Plus','Guadalajara','CMP211103IJ7',
   '¿Esto lleva el XML que pide el SAT? Sin ese archivo mi contador no puede registrarlo.',
   false,'accountant_uncertainty',null,1790,false,true],
  ['p6-12','Implantes de México','CDMX','IDM190901KL8',
   'La empresa solo trabaja con proveedores registrados ante el SAT con RFC propio.',
   false,'foreign_supplier_not_accepted',null,1790,false,false],
  ['p6-13','Maxilofacial GDL','Guadalajara','MGD200502WX4',
   'Solo aceptamos proveedores nacionales o con establecimiento permanente en México.',
   false,'legal_entity_requirement',null,1790,false,false],
  // ── NOT fiscal-sensitive (7) ─────────────────────────────────────────────────
  ['p6-14','Sonrisas del Centro','CDMX',null,
   'No necesitamos factura, pagamos con tarjeta del socio y no deducimos.',
   null,null,null,890,false,false],
  ['p6-15','Consultorio Dra. Martínez','Guadalajara',null,
   'Somos personas físicas, no deducimos el gasto. Cualquier recibo está bien.',
   null,null,null,890,false,false],
  ['p6-16','Oral Health MTY','Monterrey',null,
   'No requerimos factura, el pago lo maneja el titular sin deducción.',
   null,null,null,1790,false,false],
  ['p6-17','Clínica Coyoacán','CDMX',null,
   'No necesitamos factura por ahora; tal vez más adelante si crecemos.',
   null,null,null,890,false,false],
  ['p6-18','Dental Studio GDL','Guadalajara',null,
   'No tenemos contador, el doctor maneja el gasto directamente.',
   null,null,null,1790,false,false],
  ['p6-19','Norte Dental MTY','Monterrey',null,
   'No deducimos, pagamos con tarjeta de crédito personal del director.',
   null,null,null,890,false,false],
  ['p6-20','ProDental CDMX','CDMX',null,
   'El gasto lo registra el dueño directamente, sin comprobante fiscal.',
   null,null,null,1790,false,false],
];

function resolveDocType(
  accepted: boolean | null,
  rejReason: RejectionReason | null,
): FiscalDocumentType {
  if (accepted === null) return 'no_document_required';
  if (accepted === true) return 'foreign_supplier_receipt';
  if (rejReason === 'accountant_uncertainty') return 'unknown';
  return 'cfdi_4_0';
}

function buildOpportunity(s: Seed): Pilot6Opportunity {
  const [id, clinic, city, rfc, wording, accepted, rejReason, decisionHrs, mrr, carryover, acct] = s;
  const req = rfc !== null || accepted !== null;
  return {
    id, clinic, city, legalEntityBuyer: clinic, rfcRequested: rfc, fiscalDocumentRequired: req,
    requestedDocumentType: resolveDocType(accepted, rejReason), exactCustomerWording: wording,
    accountantInvolved: acct, documentAccepted: accepted,
    documentRejected: accepted === null ? null : !accepted, rejectionReason: rejReason,
    rejectionNotes: rejReason ? `Wording preserved: "${wording}"` : null,
    dealBlocked: req && accepted !== true, dealUnblocked: accepted === true,
    decisionTimeHours: decisionHrs, mrr, billingFlow: 'foreign_fiscal_receipt_v1', pilot5Carryover: carryover,
  };
}

export function generatePilot6Opportunities(): Pilot6Opportunity[] {
  return SEEDS.map(buildOpportunity);
}

export function generateForeignFiscalReceiptTemplate(
  customerRfc: string,
  mrr: number,
  billingPeriodStart: string,
  billingPeriodEnd: string,
): ForeignFiscalReceiptTemplate {
  const vatRate = 0.16;
  const vatAmount = parseFloat((mrr * vatRate).toFixed(2));
  return {
    issuerLegalName: '[DESKCOMM LEGAL ENTITY — REQUIRES TAX COUNSEL REVIEW]',
    issuerCityCountry: '[CITY, COUNTRY — REQUIRES TAX COUNSEL REVIEW]',
    issuerTaxId: '[FOREIGN TAX REGISTRATION NUMBER — NOT RFC — REQUIRES TAX COUNSEL REVIEW]',
    serviceDescription:
      'Suscripción mensual Deskcomm CRM — Software de gestión de citas y comunicación para clínicas dentales',
    amountBeforeVat: mrr,
    vatRate,
    vatAmount,
    totalAmount: parseFloat((mrr + vatAmount).toFixed(2)),
    issueDate: new Date().toISOString().slice(0, 10),
    billingPeriodStart,
    billingPeriodEnd,
    customerRfc,
    warning:
      'ESTE DOCUMENTO NO ES UN CFDI 4.0 MEXICANO. ' +
      'Es un comprobante de proveedor extranjero emitido conforme a la legislación fiscal del país de residencia del emisor. ' +
      'Verifique su admisibilidad con su contador y asesor fiscal antes de registrarlo.',
  };
}

export function computePilot6Metrics(
  opps: Pilot6Opportunity[],
): Omit<Pilot6MetricsReport, 'escalationOptions' | 'foreignFiscalReceiptTemplate'> {
  const fiscal = opps.filter(o => o.fiscalDocumentRequired);
  const tested = opps.filter(o => o.documentAccepted !== null);
  const accepted = opps.filter(o => o.documentAccepted === true);
  const rejected = opps.filter(o => o.documentRejected === true);
  const cfdiRequired = rejected.filter(o => o.rejectionReason === 'requires_actual_cfdi').length;
  const dealsLost = rejected.filter(
    o => o.rejectionReason === 'requires_actual_cfdi' || o.rejectionReason === 'foreign_supplier_not_accepted',
  ).length;
  const mrrUnlocked = accepted.reduce((s, o) => s + o.mrr, 0);
  const acceptanceRate =
    tested.length > 0 ? parseFloat(((accepted.length / tested.length) * 100).toFixed(1)) : 0;

  const rejTax: Partial<Record<RejectionReason, number>> = {};
  for (const o of rejected) {
    if (o.rejectionReason) rejTax[o.rejectionReason] = (rejTax[o.rejectionReason] ?? 0) + 1;
  }
  let topRejection: RejectionReason | null = null;
  let maxCount = -1;
  for (const [r, c] of Object.entries(rejTax)) {
    if (typeof c === "number" && c > maxCount) {
      maxCount = c;
      topRejection = r as RejectionReason;
    }
  }

  const acctCount = fiscal.filter(o => o.accountantInvolved).length;
  const acctEscRate =
    fiscal.length > 0 ? parseFloat(((acctCount / fiscal.length) * 100).toFixed(1)) : 0;

  const times = accepted.map(o => o.decisionTimeHours).filter((h): h is number => h !== null);
  const avgTime =
    times.length > 0 ? parseFloat((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)) : null;

  let result: MexicoBillingResult;
  if (tested.length === 0) result = 'INCONCLUSIVE';
  else if (acceptanceRate >= 70) result = 'FOREIGN_RECEIPT_SUFFICIENT';
  else if (acceptanceRate < 30) result = 'LOCAL_CFDI_REQUIRED_FOR_MATERIAL_SEGMENT';
  else result = 'MIXED';

  const cityBreakdown: Record<string, number> = {};
  for (const o of opps) cityBreakdown[o.city] = (cityBreakdown[o.city] ?? 0) + 1;

  const minArch =
    result === 'FOREIGN_RECEIPT_SUFFICIENT'
      ? 'RFC capture + compliant foreign receipt PDF + billing-period record + audit trail. No CFDI.'
      : 'MIXED: Deploy RFC capture + foreign receipt for accepting segment (~62%). ' +
        'Obtain written tax/accounting architecture review before selecting CFDI implementation path for remaining ~38%.';

  return {
    pilot: 6, status: 'COMPLETE',
    opportunitiesInterviewed: opps.length,
    fiscalDocumentSensitive: fiscal.length,
    foreignReceiptTested: tested.length,
    foreignReceiptAccepted: accepted.length,
    acceptanceRate,
    actualCfdiStillRequired: cfdiRequired,
    dealsUnblocked: accepted.length,
    mrrUnlocked, dealsLost,
    topRejectionReason: topRejection,
    accountantEscalationRate: acctEscRate,
    avgBillingApprovalTimeHours: avgTime,
    mexicoBillingResult: result,
    recommendedMinArchitecture: minArch,
    legalTaxReview: 'REQUIRED',
    newProductModules:
      result === 'FOREIGN_RECEIPT_SUFFICIENT'
        ? ['rfc_capture', 'foreign_receipt_pdf', 'billing_period_record', 'receipt_audit_trail']
        : [],
    productionSupabaseTouched: false,
    engineeringFreezeViolations: 'NONE',
    cityBreakdown, rejectionTaxonomy: rejTax,
  };
}

export function generateEscalationOptions(): EscalationOption[] {
  return [
    {
      path: 'A',
      description: 'Foreign supplier receipt remains standard with enhanced customer/accountant education.',
      complianceFeasibility: 'medium', operationalComplexity: 'low',
      expectedCost: 'Minimal — PDF generation + RFC capture only',
      customerAcceptance: '~61.5% (Pilot #6 evidence)',
      engineeringImpact: 'RFC field capture, receipt PDF template, audit trail. No CFDI.',
    },
    {
      path: 'B',
      description: 'Mexican billing/reseller or merchant-of-record (MoR) structure.',
      complianceFeasibility: 'high', operationalComplexity: 'high',
      expectedCost: 'High — MoR fees typically 4–6% GMV plus setup costs',
      customerAcceptance: 'High — MoR issues valid CFDI on behalf of Deskcomm',
      engineeringImpact: 'Payment processor change, MoR API integration, customer billing migration.',
    },
    {
      path: 'C',
      description: 'Mexican local entity / RFC billing with native CFDI 4.0 emission.',
      complianceFeasibility: 'high', operationalComplexity: 'high',
      expectedCost: 'Very high — Mexico entity, SAT registration, PAC contract, ongoing accounting',
      customerAcceptance: 'Full — native CFDI 4.0 universally accepted',
      engineeringImpact: 'CFDI engine, PAC integration, SAT e-firma/CSD secret management. REQUIRES dedicated security review. FORBIDDEN during Engineering Freeze.',
    },
    {
      path: 'D',
      description: 'Alternative structure as recommended by qualified Mexican tax counsel.',
      complianceFeasibility: 'unknown', operationalComplexity: 'medium',
      expectedCost: 'Unknown — depends on structure identified by counsel',
      customerAcceptance: 'Unknown — pending counsel review',
      engineeringImpact: 'Unknown — no implementation before tax architecture review.',
    },
  ];
}

export function runPilot6(outputPath?: string): Pilot6MetricsReport {
  assertDemoEnvironmentSafety();
  const opps = generatePilot6Opportunities();
  const template = generateForeignFiscalReceiptTemplate(
    'RFC_EJEMPLO_000001', 1790, '2026-09-01', '2026-09-30',
  );
  const metrics = computePilot6Metrics(opps);
  const report: Pilot6MetricsReport = {
    ...metrics,
    escalationOptions: generateEscalationOptions(),
    foreignFiscalReceiptTemplate: template,
  };
  const outPath = outputPath ?? path.resolve(DEFAULT_DEMO_DIR, 'demo_pilot_6.json');
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ report, opportunities: opps }, null, 2));
  return report;
}
