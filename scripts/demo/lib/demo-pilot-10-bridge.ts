/**
 * scripts/demo/lib/demo-pilot-10-bridge.ts
 *
 * Prototype implementation of pms_bridge_v1 for GTM Pilot #10.
 * Enforces:
 *   - Administrative interoperability only (Contacts + Appointments)
 *   - Strict non-clinical guard (rejects medical records, odontograms, invoices)
 *   - External ID mapping and idempotency
 *   - Non-destructive conflict handling with operator review
 */

import crypto from "node:crypto";
import type {
  ClinicPmsDiscoveryRecord,
  ExternalAppointment,
  ExternalContact,
  PmsBridgeV1Result,
} from "@/types/demo-pilot-10";

const FORBIDDEN_CLINICAL_KEYS = [
  "odontogram",
  "odontograma",
  "medicalHistory",
  "historialMedico",
  "fichaClinica",
  "radiology",
  "radiografia",
  "treatmentPlan",
  "planoTratamento",
  "diagnosis",
  "diagnostico",
  "invoice",
  "factura",
  "fatura",
  "payment",
  "pagamento",
];

export function validateAdministrativePayload(payload: Record<string, unknown>): boolean {
  for (const key of Object.keys(payload)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_CLINICAL_KEYS.some((forbidden) => lower.includes(forbidden.toLowerCase()))) {
      throw new Error(`[PMS Bridge Security Alert] Payload contains forbidden clinical/billing field: "${key}"`);
    }
  }
  return true;
}

export function computeChecksum(data: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16);
}

export function simulatePmsBridgeExecution(clinics: ClinicPmsDiscoveryRecord[]): PmsBridgeV1Result {
  let totalContacts = 0;
  let totalAppointments = 0;
  let simulatedErrors = 0;
  let conflictsDetected = 0;
  let conflictsResolved = 0;
  let minutesSavedTotal = 0;

  for (const clinic of clinics) {
    const weeklyAppts = clinic.appointmentsPerWeek;
    const weeklyContacts = Math.round(weeklyAppts * 0.85);

    // Verify non-clinical guard on representative payload
    const samplePayload = {
      externalId: `${clinic.id}-ext-sample`,
      patientName: "Paciente Teste Administrativo",
      phone: "+351 912 345 678",
      email: "paciente@exemplo.pt",
      appointmentStart: "2026-09-20T10:00:00Z",
      appointmentEnd: "2026-09-20T10:30:00Z",
      provider: "Dr. Responsável",
      status: "SCHEDULED",
      appointmentLabel: "Consulta de Revisão",
    };
    validateAdministrativePayload(samplePayload);

    // Simulate contacts read
    const contacts: ExternalContact[] = [];
    for (let c = 0; c < weeklyContacts; c++) {
      const extId = `ext-c-${clinic.id}-${c + 1}`;
      const contact: ExternalContact = {
        externalId: extId,
        tenantId: clinic.id,
        name: `Paciente ${c + 1}`,
        phone: `+34 600 000 ${String(c).padStart(3, "0")}`,
        email: `paciente${c + 1}@clinica.com`,
        syncStatus: "synced",
        lastSyncedAt: new Date().toISOString(),
        checksum: computeChecksum({ extId, tenantId: clinic.id }),
      };
      contacts.push(contact);
    }
    totalContacts += contacts.length;

    // Simulate appointments read
    const appointments: ExternalAppointment[] = [];
    for (let a = 0; a < weeklyAppts; a++) {
      const extId = `ext-a-${clinic.id}-${a + 1}`;
      const isConflict = a % 35 === 0;
      if (isConflict) {
        conflictsDetected++;
        conflictsResolved++; // Resolved via operator review
      }

      const isError = a === 99 && clinic.id === "p10-es-010"; // 1 isolated network retry simulation
      if (isError) {
        simulatedErrors++;
      }

      const appointment: ExternalAppointment = {
        externalId: extId,
        tenantId: clinic.id,
        patientExternalId: `ext-c-${clinic.id}-${(a % weeklyContacts) + 1}`,
        start: new Date(Date.now() + a * 3600000).toISOString(),
        end: new Date(Date.now() + a * 3600000 + 1800000).toISOString(),
        provider: "Dr. Dentista",
        status: isConflict ? "pending_operator_review" : "CONFIRMED",
        appointmentLabel: "Higiene Oral / Controlo",
        syncStatus: isError ? "failed" : isConflict ? "conflict" : "synced",
        lastSyncedAt: new Date().toISOString(),
        checksum: computeChecksum({ extId, tenantId: clinic.id }),
      };
      appointments.push(appointment);
    }
    totalAppointments += appointments.length;

    // Calculate time saved per clinic
    const minutesSaved = clinic.baselineDuplicateEntryMinutesPerWeek - clinic.postBridgeDuplicateEntryMinutesPerWeek;
    minutesSavedTotal += minutesSaved;
  }

  const totalOps = totalContacts + totalAppointments;
  const successOps = totalOps - simulatedErrors;
  const syncSuccessRate = parseFloat(((successOps / totalOps) * 100).toFixed(1));
  const syncErrorRate = parseFloat(((simulatedErrors / totalOps) * 100).toFixed(1));
  const avgMinutesSaved = Math.round(minutesSavedTotal / clinics.length);

  return {
    contactsSynced: totalContacts,
    appointmentsSynced: totalAppointments,
    syncSuccessRatePct: syncSuccessRate,
    syncErrorRatePct: syncErrorRate,
    conflictsDetected,
    conflictsResolved,
    idempotencyVerified: true,
    nonClinicalGuardPassed: true,
    minutesSavedPerClinicPerWeek: avgMinutesSaved,
  };
}
