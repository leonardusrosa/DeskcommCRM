/**
 * scripts/demo/lib/mexico-billing-profile.ts
 *
 * Customer Fiscal Profile management for Mexican customers.
 * Handles validation of Mexican RFC, profile creation, and audit trail.
 *
 * SECURITY INVARIANT:
 * Strictly prohibits collection or storage of SAT credentials:
 * e.firma, CSD, private keys, SAT passwords, or PAC credentials.
 */

import crypto from "node:crypto";
import type {
  CustomerFiscalProfile,
  FiscalAuditEvent,
  MexicoFiscalAddress,
  MexicoFiscalDocumentPreference,
} from "@/types/mexico-billing";

// Mexican RFC regex: 3-4 uppercase letters, 6 digits (YYMMDD), 3 alphanumeric homoclave
export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

// Explicitly banned credential fields
const BANNED_KEYS = [
  "efirma",
  "e_firma",
  "csd",
  "sat_password",
  "sat_key",
  "private_key",
  "pac_credential",
  "cert_password",
  "certificate",
];

export function validateMexicanRfc(rfc: string): { valid: boolean; normalized: string; error?: string } {
  if (!rfc || typeof rfc !== "string") {
    return { valid: false, normalized: "", error: "RFC must be a non-empty string" };
  }
  const normalized = rfc.trim().toUpperCase();
  if (!RFC_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: `Invalid Mexican RFC format: "${normalized}". Must be 12 chars (moral) or 13 chars (física).`,
    };
  }
  return { valid: true, normalized };
}

export function assertNoSensitiveSatCredentials(payload: Record<string, unknown>): void {
  const keys = Object.keys(payload);
  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const banned of BANNED_KEYS) {
      if (lower.includes(banned)) {
        throw new Error(
          `SECURITY VIOLATION: Collection or storage of SAT credential "${key}" is strictly prohibited. Deskcomm never collects e.firma, CSD, private keys, or SAT passwords.`
        );
      }
    }
  }
}

export interface CreateFiscalProfileInput {
  customerId: string;
  legalBusinessName: string;
  rfc: string;
  billingEmail: string;
  fiscalAddress?: MexicoFiscalAddress;
  preferredCurrency?: "MXN" | "USD";
  fiscalDocumentPreference?: MexicoFiscalDocumentPreference;
  [key: string]: unknown; // Allowed for security checking
}

export function createCustomerFiscalProfile(
  input: CreateFiscalProfileInput,
  actor: { type: "system" | "operator"; id: string }
): { profile: CustomerFiscalProfile; auditEvent: FiscalAuditEvent } {
  // 1. Enforce strict credential safety
  assertNoSensitiveSatCredentials(input);

  // 2. Validate RFC
  const rfcCheck = validateMexicanRfc(input.rfc);
  if (!rfcCheck.valid) {
    throw new Error(rfcCheck.error);
  }

  // 3. Validate mandatory fields
  if (!input.legalBusinessName || input.legalBusinessName.trim().length < 2) {
    throw new Error("Legal business name is required and must have at least 2 characters");
  }
  if (!input.billingEmail || !input.billingEmail.includes("@")) {
    throw new Error("Valid billing email is required");
  }

  const now = new Date().toISOString();
  const profile: CustomerFiscalProfile = {
    customerId: input.customerId,
    legalBusinessName: input.legalBusinessName.trim(),
    rfc: rfcCheck.normalized,
    billingEmail: input.billingEmail.trim().toLowerCase(),
    fiscalAddress: input.fiscalAddress,
    country: "MX",
    preferredCurrency: input.preferredCurrency ?? "MXN",
    fiscalDocumentPreference: input.fiscalDocumentPreference ?? "foreign_supplier_receipt",
    createdAt: now,
    updatedAt: now,
  };

  const auditEvent: FiscalAuditEvent = {
    id: `audit-${crypto.randomUUID()}`,
    timestamp: now,
    actor,
    customerId: profile.customerId,
    rfcUsed: profile.rfc,
    documentVersion: "foreign_fiscal_receipt_v2_approved",
    receiptId: "NONE",
    action: "profile_created",
    details: {
      legalBusinessName: profile.legalBusinessName,
      fiscalDocumentPreference: profile.fiscalDocumentPreference,
      preferredCurrency: profile.preferredCurrency,
    },
  };

  return { profile, auditEvent };
}
