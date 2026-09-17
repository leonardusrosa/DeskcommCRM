/**
 * app/api/v1/admin/demos/[id]/timeline/route.ts
 *
 * API endpoint for Demo Activity & Event Timeline.
 * Aggregates user activity, commercial events, score changes, notifications, and conversions.
 */

import { type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { ok, fail } from "@/lib/api/wrappers";
import { getActivityTimeline } from "@/scripts/demo/lib/demo-activity";
import { getTrackedDemoEvents } from "@/scripts/demo/lib/demo-events";
import { listDemoNotifications } from "@/scripts/demo/lib/demo-notifications";
import { listDemoAlerts } from "@/scripts/demo/lib/demo-alerts";
import { listDemoConversionEvents } from "@/scripts/demo/lib/demo-conversion-events";
import { findDemoLeadByTenantId } from "@/scripts/demo/lib/demo-leads";

export interface UnifiedTimelineItem {
  id: string;
  category: "user_action" | "commercial" | "score_change" | "notification" | "conversion" | "alert";
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
  metadata?: Record<string, unknown>;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const { id: tenantId } = await params;
    if (!tenantId) {
      return fail("bad_request", "Missing tenant id", 400);
    }

    const lead = findDemoLeadByTenantId(tenantId);
    const items: UnifiedTimelineItem[] = [];

    // 1. Activity events (user_action, commercial_action, score_change, meeting, conversion)
    const activities = getActivityTimeline(tenantId);
    for (const a of activities) {
      items.push({
        id: a.id,
        category:
          a.category === "score_change"
            ? "score_change"
            : a.category === "conversion"
            ? "conversion"
            : a.category === "user_action"
            ? "user_action"
            : "commercial",
        title: a.eventName.replace(/_/g, " ").toUpperCase(),
        description: a.description,
        timestamp: a.occurredAt,
        badge: a.score !== undefined ? `Score: ${a.score}` : undefined,
        metadata: a.metadata,
      });
    }

    // 2. Demo events from event tracking
    const events = getTrackedDemoEvents();
    for (const e of events) {
      if (e.tenant_id === tenantId) {
        items.push({
          id: e.id || `evt_${Math.random()}`,
          category: "user_action",
          title: e.event_name.replace(/_/g, " ").toUpperCase(),
          description: `Evento registrado: ${e.event_name}`,
          timestamp: e.created_at,
          metadata: e.metadata,
        });
      }
    }

    // 3. Notifications sent
    const notifs = listDemoNotifications(tenantId);
    for (const n of notifs) {
      items.push({
        id: n.id,
        category: "notification",
        title: `Notificación ${n.channel.toUpperCase()}`,
        description: n.subject || n.message.slice(0, 100),
        timestamp: n.createdAt,
        badge: n.status,
      });
    }

    // 4. Alerts dispatched
    const alerts = listDemoAlerts(tenantId);
    for (const al of alerts) {
      items.push({
        id: al.id,
        category: "alert",
        title: `Alerta: ${al.title}`,
        description: al.message,
        timestamp: al.createdAt,
        badge: al.severity,
      });
    }

    // 5. Conversion events
    const conversions = listDemoConversionEvents(tenantId);
    for (const c of conversions) {
      items.push({
        id: c.id,
        category: "conversion",
        title: `Conversión: ${c.event_name.toUpperCase()}`,
        description: `Evento comercial de conversión: ${c.event_name}`,
        timestamp: c.created_at,
        badge: "Conversión",
        metadata: c.metadata,
      });
    }

    // Sort descending by timestamp
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return ok({
      tenantId,
      lead,
      totalEvents: items.length,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Timeline fetch error";
    return fail("timeline_error", message, 500);
  }
}
