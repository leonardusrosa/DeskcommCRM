/**
 * app/api/v1/admin/sales/route.ts
 *
 * Platform Admin API for Sales Workspace.
 * Aggregates urgent actions, pending follow-ups, expiring demos, and high-intent demos.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { listDemoActions, completeDemoAction } from "@/scripts/demo/lib/demo-actions";
import { listPendingFollowups, completeFollowup } from "@/scripts/demo/lib/demo-followups";
import { listDemoLeads } from "@/scripts/demo/lib/demo-leads";
import { getDemoScore, getCommercialSignals } from "@/scripts/demo/lib/demo-score";
import { calculateDemoHealthScore } from "@/scripts/demo/lib/demo-health-score";
import { getTrackedDemoSessions } from "@/scripts/demo/lib/demo-events";

export interface SalesWorkspacePayload {
  urgentActions: ReturnType<typeof listDemoActions>;
  followups: ReturnType<typeof listPendingFollowups>;
  expiringDemos: Array<{
    tenantId: string;
    leadName: string;
    company: string;
    country: string;
    score: number;
    hoursLeft: number;
    status: string;
  }>;
  highIntentDemos: Array<{
    tenantId: string;
    leadName: string;
    company: string;
    country: string;
    score: number;
    healthScore: number;
    signals: string[];
    status: string;
  }>;
  summary: {
    urgentCount: number;
    followupsCount: number;
    expiringCount: number;
    highIntentCount: number;
  };
}

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const allActions = listDemoActions();
    const urgentActions = allActions.filter(
      (a) => a.priority === "urgent" && a.status === "pending",
    );

    const followups = listPendingFollowups();
    const leads = listDemoLeads();
    const sessions = getTrackedDemoSessions();

    // Expiring demos (< 48h remaining or expiring signal)
    const expiringDemos: SalesWorkspacePayload["expiringDemos"] = [];
    const highIntentDemos: SalesWorkspacePayload["highIntentDemos"] = [];

    const now = Date.now();

    for (const lead of leads) {
      if (!lead.demo_tenant_id) continue;
      const tenantId = lead.demo_tenant_id;
      const session = sessions.find((s) => s.tenant_id === tenantId);

      const scoreResult = getDemoScore(tenantId);
      const signals = getCommercialSignals(tenantId);
      const health = calculateDemoHealthScore(tenantId, {
        leadStatus: lead.status,
        lastActivity: session?.last_activity,
      });

      // Check expiration
      if (session?.created_at) {
        const createdMs = new Date(session.created_at).getTime();
        const expiresMs = createdMs + 7 * 24 * 60 * 60 * 1000; // 7 day demo
        const hoursLeft = Math.round((expiresMs - now) / (1000 * 60 * 60));

        if (hoursLeft <= 48 && hoursLeft > -24 && lead.status !== "converted") {
          expiringDemos.push({
            tenantId,
            leadName: lead.name,
            company: lead.company,
            country: lead.country,
            score: scoreResult.score,
            hoursLeft,
            status: lead.status,
          });
        }
      }

      // Check high intent
      const hasHighIntentSignal = signals.some((s) => s.signal === "demo_high_intent");
      if (
        (scoreResult.score >= 60 || health.healthScore >= 70 || hasHighIntentSignal) &&
        lead.status !== "converted" &&
        lead.status !== "lost"
      ) {
        highIntentDemos.push({
          tenantId,
          leadName: lead.name,
          company: lead.company,
          country: lead.country,
          score: scoreResult.score,
          healthScore: health.healthScore,
          signals: signals.map((s) => s.signal),
          status: lead.status,
        });
      }
    }

    // Sort priority
    expiringDemos.sort((a, b) => a.hoursLeft - b.hoursLeft);
    highIntentDemos.sort((a, b) => b.score - a.score);

    const payload: SalesWorkspacePayload = {
      urgentActions,
      followups,
      expiringDemos,
      highIntentDemos,
      summary: {
        urgentCount: urgentActions.length,
        followupsCount: followups.length,
        expiringCount: expiringDemos.length,
        highIntentCount: highIntentDemos.length,
      },
    };

    return ok(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sales workspace error";
    return fail("sales_workspace_error", message, 500);
  }
}

const patchSchema = z.object({
  type: z.enum(["action", "followup"]),
  id: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail("bad_request", "Invalid parameters", 400);
    }

    if (parsed.data.type === "action") {
      const updated = completeDemoAction(parsed.data.id);
      return ok({ updated });
    } else {
      const updated = completeFollowup(parsed.data.id);
      return ok({ updated });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update error";
    return fail("update_error", message, 500);
  }
}
