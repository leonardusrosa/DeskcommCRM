/**
 * app/api/v1/admin/demo-center/live/route.ts
 *
 * Realtime API route for Live Command Center.
 * Aggregates live bus events, queue telemetry, worker heartbeat,
 * active demos, SLA warnings, and recent sales activities.
 */

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { listPublishedEvents } from "@/scripts/demo/events";
import { listJobs } from "@/scripts/demo/queue";
import { getWorkerState } from "@/workers/demo-worker";
import { listDemoLeads } from "@/scripts/demo/lib/demo-leads";
import { listSLATimers } from "@/scripts/demo/lib/demo-sla";
import { getGlobalActivitySummary } from "@/scripts/demo/lib/demo-activity";

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const allEvents = listPublishedEvents();
    const recentEvents = allEvents.slice(-15).reverse();

    const allJobs = listJobs();
    const queueStats = {
      pending: allJobs.filter((j) => j.status === "pending").length,
      processing: allJobs.filter((j) => j.status === "processing").length,
      completed: allJobs.filter((j) => j.status === "completed").length,
      failed: allJobs.filter((j) => j.status === "failed").length,
      deadLetter: allJobs.filter((j) => j.status === "dead_letter").length,
      total: allJobs.length,
    };

    const workerState = getWorkerState();
    const leads = listDemoLeads();
    const activeDemosCount = leads.filter(
      (l) => l.status !== "lost" && l.status !== "converted",
    ).length;

    const slaTimers = listSLATimers();
    const activeAlerts = slaTimers.filter(
      (t) => t.status === "breached" || t.status === "warning",
    ).slice(-10);

    const activities = getGlobalActivitySummary().recentEvents.slice(0, 15);

    return ok({
      recentEvents,
      queueStats,
      workerState: workerState ?? {
        workerId: "offline",
        status: "stopped",
        jobsProcessed: 0,
        jobsFailed: 0,
        uptimeSeconds: 0,
        lastHeartbeatAt: new Date().toISOString(),
      },
      activeDemosCount,
      activeAlerts,
      recentActivities: activities,
      polledAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to poll live command center";
    return fail("internal_error", message, 500);
  }
}
