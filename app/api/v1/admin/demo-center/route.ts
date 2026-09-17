/**
 * app/api/v1/admin/demo-center/route.ts
 *
 * Unified Platform Admin API for Demo Command Center.
 * Aggregates health scores, pending actions, SLA issues, active alerts,
 * revenue forecasts, and active demo activity streams.
 */

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { listActiveDemos } from "@/scripts/demo/lib/demo-registry";
import { listDemoLeads } from "@/scripts/demo/lib/demo-leads";
import { listDemoActions } from "@/scripts/demo/lib/demo-actions";
import { listSLATimers } from "@/scripts/demo/lib/demo-sla";
import { listDemoAlerts } from "@/scripts/demo/lib/demo-alerts";
import { calculateRevenueForecast } from "@/scripts/demo/lib/demo-forecast";
import { calculateDemoHealthScore } from "@/scripts/demo/lib/demo-health-score";
import { getDemoScore } from "@/scripts/demo/lib/demo-score";

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const registryDemos = listActiveDemos();
    const leads = listDemoLeads();
    const allActions = listDemoActions();
    const allTimers = listSLATimers();
    const allAlerts = listDemoAlerts();
    const forecast = calculateRevenueForecast();

    // 1. Enrich active demos with health & scores
    const activeDemos = registryDemos.map((reg) => {
      const lead = leads.find((l) => l.demo_tenant_id === reg.tenantId);
      const score = getDemoScore(reg.tenantId);
      const health = calculateDemoHealthScore(reg.tenantId, {
        leadStatus: lead?.status,
      });

      return {
        tenantId: reg.tenantId,
        name: reg.name,
        company: lead?.company || reg.name,
        country: reg.country,
        vertical: reg.vertical,
        ownerEmail: reg.ownerEmail,
        status: lead?.status || reg.status,
        score: score.score,
        healthScore: health.healthScore,
        riskLevel: health.riskLevel,
        createdAt: reg.createdAt,
        expiresAt: reg.expiresAt,
      };
    });

    // 2. High intent demos
    const highIntent = activeDemos.filter(
      (d) => d.score >= 60 || d.healthScore >= 70,
    );

    // 3. SLA issues (warnings or breaches)
    const slaIssues = allTimers.filter(
      (t) => t.status === "warning" || t.status === "breached",
    );

    // 4. Pending recommended actions
    const recommendedActions = allActions
      .filter((a) => a.status === "pending")
      .slice(0, 15);

    // 5. Recent alerts
    const recentAlerts = allAlerts.slice(-10).reverse();

    // 6. Summary metrics
    const wonMRR: Record<string, number> = {};
    const forecastARR: Record<string, number> = {};
    for (const [cur, f] of Object.entries(forecast.forecastsByCurrency)) {
      if (f.wonMRR > 0) wonMRR[cur] = f.wonMRR;
      if (f.arrForecast > 0) forecastARR[cur] = f.arrForecast;
    }

    return ok({
      activeDemos,
      highIntent,
      slaIssues,
      recommendedActions,
      recentAlerts,
      forecast,
      summary: {
        activeDemosCount: activeDemos.length,
        highIntentCount: highIntent.length,
        slaIssuesCount: slaIssues.length,
        pendingActionsCount: recommendedActions.length,
        alertsCount: allAlerts.length,
        wonMRR,
        forecastARR,
      },
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Command center error";
    return fail("command_center_error", message, 500);
  }
}
