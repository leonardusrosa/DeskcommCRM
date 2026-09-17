/**
 * lib/integrations/pms/clinical-guard.ts
 *
 * Fail-closed non-clinical boundary guard and administrative allowlist enforcer.
 * Rejects any clinical, medical, radiographical, diagnostic, or billing payload,
 * as well as any unexpected non-allowlisted fields.
 */

import type { AdministrativeAppointment, AdministrativeContact } from "./types";

export const FORBIDDEN_CLINICAL_KEYWORDS: readonly string[] = [
  "odontogram",
  "odontograma",
  "diagnosis",
  "diagnostico",
  "anamnesis",
  "anamnese",
  "clinicalnote",
  "notaclinica",
  "medicalhistory",
  "historialmedico",
  "prontuario",
  "radiograph",
  "radiografia",
  "raiox",
  "xray",
  "treatmentplan",
  "planotratamento",
  "prescription",
  "receita",
  "medicacao",
  "invoice",
  "fatura",
  "factura",
  "payment",
  "pagamento",
  "insurance",
  "convenio",
  "seguro",
];

export const ALLOWED_CONTACT_FIELDS: readonly string[] = [
  "externalId",
  "id",
  "name",
  "nome",
  "phone",
  "telefone",
  "telemovel",
  "email",
  "administrativeCategory",
];

export const ALLOWED_APPOINTMENT_FIELDS: readonly string[] = [
  "externalId",
  "id",
  "patientExternalId",
  "patientId",
  "start",
  "startDate",
  "end",
  "endDate",
  "provider",
  "medico",
  "status",
  "appointmentLabel",
  "label",
  "description",
];

export class ClinicalBoundaryViolationError extends Error {
  public readonly field: string;
  public readonly context?: string;

  constructor(field: string, reason: string, context?: string) {
    super(
      `[PMS Clinical Boundary Violation] ${reason} on field "${field}" in ${
        context ?? "payload"
      }. Synchronization aborted immediately.`
    );
    this.name = "ClinicalBoundaryViolationError";
    this.field = field;
    this.context = context;
  }
}

export function assertAdministrativePayloadSafe(
  payload: unknown,
  allowedKeys?: readonly string[],
  context?: string
): void {
  if (!payload || typeof payload !== "object") return;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      assertAdministrativePayloadSafe(item, allowedKeys, context);
    }
    return;
  }

  const record = payload as Record<string, unknown>;
  const allowedSet = allowedKeys ? new Set(allowedKeys) : null;

  for (const key of Object.keys(record)) {
    // 1. Enforce strict allowlist if specified
    if (allowedSet && !allowedSet.has(key)) {
      throw new ClinicalBoundaryViolationError(
        key,
        "Unexpected non-allowlisted field encountered",
        context
      );
    }

    // 2. Reject forbidden clinical or billing terms
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const forbidden of FORBIDDEN_CLINICAL_KEYWORDS) {
      if (normalized.includes(forbidden)) {
        throw new ClinicalBoundaryViolationError(
          key,
          "Prohibited clinical or billing field encountered",
          context
        );
      }
    }

    // 3. Recurse into nested objects
    const val = record[key];
    if (val && typeof val === "object") {
      assertAdministrativePayloadSafe(val, undefined, `${context ? context + "." : ""}${key}`);
    }
  }
}

export function sanitizeAdministrativeContact(raw: Record<string, unknown>): AdministrativeContact {
  assertAdministrativePayloadSafe(raw, ALLOWED_CONTACT_FIELDS, "contact");

  const externalId = String(raw.externalId || raw.id || "").trim();
  const name = String(raw.name || raw.nome || "").trim();
  const phone = String(raw.phone || raw.telefone || raw.telemovel || "").trim();
  const email = String(raw.email || "").trim().toLowerCase();
  const administrativeCategory = raw.administrativeCategory
    ? String(raw.administrativeCategory).trim()
    : undefined;

  if (!externalId) throw new Error("Administrative contact missing required externalId");
  if (!name) throw new Error(`Administrative contact "${externalId}" missing required name`);

  return { externalId, name, phone, email, administrativeCategory };
}

export function sanitizeAdministrativeAppointment(
  raw: Record<string, unknown>
): AdministrativeAppointment {
  assertAdministrativePayloadSafe(raw, ALLOWED_APPOINTMENT_FIELDS, "appointment");

  const externalId = String(raw.externalId || raw.id || "").trim();
  const patientExternalId = String(raw.patientExternalId || raw.patientId || "").trim();
  const start = String(raw.start || raw.startDate || "").trim();
  const end = String(raw.end || raw.endDate || "").trim();
  const provider = String(raw.provider || raw.medico || "").trim();
  const status = String(raw.status || "CONFIRMED").trim().toUpperCase();
  const appointmentLabel = String(
    raw.appointmentLabel || raw.label || raw.description || "Consulta"
  ).trim();

  if (!externalId) throw new Error("Administrative appointment missing required externalId");
  if (!start) throw new Error(`Administrative appointment "${externalId}" missing required start timestamp`);

  return {
    externalId,
    patientExternalId,
    start,
    end,
    provider,
    status,
    appointmentLabel,
  };
}
