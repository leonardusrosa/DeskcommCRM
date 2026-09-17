/**
 * tests/unit/mexico-billing-compliance.test.ts
 *
 * Unit test suite for Mexico Billing Productionization & Tax Gate.
 * Validates:
 *   - Customer fiscal profile creation & RFC validation
 *   - Absolute security ban on SAT credentials (e.firma, CSD, private keys)
 *   - Foreign fiscal receipt generation (Rule 12.1.4 RMF compliant)
 *   - Exact financial calculations (subtotal, 16% VAT separation, total)
 *   - Receipt lifecycle transitions (issued -> delivered -> opened -> accepted/disputed)
 *   - Receipt replacement lifecycle with audit trail
 *   - Explicit absence of fake CFDI attributes (UUID, SAT seal, PAC, XML)
 *   - Tax counsel memo, Pilot #6 rejections resolution, and economic gate
 */

import { describe, expect, it } from "vitest";
import {
  createCustomerFiscalProfile,
  validateMexicanRfc,
  assertNoSensitiveSatCredentials,
} from "../../scripts/demo/lib/mexico-billing-profile";
import {
  generateForeignFiscalReceipt,
  updateReceiptLifecycle,
  replaceForeignFiscalReceipt,
  assertNoFakeCfdiAttributes,
} from "../../scripts/demo/lib/mexico-foreign-receipt";
import {
  getMexicoTaxCounselReview,
  getPilot6RejectionResolutions,
  getEconomicGateEvaluation,
} from "../../scripts/demo/lib/mexico-tax-counsel-memo";

describe("Mexico Billing Productionization & Compliance Suite", () => {
  const actor = { type: "system" as const, id: "test-runner" };

  it("1. Validates Mexican RFC formats correctly and rejects invalid formats", () => {
    // Valid persona moral (12 chars)
    expect(validateMexicanRfc("DPA230815KJ3").valid).toBe(true);
    // Valid persona física (13 chars)
    expect(validateMexicanRfc("GARM850412AB2").valid).toBe(true);

    // Invalid RFCs
    expect(validateMexicanRfc("INVALID_RFC").valid).toBe(false);
    expect(validateMexicanRfc("").valid).toBe(false);
    expect(validateMexicanRfc("12345").valid).toBe(false);
  });

  it("2. Blocks collection or storage of sensitive SAT credentials (e.firma, CSD, private keys)", () => {
    expect(() =>
      assertNoSensitiveSatCredentials({ efirma_key: "my-secret-key" })
    ).toThrow(/SECURITY VIOLATION/);

    expect(() =>
      assertNoSensitiveSatCredentials({ csd_certificate: "cert-data" })
    ).toThrow(/SECURITY VIOLATION/);

    expect(() =>
      assertNoSensitiveSatCredentials({ sat_password: "supersecret" })
    ).toThrow(/SECURITY VIOLATION/);

    expect(() =>
      createCustomerFiscalProfile(
        {
          customerId: "clinic-test",
          legalBusinessName: "Dental Test S.C.",
          rfc: "DPA230815KJ3",
          billingEmail: "admin@dental.mx",
          csd_password: "forbidden",
        },
        actor
      )
    ).toThrow(/SECURITY VIOLATION/);
  });

  it("3. Creates customer fiscal profile with audit trail", () => {
    const { profile, auditEvent } = createCustomerFiscalProfile(
      {
        customerId: "clinic-mx-101",
        legalBusinessName: "Consultorios Dentales Monterrey S.A. de C.V.",
        rfc: "CDM180620XY9",
        billingEmail: "pagos@cdm-dental.mx",
        preferredCurrency: "MXN",
        fiscalDocumentPreference: "foreign_supplier_receipt",
      },
      actor
    );

    expect(profile.customerId).toBe("clinic-mx-101");
    expect(profile.rfc).toBe("CDM180620XY9");
    expect(profile.country).toBe("MX");
    expect(profile.fiscalDocumentPreference).toBe("foreign_supplier_receipt");

    expect(auditEvent.action).toBe("profile_created");
    expect(auditEvent.rfcUsed).toBe("CDM180620XY9");
    expect(auditEvent.actor.id).toBe("test-runner");
  });

  it("4. Generates compliant foreign fiscal receipt with exact VAT separation and no fake CFDI attributes", () => {
    const { profile } = createCustomerFiscalProfile(
      {
        customerId: "clinic-mx-102",
        legalBusinessName: "Smile Studio Guadalajara S.C.",
        rfc: "SSG200415AA1",
        billingEmail: "cuentas@smilestudio.mx",
      },
      actor
    );

    const billingPeriod = { start: "2026-09-01", end: "2026-09-30" };
    const lineItems = [
      { description: "Suscripción Deskcomm Pro (2 sillas)", quantity: 1, unitPrice: 1790, amount: 1790 },
    ];

    const { receipt, auditEvent } = generateForeignFiscalReceipt(profile, billingPeriod, lineItems, actor);

    // Financial verification
    expect(receipt.amountBeforeVat).toBe(1790);
    expect(receipt.vatRate).toBe(0.16);
    expect(receipt.vatAmount).toBe(286.4);
    expect(receipt.totalAmount).toBe(2076.4);
    expect(receipt.currency).toBe("MXN");

    // Compliance & Snapshot verification
    expect(receipt.customer.rfc).toBe("SSG200415AA1");
    expect(receipt.issuer.legalName).toBe("Deskcomm Technologies Inc.");
    expect(receipt.issuer.establishmentStatus).toBe("NO_PERMANENT_ESTABLISHMENT_IN_MEXICO");
    expect(receipt.status).toBe("issued");
    expect(receipt.version).toBe("foreign_fiscal_receipt_v2_approved");
    expect(receipt.legalDisclaimer).toContain("NO ES UN CFDI 4.0 MEXICANO");
    expect(receipt.renderedDocument).toContain("DFR-2026-");
    expect(receipt.renderedDocument).toContain("$2076.40 MXN");

    // Audit verification
    expect(auditEvent.action).toBe("receipt_generated");
    expect(auditEvent.receiptId).toBe(receipt.receiptId);

    // Must NOT contain simulated CFDI attributes
    expect(() => assertNoFakeCfdiAttributes(receipt)).not.toThrow();
    const raw = receipt as unknown as Record<string, unknown>;
    expect(raw.uuidFiscal).toBeUndefined();
    expect(raw.selloSat).toBeUndefined();
    expect(raw.cfdiXml).toBeUndefined();
    expect(raw.pacCertificado).toBeUndefined();
  });

  it("5. Supports complete receipt lifecycle (delivered -> opened -> accepted / disputed)", () => {
    const { profile } = createCustomerFiscalProfile(
      {
        customerId: "clinic-mx-103",
        legalBusinessName: "Dental Elite CDMX",
        rfc: "DEC191102KL4",
        billingEmail: "facturas@dentalelite.mx",
      },
      actor
    );

    const { receipt: initialReceipt } = generateForeignFiscalReceipt(
      profile,
      { start: "2026-09-01", end: "2026-09-30" },
      [{ description: "Deskcomm Starter", quantity: 1, unitPrice: 890, amount: 890 }],
      actor
    );

    // Delivered
    const { updatedReceipt: delivered } = updateReceiptLifecycle(initialReceipt, "delivered", actor);
    expect(delivered.status).toBe("delivered");
    expect(delivered.lifecycle.deliveredAt).toBeDefined();

    // Opened
    const { updatedReceipt: opened } = updateReceiptLifecycle(delivered, "opened", actor);
    expect(opened.status).toBe("opened");
    expect(opened.lifecycle.openedAt).toBeDefined();

    // Accepted
    const { updatedReceipt: accepted, auditEvent: acceptAudit } = updateReceiptLifecycle(
      opened,
      "accepted",
      actor
    );
    expect(accepted.status).toBe("accepted");
    expect(accepted.lifecycle.acceptedAt).toBeDefined();
    expect(acceptAudit.action).toBe("receipt_accepted");

    // Test disputed lifecycle branch
    const { updatedReceipt: disputed, auditEvent: disputeAudit } = updateReceiptLifecycle(
      opened,
      "disputed",
      actor,
      { disputeReason: "Accountant requested billing period date adjustment" }
    );
    expect(disputed.status).toBe("disputed");
    expect(disputed.lifecycle.disputeReason).toContain("billing period");
    expect(disputeAudit.action).toBe("receipt_disputed");
  });

  it("6. Handles replacement lifecycle preserving audit trail and linking original receipt", () => {
    const { profile } = createCustomerFiscalProfile(
      {
        customerId: "clinic-mx-104",
        legalBusinessName: "Ortodoncia Avanzada GDL",
        rfc: "OAG210115MN7",
        billingEmail: "admin@ortoavanzada.mx",
      },
      actor
    );

    const { receipt: original } = generateForeignFiscalReceipt(
      profile,
      { start: "2026-09-01", end: "2026-09-30" },
      [{ description: "Deskcomm Starter", quantity: 1, unitPrice: 890, amount: 890 }],
      actor
    );

    // Replace receipt with plan upgrade
    const { replacedOriginal, newReceipt, auditEvents } = replaceForeignFiscalReceipt(
      original,
      [{ description: "Deskcomm Pro Upgrade", quantity: 1, unitPrice: 1790, amount: 1790 }],
      { start: "2026-09-01", end: "2026-09-30" },
      actor
    );

    expect(replacedOriginal.status).toBe("replaced");
    expect(replacedOriginal.lifecycle.replacedByReceiptId).toBe(newReceipt.receiptId);
    expect(newReceipt.status).toBe("issued");
    expect(newReceipt.lifecycle.replacedReceiptId).toBe(original.receiptId);
    expect(newReceipt.totalAmount).toBe(2076.4);

    expect(auditEvents).toHaveLength(2);
    expect(auditEvents[0].action).toBe("receipt_generated");
    expect(auditEvents[1].action).toBe("receipt_replaced");
  });

  it("7. Tax counsel review confirms legal status, resolves Pilot #6 rejections, and enforces economic gate", () => {
    const counsel = getMexicoTaxCounselReview();
    expect(counsel.reviewStatus).toBe("COMPLETE");
    expect(counsel.cfdiStatutoryRequirement.legallyRequiredFromDeskcomm).toBe(false);
    expect(counsel.vatModel.applicableRate).toBe(0.16);
    expect(counsel.foreignReceiptStatus.legallyCompliant).toBe(true);

    const resolutions = getPilot6RejectionResolutions();
    expect(resolutions).toHaveLength(4);
    const uncertainty = resolutions.find((r) => r.rejectionCategory === "accountant_uncertainty");
    expect(uncertainty?.recoverableWithTaxMemo).toBe(true);

    const gate = getEconomicGateEvaluation();
    expect(gate.decision).toBe("DO NOT PROCEED / DEFER");
    expect(gate.mrrBlockedSpecificallyByCfdiMxn).toBe(2680);
    expect(gate.economicBreakevenMrrMxn).toBeGreaterThanOrEqual(250000);
  });
});
