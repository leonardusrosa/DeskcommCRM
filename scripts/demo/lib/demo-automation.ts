/**
 * scripts/demo/lib/demo-automation.ts
 *
 * Demo Command Center Automation Runner.
 * Orchestrates periodic operations:
 *   - Evaluates active SLAs and emits escalation alerts on breach
 *   - Detects expiring demo sessions (< 24h) and queues warning cadence
 *   - Detects inactive demos (> 48h) and queues reactivation follow-up
 *   - Dispatches pending sales alerts
 *   - Records idempotent audit entries
 *
 * Safety: strictly isolated to demo environment (.demo/*).
 */

import { assertDemoEnvironmentSafety } from "./guards";
import { checkAndEscalateSLAs } from "./demo-sla";
import { getTrackedDemoSessions } from "./demo-events";
import { listDemoLeads } from "./demo-leads";
import { triggerDemoFollowup, listDemoFollowups } from "./demo-followups";
import { sendDemoAlert } from "./demo-alerts";
import { recordDemoAudit } from "./demo-audit";
import { getDemoScore } from "./demo-score";

export interface AutomationRunReport {
  executedAt: string;
  slasEvaluated: number;
  slaBreaches: number;
  slaWarnings: number;
  expiringHandled: number;
  inactivityHandled: number;
  followupsQueued: number;
  alertsDispatched: number;
  escalations: string[];
}

export async function runDemoAutomations(options: {
  customEnv?: Record<string, string | undefined>;
  customFilePath?: string;
  now?: Date;
  dryRun?: boolean;
} = {}): Promise<AutomationRunReport> {
  assertDemoEnvironmentSafety(options.customEnv);
  const now = options.now ?? new Date();

  // 1. SLA Evaluation and Escalation
  const slaResult = checkAndEscalateSLAs({
    now,
    customEnv: options.customEnv,
  });

  let alertsDispatched = 0;
  const escalations: string[] = [];

  for (const breachedTimer of slaResult.escalatedTimers) {
    escalations.push(`Tenant ${breachedTimer.tenantId} breached SLA: ${breachedTimer.actionType}`);
    await sendDemoAlert(
      {
        tenantId: breachedTimer.tenantId,
        channel: "slack",
        severity: "critical",
        title: `SLA Breached: ${breachedTimer.actionType}`,
        message: `Tenant ${breachedTimer.tenantId} has breached the SLA timer. Action required immediately.`,
        recipient: breachedTimer.escalatedTo || "sales-alerts@deskcomm.io",
      },
      { dryRun: options.dryRun },
    );
    alertsDispatched += 1;
  }

  // 2. Lifecycle Checks: Expiration and Inactivity
  const leads = listDemoLeads();
  const sessions = getTrackedDemoSessions();
  const existingFollowups = listDemoFollowups();

  let expiringHandled = 0;
  let inactivityHandled = 0;
  let followupsQueued = 0;

  for (const lead of leads) {
    if (!lead.demo_tenant_id || lead.status === "converted" || lead.status === "lost") {
      continue;
    }
    const tenantId = lead.demo_tenant_id;
    const session = sessions.find((s) => s.tenant_id === tenantId);

    // Check expiration (< 24 hours left on 7-day demo)
    if (session?.created_at) {
      const createdMs = new Date(session.created_at).getTime();
      const expiresMs = createdMs + 7 * 24 * 60 * 60 * 1000;
      const hoursLeft = (expiresMs - now.getTime()) / (1000 * 60 * 60);

      if (hoursLeft <= 24 && hoursLeft > -48) {
        // Idempotency: avoid queueing duplicate expiring followups
        const alreadyQueued = existingFollowups.some(
          (f) => f.tenantId === tenantId && f.trigger === "demo_expiring",
        );
        if (!alreadyQueued) {
          await triggerDemoFollowup(tenantId, "demo_expiring", {
            leadName: lead.name,
            company: lead.company,
            country: lead.country,
          });
          expiringHandled += 1;
          followupsQueued += 1;
        }
      }
    }

    // Check inactivity (> 48 hours without activity)
    if (session?.last_activity) {
      const lastActivityMs = new Date(session.last_activity).getTime();
      const hoursInactive = (now.getTime() - lastActivityMs) / (1000 * 60 * 60);

      if (hoursInactive >= 48) {
        const alreadyQueued = existingFollowups.some(
          (f) => f.tenantId === tenantId && f.trigger === "demo_inactive",
        );
        if (!alreadyQueued) {
          await triggerDemoFollowup(tenantId, "demo_inactive", {
            leadName: lead.name,
            company: lead.company,
            country: lead.country,
          });
          inactivityHandled += 1;
          followupsQueued += 1;
        }
      }
    }

    // High intent notification
    const scoreResult = getDemoScore(tenantId);
    if (scoreResult.score >= 70) {
      const alreadyHighIntent = existingFollowups.some(
        (f) => f.tenantId === tenantId && f.trigger === "demo_high_intent",
      );
      if (!alreadyHighIntent) {
        await triggerDemoFollowup(tenantId, "demo_high_intent", {
          leadName: lead.name,
          company: lead.company,
          country: lead.country,
        });
        followupsQueued += 1;
      }
    }
  }

  // 3. Audit Automation Execution
  recordDemoAudit({
    tenantId: "system_automation",
    actionType: "commercial_action",
    description: `Automations executed: ${slaResult.breachesCount} SLA breaches, ${expiringHandled} expiring, ${followupsQueued} followups queued`,
    metadata: {
      slasEvaluated: slaResult.checkedCount,
      slaBreaches: slaResult.breachesCount,
      alertsDispatched,
      followupsQueued,
    },
  });

  return {
    executedAt: now.toISOString(),
    slasEvaluated: slaResult.checkedCount,
    slaBreaches: slaResult.breachesCount,
    slaWarnings: slaResult.warningsCount,
    expiringHandled,
    inactivityHandled,
    followupsQueued,
    alertsDispatched,
    escalations,
  };
}
