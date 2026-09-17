/**
 * app/api/v1/admin/sales/sla/route.ts
 *
 * API route for Historical SLA Analytics & Service-Level Performance.
 * Calculates compliance rates, breach occurrences, and action-type performance.
 */

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { listSLATimers, type SLATimerRecord } from "@/scripts/demo/lib/demo-sla";

export interface SLAAnalyticsPayload {
  summary: {
    totalTimers: number;
    completedOnTime: number;
    breachedCount: number;
    warningCount: number;
    complianceRatePercentage: number;
    avgResolutionMinutes: number;
  };
  byActionType: Array<{
    actionType: string;
    total: number;
    completed: number;
    breached: number;
    complianceRate: number;
  }>;
  recentBreaches: SLATimerRecord[];
  retrievedAt: string;
}

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const all = listSLATimers();

    let completedOnTime = 0;
    let breachedCount = 0;
    let warningCount = 0;
    let totalMinutes = 0;
    let completedWithTime = 0;

    const actionMap = new Map<
      string,
      { total: number; completed: number; breached: number }
    >();

    for (const t of all) {
      if (!actionMap.has(t.actionType)) {
        actionMap.set(t.actionType, { total: 0, completed: 0, breached: 0 });
      }
      const entry = actionMap.get(t.actionType)!;
      entry.total += 1;

      if (t.status === "completed") {
        entry.completed += 1;
        completedOnTime += 1;
        if (t.completedAt) {
          const diff =
            new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
          totalMinutes += Math.max(5, Math.round(diff / (1000 * 60)));
          completedWithTime += 1;
        }
      } else if (t.status === "breached") {
        entry.breached += 1;
        breachedCount += 1;
      } else if (t.status === "warning") {
        warningCount += 1;
      }
    }

    const totalEvaluated = completedOnTime + breachedCount;
    const complianceRatePercentage =
      totalEvaluated > 0
        ? Math.round((completedOnTime / totalEvaluated) * 100)
        : 100;

    const avgResolutionMinutes =
      completedWithTime > 0 ? Math.round(totalMinutes / completedWithTime) : 45;

    const byActionType = Array.from(actionMap.entries()).map(
      ([actionType, data]) => {
        const evaluated = data.completed + data.breached;
        return {
          actionType,
          total: data.total,
          completed: data.completed,
          breached: data.breached,
          complianceRate:
            evaluated > 0 ? Math.round((data.completed / evaluated) * 100) : 100,
        };
      },
    );

    const recentBreaches = all
      .filter((t) => t.status === "breached")
      .slice(-10)
      .reverse();

    const payload: SLAAnalyticsPayload = {
      summary: {
        totalTimers: all.length,
        completedOnTime,
        breachedCount,
        warningCount,
        complianceRatePercentage,
        avgResolutionMinutes,
      },
      byActionType,
      recentBreaches,
      retrievedAt: new Date().toISOString(),
    };

    return ok(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SLA analytics query error";
    return fail("sla_analytics_error", message, 500);
  }
}
