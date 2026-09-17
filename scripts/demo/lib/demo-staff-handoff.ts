/**
 * scripts/demo/lib/demo-staff-handoff.ts
 *
 * Implements staff_handoff_15min_v1: lightweight 15-minute handoff flow
 * for newly onboarded receptionists/staff at active dental clinics.
 *
 * Addresses root cause of D30/D60 churn identified during Mexico commercial scale
 * (receptionist turnover leaving incoming staff untrained on Deskcomm).
 */

import type { StaffHandoffEvent, StaffHandoffStep } from "@/types/demo-pilot-8";

export const HANDOFF_STEPS_DEFINITION = [
  { step: 1, name: "Unirse a la cuenta de la clínica y configurar acceso propio" },
  { step: 2, name: "Comprender propiedad y asignación de chats en la Bandeja de Entrada" },
  { step: 3, name: "Gestionar y responder una conversación real de prueba" },
  { step: 4, name: "Localizar y agendar una cita en la Agenda del gabinete" },
  { step: 5, name: "Revisar seguimiento de presupuestos pendientes y recordatorios" },
  { step: 6, name: "Confirmación final de transferencia y toma de posesión del puesto" },
];

export function createStaffHandoffEvent(
  clinicId: string,
  clinicName: string,
  opts?: { durationMinutes?: number; supportMinutes?: number; completed?: boolean }
): StaffHandoffEvent {
  const durationMinutes = opts?.durationMinutes ?? 13;
  const supportMinutes = opts?.supportMinutes ?? 4;
  const completed = opts?.completed ?? true;

  const now = new Date();
  const startedAt = new Date(now.getTime() - durationMinutes * 60000).toISOString();
  const completedAt = completed ? now.toISOString() : undefined;

  const steps: StaffHandoffStep[] = HANDOFF_STEPS_DEFINITION.map((s, idx) => ({
    step: s.step,
    name: s.name,
    completed: completed || idx < 4,
    completedAt: completed ? new Date(now.getTime() - (6 - s.step) * 120000).toISOString() : undefined,
  }));

  return {
    clinicId,
    clinicName,
    startedAt,
    completedAt,
    durationMinutes,
    completed,
    steps,
    supportMinutes,
    postHandoffRetentionMaintained: completed,
  };
}

export function evaluateStaffHandoffPerformance(events: StaffHandoffEvent[]): {
  eventsCount: number;
  completionRatePct: number;
  averageDurationMinutes: number;
  supportMinutesTotal: number;
  validationResult: "IMPROVED" | "UNCHANGED" | "REGRESSED" | "INCONCLUSIVE";
} {
  if (events.length === 0) {
    return {
      eventsCount: 0,
      completionRatePct: 0,
      averageDurationMinutes: 0,
      supportMinutesTotal: 0,
      validationResult: "INCONCLUSIVE",
    };
  }

  const completed = events.filter((e) => e.completed);
  const completionRate = parseFloat(((completed.length / events.length) * 100).toFixed(1));
  const avgDuration = parseFloat(
    (events.reduce((acc, e) => acc + e.durationMinutes, 0) / events.length).toFixed(1)
  );
  const totalSupport = events.reduce((acc, e) => acc + e.supportMinutes, 0);

  const maintained = completed.filter((e) => e.postHandoffRetentionMaintained).length;
  const validationResult =
    completionRate >= 80 && avgDuration <= 15 && maintained === completed.length
      ? "IMPROVED"
      : "UNCHANGED";

  return {
    eventsCount: events.length,
    completionRatePct: completionRate,
    averageDurationMinutes: avgDuration,
    supportMinutesTotal: totalSupport,
    validationResult,
  };
}
