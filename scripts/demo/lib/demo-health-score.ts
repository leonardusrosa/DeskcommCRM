/**
 * scripts/demo/lib/demo-health-score.ts
 *
 * Demo Health Score Engine.
 * Calculates composite tenant health (0-100) based on 4 weighted pillars:
 *   - Usage: 40% (login, inbox, agenda)
 *   - Intent: 30% (google calendar connection, appointments, pipeline)
 *   - Commercial: 20% (meeting booked, proposal sent, deals)
 *   - Time: 10% (recency of interaction and activity decay)
 *
 * Returns: health score, risk level, breakdown, and actionable sales recommendations.
 * Enforces demo isolation and never touches production data.
 */

import { assertDemoEnvironmentSafety } from "./guards";
import { getTrackedDemoEvents, getTrackedDemoSessions, type DemoEventRecord } from "./demo-events";
import { findDemoLeadByTenantId, type DemoLeadStatus } from "./demo-leads";
import { listDemoDeals } from "./demo-deals";

export type HealthRiskLevel = "low" | "medium" | "high" | "critical";

export interface HealthScoreBreakdown {
  usage: number; // 0-100, 40% weight
  intent: number; // 0-100, 30% weight
  commercial: number; // 0-100, 20% weight
  time: number; // 0-100, 10% weight
}

export interface DemoHealthScoreResult {
  tenantId: string;
  healthScore: number; // 0-100
  riskLevel: HealthRiskLevel;
  breakdown: HealthScoreBreakdown;
  recommendations: string[];
  calculatedAt: string;
}

export const HEALTH_WEIGHTS = {
  usage: 0.4,
  intent: 0.3,
  commercial: 0.2,
  time: 0.1,
} as const;

/**
 * Calculates health score for a specific demo tenant.
 */
export function calculateDemoHealthScore(
  tenantId: string,
  options: {
    events?: DemoEventRecord[];
    leadStatus?: DemoLeadStatus;
    lastActivity?: string;
    customEnv?: Record<string, string | undefined>;
    customEventsFile?: string;
    customSessionsFile?: string;
    customLeadsFile?: string;
    customDealsFile?: string;
  } = {},
): DemoHealthScoreResult {
  assertDemoEnvironmentSafety(options.customEnv);

  const allEvents = options.events ?? getTrackedDemoEvents(options.customEventsFile);
  const tenantEvents = allEvents.filter((e) => e.tenant_id === tenantId);
  const eventNames = new Set(tenantEvents.map((e) => e.event_name));

  const lead = findDemoLeadByTenantId(tenantId, options.customLeadsFile);
  const status: DemoLeadStatus = options.leadStatus ?? lead?.status ?? "demo_created";

  // 1. Usage Component (40% weight)
  let usage = 0;
  if (eventNames.has("first_login")) usage += 25;
  if (eventNames.has("inbox_viewed")) usage += 35;
  if (eventNames.has("agenda_viewed")) usage += 40;
  usage = Math.min(100, usage);

  // 2. Intent Component (30% weight)
  let intent = 0;
  if (eventNames.has("google_connected")) intent += 40;
  if (eventNames.has("appointment_created")) intent += 35;
  if (eventNames.has("pipeline_viewed")) intent += 25;
  intent = Math.min(100, intent);

  // 3. Commercial Component (20% weight)
  let commercial = 0;
  switch (status) {
    case "converted":
      commercial = 100;
      break;
    case "proposal_sent":
      commercial = 85;
      break;
    case "meeting_booked":
      commercial = 70;
      break;
    case "qualified":
    case "engaged":
      commercial = 50;
      break;
    case "activated":
      commercial = 35;
      break;
    case "demo_created":
    case "active":
      commercial = 20;
      break;
    case "lost":
      commercial = 5;
      break;
    default:
      commercial = 15;
  }

  // Check deals won
  const deals = listDemoDeals({
    tenantId,
    customFilePath: options.customDealsFile,
  });
  if (deals.some((d) => d.status === "closed_won")) {
    commercial = 100;
  } else if (deals.length > 0) {
    commercial = Math.min(100, commercial + 20);
  }

  // 4. Time / Recency Component (10% weight)
  let time = 50;
  let lastActivityTime = options.lastActivity;
  if (!lastActivityTime) {
    const sessions = getTrackedDemoSessions(options.customSessionsFile);
    const s = sessions.find((item) => item.tenant_id === tenantId);
    if (s?.last_activity) lastActivityTime = s.last_activity;
  }

  if (lastActivityTime) {
    const hoursSince = Math.max(
      0,
      (Date.now() - new Date(lastActivityTime).getTime()) / (1000 * 60 * 60),
    );
    if (hoursSince <= 24) time = 100;
    else if (hoursSince <= 48) time = 75;
    else if (hoursSince <= 72) time = 50;
    else if (hoursSince <= 120) time = 30;
    else time = 10;
  }

  // Calculate composite weighted score
  const healthScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        usage * HEALTH_WEIGHTS.usage +
          intent * HEALTH_WEIGHTS.intent +
          commercial * HEALTH_WEIGHTS.commercial +
          time * HEALTH_WEIGHTS.time,
      ),
    ),
  );

  // Risk classification
  let riskLevel: HealthRiskLevel = "low";
  if (healthScore >= 75) riskLevel = "low";
  else if (healthScore >= 50) riskLevel = "medium";
  else if (healthScore >= 25) riskLevel = "high";
  else riskLevel = "critical";

  // Build recommendations
  const recommendations: string[] = [];
  if (usage < 40) {
    recommendations.push("Enviar onboarding guiado por WhatsApp con tour por el Inbox y Agenda.");
  }
  if (intent < 35) {
    recommendations.push("Presentar caso de uso de sincronización con Google Calendar y citas automáticas.");
  }
  if (commercial < 50 && healthScore >= 40) {
    recommendations.push("Invitar a llamada de diagnóstico comercial de 30 minutos (deskcomm.io/demo/book).");
  }
  if (time < 40) {
    recommendations.push("Disparar cadencia de reactivación antes de que expire la sesión demo.");
  }
  if (healthScore >= 75 && status !== "proposal_sent" && status !== "converted") {
    recommendations.push("Lead con alto interés: enviar propuesta comercial formal con descuento por lanzamiento.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Mantener seguimiento activo y monitorear próximas citas agendadas.");
  }

  return {
    tenantId,
    healthScore,
    riskLevel,
    breakdown: {
      usage,
      intent,
      commercial,
      time,
    },
    recommendations,
    calculatedAt: new Date().toISOString(),
  };
}
