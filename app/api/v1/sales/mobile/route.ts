/**
 * app/api/v1/sales/mobile/route.ts
 *
 * API endpoint for Sales Mobile Workspace.
 * Returns urgent leads, SLA timer countdowns, suggested commercial actions,
 * and pre-formatted quick contact links (WhatsApp, Phone, Email).
 */

import { ok, fail } from "@/lib/api/wrappers";
import { listDemoLeads } from "@/scripts/demo/lib/demo-leads";
import { calculateDemoScore } from "@/scripts/demo/lib/demo-score";
import { listSLATimers, type SLAStatus } from "@/scripts/demo/lib/demo-sla";
import { calculateNextAction } from "@/scripts/demo/lib/demo-actions";

export interface MobileLeadCard {
  id: string;
  name: string;
  company: string;
  country: string;
  vertical: string;
  status: string;
  score: number;
  isHighIntent: boolean;
  sla: {
    status: SLAStatus;
    actionType: string;
    dueAt: string;
  };
  suggestedAction: {
    title: string;
    priority: "low" | "medium" | "high" | "urgent";
    dueInHours: number;
  };
  contact: {
    phone: string;
    email: string;
    whatsappUrl: string;
    phoneUrl: string;
    emailUrl: string;
  };
}

export async function GET() {
  try {
    const leads = listDemoLeads();
    const slaTimers = listSLATimers();

    const mobileCards: MobileLeadCard[] = leads.map((lead) => {
      const scoreResult = calculateDemoScore(lead.demo_tenant_id);
      const timer = slaTimers.find((t) => t.tenantId === lead.demo_tenant_id);
      const nextAction = calculateNextAction(lead.demo_tenant_id);

      const cleanPhone = lead.whatsapp.replace(/\D/g, "");
      const waGreeting = encodeURIComponent(
        `Hola ${lead.name}, soy tu asesor de Deskcomm. ¿Pudiste explorar tu demo de ${lead.company}?`,
      );

      return {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        country: lead.country,
        vertical: lead.vertical,
        status: lead.status,
        score: scoreResult.score,
        isHighIntent: scoreResult.isHighIntent,
        sla: {
          status: timer?.status ?? "on_track",
          actionType: timer?.actionType ?? "first_contact",
          dueAt: timer?.dueAt ?? new Date(Date.now() + 2 * 3600000).toISOString(),
        },
        suggestedAction: {
          title: nextAction.title,
          priority: nextAction.priority,
          dueInHours: nextAction.slaHours,
        },
        contact: {
          phone: lead.whatsapp,
          email: lead.email,
          whatsappUrl: `https://wa.me/${cleanPhone}?text=${waGreeting}`,
          phoneUrl: `tel:${lead.whatsapp}`,
          emailUrl: `mailto:${lead.email}?subject=Demo Deskcomm - ${encodeURIComponent(lead.company)}`,
        },
      };
    });

    // Sort by priority: breached/warning SLAs first, then highest score
    mobileCards.sort((a, b) => {
      if (a.sla.status === "breached" && b.sla.status !== "breached") return -1;
      if (b.sla.status === "breached" && a.sla.status !== "breached") return 1;
      if (a.sla.status === "warning" && b.sla.status !== "warning") return -1;
      if (b.sla.status === "warning" && a.sla.status !== "warning") return 1;
      return b.score - a.score;
    });

    return ok({
      leads: mobileCards,
      total: mobileCards.length,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load mobile sales leads";
    return fail("internal_error", message, 500);
  }
}
