/**
 * app/api/v1/admin/intelligence/route.ts
 *
 * Executive Intelligence API Route.
 * Aggregates autonomous learning patterns, deal risk assessments, conversion/cadence recommendations,
 * analytical warehouse metrics, and expansion pipeline.
 *
 * Supports human-in-the-loop action approval via POST.
 */

import type { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { runRevenueLearningEngine } from "@/scripts/demo/intelligence/learning-engine";
import { runConversionOptimizer } from "@/scripts/demo/intelligence/conversion-optimizer";
import { reviewAllOpenDeals } from "@/scripts/demo/intelligence/deal-review";
import { runOptimizationLoop } from "@/scripts/demo/intelligence/experiment-optimizer";
import {
  listAgentActions,
  approveAgentAction,
  rejectAgentAction,
  executeApprovedAction,
} from "@/scripts/demo/lib/demo-sales-agent";
import { buildRevenueWarehouse } from "@/scripts/demo/lib/demo-warehouse";
import { detectExpansionOpportunities } from "@/scripts/demo/lib/demo-expansion";
import type { ExecutiveIntelligencePayload } from "@/types/demo-intelligence";

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const learning = runRevenueLearningEngine();
    const conversion = runConversionOptimizer();
    const dealRisks = reviewAllOpenDeals();
    const warehouse = buildRevenueWarehouse();
    const expansionOpportunities = detectExpansionOpportunities();
    const pendingActions = listAgentActions();

    const payload: ExecutiveIntelligencePayload = {
      analyzedAt: new Date().toISOString(),
      warehouse: warehouse.aggregations,
      winLoss: learning.winLoss,
      insights: learning.insights,
      dealRisks: dealRisks.slice(0, 10),
      pendingActions: pendingActions.slice(0, 10),
      expansionOpportunities: expansionOpportunities.slice(0, 10),
      landingOptimizations: conversion.landingOptimizations,
      cadenceOptimizations: conversion.cadenceOptimizations,
      channelRecommendations: conversion.channelRecommendations,
    };

    return ok(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("internal_error", message, 500);
  }
}

export async function POST(req: NextRequest) {
  let operatorEmail = "admin@deskcomm.internal";
  try {
    const adminCtx = await requirePlatformAdmin();
    operatorEmail = adminCtx.user.email || operatorEmail;
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      actionId?: string;
      reason?: string;
    };

    if (body.action === "approve_agent_action" && body.actionId) {
      const approved = approveAgentAction(body.actionId, operatorEmail);
      if (!approved) return fail("not_found", "Action not found", 404);
      return ok({ success: true, action: approved });
    }

    if (body.action === "reject_agent_action" && body.actionId) {
      const rejected = rejectAgentAction(body.actionId, body.reason || "Rejected by operator", operatorEmail);
      if (!rejected) return fail("not_found", "Action not found", 404);
      return ok({ success: true, action: rejected });
    }

    if (body.action === "execute_agent_action" && body.actionId) {
      const res = await executeApprovedAction(body.actionId);
      if (!res.success) return fail("execution_failed", res.error || "Execution failed", 400);
      return ok(res);
    }

    if (body.action === "optimize_experiments") {
      const results = runOptimizationLoop();
      return ok({ success: true, results });
    }

    return fail("bad_request", "Unsupported action parameter", 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("internal_error", message, 500);
  }
}
