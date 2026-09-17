/** Fail-closed non-clinical PMS payload boundary. */

import type { AdministrativeAppointment, AdministrativeContact } from "./types";

export const FORBIDDEN_CLINICAL_KEYWORDS: readonly string[] = [
  "odontogram", "odontograma", "diagnosis", "diagnostico", "anamnesis", "anamnese",
  "clinicalnote", "notaclinica", "medicalhistory", "historialmedico", "prontuario",
  "radiograph", "radiografia", "raiox", "xray", "treatmentplan", "planotratamento",
  "prescription", "receita", "medicacao", "invoice", "fatura", "factura", "payment",
  "pagamento", "insurance", "convenio", "seguro",
];

const CONTACT_FIELDS = new Set([
  "externalid", "id", "name", "nome", "phone", "telefone", "telemovel", "email",
]);
const APPOINTMENT_FIELDS = new Set([
  "externalid", "id", "patientexternalid", "patientid", "start", "startdate", "end",
  "enddate", "provider", "medico", "status", "appointmentlabel", "label", "description",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export class ClinicalBoundaryViolationError extends Error {
  public readonly field: string;
  public readonly context?: string;

  constructor(field: string, context?: string, reason = "prohibited clinical/billing field") {
    super(
      `[PMS Clinical Boundary Violation] Field "${field}" rejected in ${context ?? "payload"}: ${reason}. Synchronization aborted.`
    );
    this.name = "ClinicalBoundaryViolationError";
    this.field = field;
    this.context = context;
  }
}

export function assertAdministrativePayloadSafe(payload: unknown, context?: string): void {
  if (!payload || typeof payload !== "object") return;
  if (Array.isArray(payload)) {
    for (const item of payload) assertAdministrativePayloadSafe(item, context);
    return;
  }

  const record = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key);
    if (FORBIDDEN_CLINICAL_KEYWORDS.some((forbidden) => normalized.includes(forbidden))) {
      throw new ClinicalBoundaryViolationError(key, context);
    }
    if (value && typeof value === "object") {
      assertAdministrativePayloadSafe(value, `${context ? context + "." : ""}${key}`);
    }
  }
}

function assertAllowlistedFields(
  raw: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  context: string
): void {
  assertAdministrativePayloadSafe(raw, context);
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeKey(key);
    if (!allowed.has(normalized)) {
      throw new ClinicalBoundaryViolationError(key, context, "field is outside the administrative allowlist");
    }
    if (value !== null && value !== undefined && typeof value === "object") {
      throw new ClinicalBoundaryViolationError(key, context, "nested/object values are not allowed");
    }
  }
}

export function sanitizeAdministrativeContact(raw: Record<string, unknown>): AdministrativeContact {
  assertAllowlistedFields(raw, CONTACT_FIELDS, "contact");
  const externalId = String(raw.externalId || raw.id || "").trim();
  const name = String(raw.name || raw.nome || "").trim();
  const phone = String(raw.phone || raw.telefone || raw.telemovel || "").trim();
  const email = String(raw.email || "").trim().toLowerCase();

  if (!externalId) throw new Error("Administrative contact missing required externalId");
  if (!name) throw new Error(`Administrative contact "${externalId}" missing required name`);
  return { externalId, name, phone, email };
}

export function sanitizeAdministrativeAppointment(
  raw: Record<string, unknown>
): AdministrativeAppointment {
  assertAllowlistedFields(raw, APPOINTMENT_FIELDS, "appointment");
  const externalId = String(raw.externalId || raw.id || "").trim();
  const patientExternalId = String(raw.patientExternalId || raw.patientId || "").trim();
  const start = String(raw.start || raw.startDate || "").trim();
  const end = String(raw.end || raw.endDate || "").trim();
  const provider = String(raw.provider || raw.medico || "").trim();
  const status = String(raw.status || "CONFIRMED").trim().toUpperCase();
  const appointmentLabel = String(raw.appointmentLabel || raw.label || raw.description || "Consulta").trim();

  if (!externalId) throw new Error("Administrative appointment missing required externalId");
  if (!start) throw new Error(`Administrative appointment "${externalId}" missing required start timestamp`);
  return { externalId, patientExternalId, start, end, provider, status, appointmentLabel };
}
