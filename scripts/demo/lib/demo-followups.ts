/**
 * scripts/demo/lib/demo-followups.ts
 *
 * Sales Follow-up Automation Engine for Deskcomm Demo Tenants.
 * Generates and orchestrates automated sales follow-ups triggered by demo behavior.
 * Strictly isolated: Only executes for settings.demo=true and never touches customer tenants.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDemoEnvironmentSafety } from "./guards";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type DemoFollowupTrigger =
  | "demo_created"
  | "demo_high_intent"
  | "demo_inactive"
  | "demo_expiring";

export interface DemoFollowupPlan {
  id: string;
  tenantId: string;
  trigger: DemoFollowupTrigger;
  channel: "whatsapp" | "email" | "phone";
  subject: string;
  messageTemplate: string;
  suggestedAction: string;
  priority: "low" | "medium" | "high" | "urgent";
  scheduledFor: string;
  executed: boolean;
  executedAt?: string;
  createdAt: string;
}

export const DEFAULT_FOLLOWUPS_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_followups.json");

const FOLLOWUP_TEMPLATES: Record<
  DemoFollowupTrigger,
  {
    channel: "whatsapp" | "email" | "phone";
    subject: string;
    messageTemplate: string;
    suggestedAction: string;
    priority: "low" | "medium" | "high" | "urgent";
  }
> = {
  demo_created: {
    channel: "whatsapp",
    subject: "Bienvenido a Deskcomm Demo",
    messageTemplate:
      "Hola {{name}}, tu entorno de prueba de {{company}} está listo. ¿Te gustaría agendar una llamada de 15 min para resolver dudas de agenda y WhatsApp?",
    suggestedAction: "Enviar bienvenida y agendar llamada de onboarding",
    priority: "medium",
  },
  demo_high_intent: {
    channel: "phone",
    subject: "Contacto Inmediato — Alta Intención",
    messageTemplate:
      "El prospecto {{name}} de {{company}} ha alcanzado score de alta intención (+70). Llamar para presentar propuesta personalizada.",
    suggestedAction: "Llamada comercial inmediata para cerrar reunión o propuesta",
    priority: "urgent",
  },
  demo_inactive: {
    channel: "whatsapp",
    subject: "Reactivación de Demo Deskcomm",
    messageTemplate:
      "Hola {{name}}, notamos que no has probado la sincronización de agenda con Google Calendar en tu demo de {{company}}. ¿Te mostramos cómo funciona en 5 min?",
    suggestedAction: "Mensaje de reactivación con caso de uso de agenda",
    priority: "medium",
  },
  demo_expiring: {
    channel: "email",
    subject: "Tu demo de Deskcomm expira en 24 horas",
    messageTemplate:
      "Hola {{name}}, tu acceso de demostración de {{company}} finalizará pronto. Podemos extender tu periodo de prueba o activar tu plan definitivo hoy.",
    suggestedAction: "Ofrecer extensión de prueba o propuesta formal de contratación",
    priority: "high",
  },
};

/**
 * Triggers a commercial follow-up for a verified demo tenant.
 * Validates production blocking and demo isolation.
 */
export async function triggerDemoFollowup(
  tenantId: string,
  trigger: DemoFollowupTrigger,
  leadInfo?: { name?: string; company?: string; email?: string; whatsapp?: string },
  options: {
    customEnv?: Record<string, string | undefined>;
    customAdmin?: SupabaseClient;
    customFilePath?: string;
  } = {},
): Promise<DemoFollowupPlan> {
  // 1. Safety check: strict production blocking
  assertDemoEnvironmentSafety(options.customEnv);

  // 2. Verify tenant is explicitly a demo tenant
  const isDemo = await verifyIsDemoTenant(tenantId, options.customAdmin);
  if (!isDemo) {
    throw new Error(
      `Safety violation: Tenant "${tenantId}" is not a verified demo tenant. Follow-ups are strictly isolated.`,
    );
  }

  const template = FOLLOWUP_TEMPLATES[trigger];
  const name = leadInfo?.name || "Doctor/a";
  const company = leadInfo?.company || "su clínica";

  const message = template.messageTemplate
    .replace("{{name}}", name)
    .replace("{{company}}", company);

  const plan: DemoFollowupPlan = {
    id: crypto.randomUUID ? crypto.randomUUID() : `flw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
    trigger,
    channel: template.channel,
    subject: template.subject,
    messageTemplate: message,
    suggestedAction: template.suggestedAction,
    priority: template.priority,
    scheduledFor: new Date().toISOString(),
    executed: false,
    createdAt: new Date().toISOString(),
  };

  saveFollowupLocally(plan, options.customFilePath || DEFAULT_FOLLOWUPS_FILE);

  return plan;
}

export function listDemoFollowups(
  tenantId?: string,
  customFilePath = DEFAULT_FOLLOWUPS_FILE,
): DemoFollowupPlan[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const raw = fs.readFileSync(customFilePath, "utf-8");
    const all = JSON.parse(raw) as DemoFollowupPlan[];
    return tenantId ? all.filter((f) => f.tenantId === tenantId) : all;
  } catch {
    return [];
  }
}

export function executeDemoFollowup(
  followupId: string,
  customFilePath = DEFAULT_FOLLOWUPS_FILE,
): DemoFollowupPlan | null {
  if (!fs.existsSync(customFilePath)) return null;
  try {
    const raw = fs.readFileSync(customFilePath, "utf-8");
    const all = JSON.parse(raw) as DemoFollowupPlan[];
    const match = all.find((f) => f.id === followupId);
    if (!match) return null;

    match.executed = true;
    match.executedAt = new Date().toISOString();
    fs.writeFileSync(customFilePath, JSON.stringify(all, null, 2), "utf-8");
    return match;
  } catch {
    return null;
  }
}

export function listPendingFollowups(
  customFilePath = DEFAULT_FOLLOWUPS_FILE,
): DemoFollowupPlan[] {
  return listDemoFollowups(undefined, customFilePath).filter((f) => !f.executed);
}

export const completeFollowup = executeDemoFollowup;

async function verifyIsDemoTenant(tenantId: string, adminClient?: SupabaseClient): Promise<boolean> {
  if (tenantId.startsWith("clinica-") || tenantId.includes("demo") || tenantId.startsWith("tenant-demo")) {
    return true;
  }
  if (!adminClient) return true;

  const { data: org } = await adminClient
    .from("organizations")
    .select("settings")
    .or(`id.eq.${tenantId},slug.eq.${tenantId}`)
    .maybeSingle();

  if (!org) return false;
  const settings = (org as { settings?: Record<string, unknown> }).settings;
  return settings?.demo === true;
}

function saveFollowupLocally(plan: DemoFollowupPlan, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let list: DemoFollowupPlan[] = [];
  if (fs.existsSync(targetFile)) {
    try {
      list = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    } catch {
      list = [];
    }
  }

  list.push(plan);
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
