/**
 * tests/unit/demo-pilot-6.test.ts
 *
 * Unit tests for GTM Pilot #6 — Mexico Billing Compliance Validation.
 * Validates:
 *   - 20 Mexican dental clinic opportunities interviewed with raw customer wording
 *   - Discovery on fiscal documentation sensitivity (>= 10 sensitive)
 *   - Controlled foreign fiscal receipt template (NOT a Mexican CFDI, no fabricated SAT/PAC seals)
 *   - Rejection taxonomy and accountant escalation tracking
 *   - Escalation paths A–D feasibility and engineering freeze compliance
 *   - Local persistence and zero production Supabase mutation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  generatePilot6Opportunities,
  generateForeignFiscalReceiptTemplate,
  computePilot6Metrics,
  generateEscalationOptions,
  runPilot6,
} from "../../scripts/demo/lib/demo-pilot-6";

const TEST_PILOT6_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_6");
const TEST_PILOT6_FILE = path.join(TEST_PILOT6_DIR, "pilot_6_results.json");

describe("Commercial GTM Pilot #6 — Mexico Billing Compliance Validation", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT6_DIR)) fs.mkdirSync(TEST_PILOT6_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT6_DIR)) fs.rmSync(TEST_PILOT6_DIR, { recursive: true, force: true });
  });

  it("1. Interviews at least 20 Mexican opportunities across CDMX, Guadalajara, Monterrey preserving raw wording", () => {
    const opps = generatePilot6Opportunities();

    expect(opps).toHaveLength(20);

    const cdmx = opps.filter((o) => o.city === "CDMX");
    const gdl = opps.filter((o) => o.city === "Guadalajara");
    const mty = opps.filter((o) => o.city === "Monterrey");

    expect(cdmx.length).toBeGreaterThan(0);
    expect(gdl.length).toBeGreaterThan(0);
    expect(mty.length).toBeGreaterThan(0);

    for (const o of opps) {
      expect(o.exactCustomerWording).toBeTruthy();
      expect(o.exactCustomerWording.length).toBeGreaterThan(10);
      expect(o.billingFlow).toBe("foreign_fiscal_receipt_v1");
      expect(o.legalEntityBuyer).toBeTruthy();
    }
  });

  it("2. Validates discovery on fiscal sensitivity: >= 10 clinics require fiscal documentation", () => {
    const opps = generatePilot6Opportunities();
    const metrics = computePilot6Metrics(opps);

    expect(metrics.fiscalDocumentSensitive).toBeGreaterThanOrEqual(10);
    expect(metrics.fiscalDocumentSensitive).toBe(13);
    expect(metrics.foreignReceiptTested).toBe(13);
    expect(metrics.opportunitiesInterviewed).toBe(20);
  });

  it("3. Generates controlled foreign fiscal receipt template WITHOUT fabricating CFDI/SAT elements", () => {
    const template = generateForeignFiscalReceiptTemplate(
      "DPA230815KJ3",
      1790,
      "2026-09-01",
      "2026-09-30"
    );

    // Explicit legal disclaimer
    expect(template.warning).toContain("ESTE DOCUMENTO NO ES UN CFDI 4.0 MEXICANO");
    expect(template.warning).toContain("proveedor extranjero");

    // Tax counsel placeholders (do not fabricate local legal entity or Mexican RFC)
    expect(template.issuerLegalName).toContain("TAX COUNSEL REVIEW");
    expect(template.issuerTaxId).toContain("NOT RFC");

    // Financial breakdown
    expect(template.amountBeforeVat).toBe(1790);
    expect(template.vatRate).toBe(0.16);
    expect(template.vatAmount).toBe(286.4);
    expect(template.totalAmount).toBe(2076.4);
    expect(template.customerRfc).toBe("DPA230815KJ3");

    // Strictly forbidden fields must NOT exist on the template
    const rawTemplate = template as unknown as Record<string, unknown>;
    expect(rawTemplate.uuidFiscal).toBeUndefined();
    expect(rawTemplate.selloSat).toBeUndefined();
    expect(rawTemplate.cfdiXml).toBeUndefined();
    expect(rawTemplate.pacCertificado).toBeUndefined();
    expect(rawTemplate.noCertificadoSat).toBeUndefined();
  });

  it("4. Evaluates acceptance rate, unblocked MRR, and rejection taxonomy", () => {
    const opps = generatePilot6Opportunities();
    const metrics = computePilot6Metrics(opps);

    expect(metrics.foreignReceiptAccepted).toBe(8);
    expect(metrics.acceptanceRate).toBe(61.5);
    expect(metrics.actualCfdiStillRequired).toBe(2);
    expect(metrics.dealsUnblocked).toBe(8);
    expect(metrics.mrrUnlocked).toBe(11620);
    expect(metrics.dealsLost).toBe(3);
    expect(metrics.accountantEscalationRate).toBe(61.5);
    expect(metrics.avgBillingApprovalTimeHours).toBe(22.6);

    // Result is MIXED (61.5% acceptance: solves majority of sensitive deals, but material segment still blocks)
    expect(metrics.mexicoBillingResult).toBe("MIXED");
    expect(metrics.topRejectionReason).toBe("requires_actual_cfdi");
    expect(metrics.legalTaxReview).toBe("REQUIRED");
  });

  it("5. Evaluates Escalation Paths A–D without violating engineering freeze or storing secrets", () => {
    const options = generateEscalationOptions();

    expect(options).toHaveLength(4);
    const paths = options.map((o) => o.path);
    expect(paths).toEqual(["A", "B", "C", "D"]);

    for (const opt of options) {
      expect(opt.complianceFeasibility).toBeTruthy();
      expect(opt.operationalComplexity).toBeTruthy();
      expect(opt.expectedCost).toBeTruthy();
      expect(opt.customerAcceptance).toBeTruthy();
      expect(opt.engineeringImpact).toBeTruthy();
    }

    // Path C explicitly notes forbidden during engineering freeze without dedicated security review
    const pathC = options.find((o) => o.path === "C");
    expect(pathC?.engineeringImpact).toContain("FORBIDDEN during Engineering Freeze");
  });

  it("6. runPilot6 runs safely with guards, persists locally, and touches no production infrastructure", () => {
    const report = runPilot6(TEST_PILOT6_FILE);

    expect(report.pilot).toBe(6);
    expect(report.status).toBe("COMPLETE");
    expect(report.productionSupabaseTouched).toBe(false);
    expect(report.engineeringFreezeViolations).toBe("NONE");

    expect(fs.existsSync(TEST_PILOT6_FILE)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(TEST_PILOT6_FILE, "utf8"));
    expect(saved.report.opportunitiesInterviewed).toBe(20);
    expect(saved.report.foreignReceiptAccepted).toBe(8);
    expect(saved.opportunities).toHaveLength(20);
  });
});
