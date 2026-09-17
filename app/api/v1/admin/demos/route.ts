import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { getDemoScore, getCommercialSignals } from "@/scripts/demo/lib/demo-score";
import {
  listDemoLeads,
  findDemoLeadByTenantId,
  updateDemoLeadStatus,
  type DemoLeadStatus,
} from "@/scripts/demo/lib/demo-leads";
import { getTrackedDemoEvents, getTrackedDemoSessions } from "@/scripts/demo/lib/demo-events";
import { isDemoActivated, getSuggestedNextAction } from "@/scripts/demo/lib/demo-activation";
import type { AdminDemoItem } from "@/types/demo-admin";

const patchSchema = z.object({
  tenantId: z.string().min(1),
  status: z.enum([
    "requested",
    "demo_created",
    "activated",
    "engaged",
    "meeting_booked",
    "proposal_sent",
    "converted",
    "lost",
    "active",
    "qualified",
  ]),
});

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase();
  const countryFilter = searchParams.get("country")?.toUpperCase();
  const statusFilter = searchParams.get("status");

  let orgs: Array<{
    id: string;
    slug: string;
    display_name: string;
    settings?: Record<string, unknown>;
    created_at?: string;
  }> = [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, slug, display_name, settings, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      orgs = data.filter((o) => {
        const s = (o.settings || {}) as Record<string, unknown>;
        return s.demo === true || o.slug.includes("demo") || o.slug.startsWith("clinica-");
      });
    }
  } catch {
    // Database connection or table unavailable: fallback to session and lead records
  }

  // If no DB orgs found, reconstruct from local demo leads and sessions
  if (orgs.length === 0) {
    const localLeads = listDemoLeads();
    const localSessions = getTrackedDemoSessions();

    const seenTenantIds = new Set<string>();
    for (const lead of localLeads) {
      seenTenantIds.add(lead.demo_tenant_id);
      orgs.push({
        id: lead.demo_tenant_id,
        slug: lead.demo_tenant_id,
        display_name: lead.company,
        settings: {
          demo: true,
          country: lead.country,
          industry: lead.vertical,
          demo_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        created_at: lead.created_at,
      });
    }

    for (const sess of localSessions) {
      if (!seenTenantIds.has(sess.tenant_id)) {
        orgs.push({
          id: sess.tenant_id,
          slug: sess.tenant_id,
          display_name: sess.profile,
          settings: {
            demo: true,
            country: sess.country,
          },
          created_at: sess.created_at,
        });
      }
    }
  }

  // Map and enrich with intelligence score, signals, and lead status
  const demoItems: AdminDemoItem[] = orgs.map((org) => {
    const settings = (org.settings || {}) as Record<string, unknown>;
    const tenantEvents = getTrackedDemoEvents(org.id);
    const lead = findDemoLeadByTenantId(org.id);

    // Score calculation
    const scoreResult = getDemoScore(org.id, tenantEvents);

    // Last activity detection
    const latestEvent = tenantEvents.at(-1);
    const lastActivity = latestEvent?.created_at || org.created_at || new Date().toISOString();
    const expiresAt = (settings.demo_expires_at as string) || null;

    // Commercial signals
    const signals = getCommercialSignals(org.id, {
      lastActivity,
      expiresAt: expiresAt || undefined,
      customEvents: tenantEvents,
    });

    const country = (lead?.country || (settings.country as string) || "CO").toUpperCase();
    const vertical = lead?.vertical || (settings.industry as string) || "dental-clinic";
    const conversionStatus = (lead?.status || "demo_created") as DemoLeadStatus;

    // Activation & next action evaluation
    const isActivated = isDemoActivated(org.id, tenantEvents);
    const nextAction = getSuggestedNextAction(org.id, {
      status: conversionStatus,
      score: scoreResult.score,
      isActivated,
      isExpiring: signals.some((s) => s.signal === "demo_expiring"),
      isInactive: signals.some((s) => s.signal === "demo_inactive"),
      customEvents: tenantEvents,
    });

    const lastEvent = latestEvent
      ? { name: latestEvent.event_name, createdAt: latestEvent.created_at }
      : null;

    return {
      id: org.id,
      name: org.display_name,
      slug: org.slug,
      country,
      vertical,
      score: scoreResult.score,
      scoreLevel: scoreResult.level,
      isHighIntent: scoreResult.isHighIntent,
      signals,
      lastActivity,
      expiresAt,
      conversionStatus,
      isActivated,
      nextAction,
      lastEvent,
      lead: lead
        ? {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            company: lead.company,
            whatsapp: lead.whatsapp,
          }
        : null,
      createdAt: org.created_at || new Date().toISOString(),
    };
  });

  // Apply filters
  const filtered = demoItems.filter((item) => {
    if (q) {
      const matchName = item.name.toLowerCase().includes(q);
      const matchLead = item.lead?.name.toLowerCase().includes(q) || item.lead?.company.toLowerCase().includes(q);
      if (!matchName && !matchLead) return false;
    }
    if (countryFilter && item.country !== countryFilter) return false;
    if (statusFilter && item.conversionStatus !== statusFilter) return false;
    return true;
  });

  return ok(filtered);
}

export async function PATCH(req: NextRequest) {
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Validation error", 400, {
      details: parsed.error.flatten(),
    });
  }

  const { tenantId, status } = parsed.data;
  const updated = updateDemoLeadStatus(tenantId, status);

  return ok({ success: true, updatedLead: updated });
}
