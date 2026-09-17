/**
 * app/api/v1/admin/sales/performance/route.ts
 *
 * API endpoint for Sales Performance Analytics.
 * Computes rep metrics: assigned demos, response time, meetings booked,
 * conversions, and influenced closed revenue.
 */

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { listAssignments } from "@/scripts/demo/lib/demo-sales-assignments";
import { listDemoLeads } from "@/scripts/demo/lib/demo-leads";
import { listDemoDeals } from "@/scripts/demo/lib/demo-deals";
import { listSLATimers } from "@/scripts/demo/lib/demo-sla";

export interface RepPerformanceRow {
  repId: string;
  repName: string;
  repEmail: string;
  assignedDemos: number;
  avgResponseTimeMinutes: number;
  meetingsBooked: number;
  conversionsCount: number;
  conversionRatePercentage: number;
  influencedRevenue: Record<string, number>;
}

export interface SalesPerformancePayload {
  summary: {
    totalReps: number;
    totalAssignedDemos: number;
    totalMeetingsBooked: number;
    totalConversions: number;
    overallConversionRate: number;
    totalInfluencedRevenue: Record<string, number>;
  };
  reps: RepPerformanceRow[];
  retrievedAt: string;
}

export async function GET() {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const assignments = listAssignments();
    const leads = listDemoLeads();
    const deals = listDemoDeals();
    const timers = listSLATimers();

    // Map tenant to lead status
    const tenantLeadMap = new Map<string, (typeof leads)[0]>();
    for (const l of leads) {
      if (l.demo_tenant_id) tenantLeadMap.set(l.demo_tenant_id, l);
    }

    // Group assignments by rep
    const repGroups = new Map<
      string,
      { repName: string; repEmail: string; tenantIds: Set<string> }
    >();

    for (const a of assignments) {
      if (!repGroups.has(a.repId)) {
        repGroups.set(a.repId, {
          repName: a.repName,
          repEmail: a.repEmail,
          tenantIds: new Set(),
        });
      }
      repGroups.get(a.repId)!.tenantIds.add(a.tenantId);
    }

    // If no reps found, add a fallback representation so dashboard works
    if (repGroups.size === 0) {
      repGroups.set("rep_team", {
        repName: "Equipo General de Ventas",
        repEmail: "sales@deskcomm.io",
        tenantIds: new Set(leads.map((l) => l.demo_tenant_id).filter(Boolean)),
      });
    }

    const reps: RepPerformanceRow[] = [];
    const totalInfluencedRevenue: Record<string, number> = {};
    let globalMeetings = 0;
    let globalConversions = 0;
    let globalAssigned = 0;

    for (const [repId, group] of repGroups.entries()) {
      const assignedDemos = group.tenantIds.size;
      globalAssigned += assignedDemos;

      let meetingsBooked = 0;
      let conversionsCount = 0;
      const repRevenue: Record<string, number> = {};

      for (const tId of group.tenantIds) {
        const lead = tenantLeadMap.get(tId);
        if (
          lead?.status === "meeting_booked" ||
          lead?.status === "proposal_sent" ||
          lead?.status === "converted"
        ) {
          meetingsBooked += 1;
        }
        if (lead?.status === "converted") {
          conversionsCount += 1;
        }

        // Check deals won for this tenant
        const tenantDeals = deals.filter(
          (d) => d.tenantId === tId && d.status === "closed_won",
        );
        for (const deal of tenantDeals) {
          repRevenue[deal.currency] = (repRevenue[deal.currency] ?? 0) + deal.value;
          totalInfluencedRevenue[deal.currency] =
            (totalInfluencedRevenue[deal.currency] ?? 0) + deal.value;
        }
      }

      globalMeetings += meetingsBooked;
      globalConversions += conversionsCount;

      // Estimate average response time from completed timers
      const repTimers = timers.filter(
        (t) => group.tenantIds.has(t.tenantId) && t.completedAt,
      );
      let avgResponseTime = 45; // Default 45 min benchmark
      if (repTimers.length > 0) {
        let totalMinutes = 0;
        for (const t of repTimers) {
          const diffMs =
            new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime();
          totalMinutes += Math.max(5, Math.round(diffMs / (1000 * 60)));
        }
        avgResponseTime = Math.round(totalMinutes / repTimers.length);
      }

      const conversionRatePercentage =
        assignedDemos > 0 ? Math.round((conversionsCount / assignedDemos) * 100) : 0;

      reps.push({
        repId,
        repName: group.repName,
        repEmail: group.repEmail,
        assignedDemos,
        avgResponseTimeMinutes: avgResponseTime,
        meetingsBooked,
        conversionsCount,
        conversionRatePercentage,
        influencedRevenue: repRevenue,
      });
    }

    reps.sort((a, b) => b.conversionsCount - a.conversionsCount);

    const overallConversionRate =
      globalAssigned > 0 ? Math.round((globalConversions / globalAssigned) * 100) : 0;

    const payload: SalesPerformancePayload = {
      summary: {
        totalReps: reps.length,
        totalAssignedDemos: globalAssigned,
        totalMeetingsBooked: globalMeetings,
        totalConversions: globalConversions,
        overallConversionRate,
        totalInfluencedRevenue,
      },
      reps,
      retrievedAt: new Date().toISOString(),
    };

    return ok(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sales performance query error";
    return fail("performance_error", message, 500);
  }
}
