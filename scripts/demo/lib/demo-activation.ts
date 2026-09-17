/**
 * scripts/demo/lib/demo-activation.ts
 *
 * Demo Activation Metrics & Sales Next-Action Recommendation Engine.
 *
 * Definition:
 * An "Activated Demo" has performed all 3 core actions:
 *   1. first_login
 *   2. inbox_viewed
 *   3. agenda_viewed
 */

import { getTrackedDemoEvents, getTrackedDemoSessions, type DemoEventRecord } from "./demo-events";
import { getDemoScore } from "./demo-score";
import type { DemoLeadStatus } from "./demo-leads";

export const ACTIVATION_REQUIRED_EVENTS = [
  "first_login",
  "inbox_viewed",
  "agenda_viewed",
] as const;

export interface DemoActivationMetrics {
  totalDemos: number;
  activatedDemos: number;
  activationRatePercentage: number;
  activatedTenantIds: string[];
  pendingTenantIds: string[];
}

/**
 * Checks if a demo tenant is activated (has completed first_login, inbox_viewed, and agenda_viewed).
 */
export function isDemoActivated(
  tenantId: string,
  customEvents?: DemoEventRecord[],
): boolean {
  const events = customEvents ?? getTrackedDemoEvents(tenantId);
  const distinctEventNames = new Set(events.map((e) => e.event_name));

  return ACTIVATION_REQUIRED_EVENTS.every((requiredEvent) =>
    distinctEventNames.has(requiredEvent),
  );
}

/**
 * Calculates the overall demo activation rate across all tracked demo tenants.
 */
export function getDemoActivationRate(options: {
  tenantIds?: string[];
  customEvents?: DemoEventRecord[];
  sessionsFilePath?: string;
  eventsFilePath?: string;
} = {}): DemoActivationMetrics {
  let tenantIds = options.tenantIds;

  if (!tenantIds) {
    const sessions = getTrackedDemoSessions(options.sessionsFilePath);
    const uniqueIds = new Set(sessions.map((s) => s.tenant_id));

    // Also include tenants from events if not in sessions
    const allEvents = options.customEvents ?? getTrackedDemoEvents(undefined, options.eventsFilePath);
    for (const e of allEvents) {
      uniqueIds.add(e.tenant_id);
    }
    tenantIds = Array.from(uniqueIds);
  }

  const activatedTenantIds: string[] = [];
  const pendingTenantIds: string[] = [];

  for (const tid of tenantIds) {
    const eventsForTenant = options.customEvents
      ? options.customEvents.filter((e) => e.tenant_id === tid)
      : undefined;

    if (isDemoActivated(tid, eventsForTenant)) {
      activatedTenantIds.push(tid);
    } else {
      pendingTenantIds.push(tid);
    }
  }

  const totalDemos = tenantIds.length;
  const activatedDemos = activatedTenantIds.length;
  const activationRatePercentage =
    totalDemos > 0 ? Math.round((activatedDemos / totalDemos) * 100) : 0;

  return {
    totalDemos,
    activatedDemos,
    activationRatePercentage,
    activatedTenantIds,
    pendingTenantIds,
  };
}

/**
 * Computes the recommended commercial next action for a sales representative.
 */
export function getSuggestedNextAction(
  tenantId: string,
  options: {
    status?: DemoLeadStatus;
    score?: number;
    isActivated?: boolean;
    isExpiring?: boolean;
    isInactive?: boolean;
    customEvents?: DemoEventRecord[];
  } = {},
): string {
  const status = options.status || "demo_created";
  if (status === "converted") return "Cliente ganado. Iniciar onboarding definitivo.";
  if (status === "lost") return "Demo perdida. Programar recontacto en 60 días.";
  if (status === "proposal_sent") return "Hacer seguimiento a la propuesta comercial enviada.";
  if (status === "meeting_booked") return "Preparar reunión comercial de diagnóstico.";

  const scoreResult = options.score !== undefined ? options.score : getDemoScore(tenantId, options.customEvents).score;
  const activated = options.isActivated !== undefined ? options.isActivated : isDemoActivated(tenantId, options.customEvents);

  if (scoreResult >= 70) {
    return "🔥 Alta Intención: Llamar para agendar reunión o enviar propuesta.";
  }
  if (options.isExpiring) {
    return "⚠️ Expira pronto: Contactar para extender prueba o cerrar.";
  }
  if (activated) {
    return "✅ Demo activada: Invitar a videollamada de demostración guiada.";
  }
  if (options.isInactive) {
    return "💤 Inactiva: Enviar video de WhatsApp o caso de éxito.";
  }

  return "Esperar primer inicio de sesión o exploración de bandeja.";
}
