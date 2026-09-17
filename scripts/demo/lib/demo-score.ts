/**
 * scripts/demo/lib/demo-score.ts
 *
 * Demo Scoring and Commercial Signals Engine.
 * Analyzes tenant interaction events to measure prospect intent and engagement.
 */

import { getTrackedDemoEvents, type DemoEventRecord } from "./demo-events";

export const DEMO_SCORE_WEIGHTS: Record<string, number> = {
  first_login: 10,
  inbox_viewed: 15,
  pipeline_viewed: 15,
  agenda_viewed: 15,
  google_connected: 25,
  appointment_created: 20,
};

export type CommercialSignalName = "demo_high_intent" | "demo_inactive" | "demo_expiring";

export interface DemoScoreResult {
  tenantId: string;
  score: number;
  level: "low" | "medium" | "high";
  isHighIntent: boolean;
  breakdown: Record<string, number>;
  eventsCount: number;
}

export interface CommercialSignal {
  signal: CommercialSignalName;
  label: string;
  triggeredAt: string;
  details?: string;
}

/**
 * Calculates the commercial engagement score (0 - 100) for a demo tenant.
 */
export function getDemoScore(
  tenantId: string,
  customEvents?: DemoEventRecord[],
): DemoScoreResult {
  const events = customEvents ?? getTrackedDemoEvents(tenantId);
  const distinctEventTypes = new Set<string>();

  for (const e of events) {
    distinctEventTypes.add(e.event_name);
  }

  let totalScore = 0;
  const breakdown: Record<string, number> = {};

  for (const [eventName, weight] of Object.entries(DEMO_SCORE_WEIGHTS)) {
    if (distinctEventTypes.has(eventName)) {
      totalScore += weight;
      breakdown[eventName] = weight;
    } else {
      breakdown[eventName] = 0;
    }
  }

  // Cap score between 0 and 100
  const score = Math.min(100, Math.max(0, totalScore));
  const level: "low" | "medium" | "high" =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low";

  return {
    tenantId,
    score,
    level,
    isHighIntent: score >= 70,
    breakdown,
    eventsCount: events.length,
  };
}

export const calculateDemoScore = getDemoScore;

/**
 * Evaluates commercial signals for a demo tenant based on score, activity, and expiration.
 *
 * Rules:
 *   - High intent: score >= 70
 *   - Inactive: no activity for 48h
 *   - Expiring: 24h before expiration
 */
export function getCommercialSignals(
  tenantId: string,
  options: {
    lastActivity?: string;
    expiresAt?: string;
    customEvents?: DemoEventRecord[];
    now?: Date;
  } = {},
): CommercialSignal[] {
  const signals: CommercialSignal[] = [];
  const now = options.now || new Date();
  const nowTime = now.getTime();

  // 1. High Intent Signal: score >= 70
  const scoreResult = getDemoScore(tenantId, options.customEvents);
  if (scoreResult.score >= 70) {
    signals.push({
      signal: "demo_high_intent",
      label: "Alta Intención de Compra",
      triggeredAt: now.toISOString(),
      details: `Puntaje comercial ${scoreResult.score}/100 alcanzado.`,
    });
  }

  // 2. Inactive Signal: no activity for 48 hours
  if (options.lastActivity) {
    const lastActivityTime = new Date(options.lastActivity).getTime();
    const inactiveMs = 48 * 60 * 60 * 1000;
    if (nowTime - lastActivityTime >= inactiveMs) {
      signals.push({
        signal: "demo_inactive",
        label: "Demostración Inactiva",
        triggeredAt: now.toISOString(),
        details: "Sin actividad en las últimas 48 horas.",
      });
    }
  }

  // 3. Expiring Signal: 24 hours or less before expiration
  if (options.expiresAt) {
    const expiresTime = new Date(options.expiresAt).getTime();
    const remainingMs = expiresTime - nowTime;
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    if (remainingMs > 0 && remainingMs <= twentyFourHoursMs) {
      signals.push({
        signal: "demo_expiring",
        label: "Demostración por Expirar",
        triggeredAt: now.toISOString(),
        details: "Expira en menos de 24 horas.",
      });
    }
  }

  return signals;
}
