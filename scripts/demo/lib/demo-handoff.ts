/**
 * scripts/demo/lib/demo-handoff.ts
 *
 * Customer Success Handoff Engine.
 * Generates structured onboarding packets when a demo deal is marked closed_won.
 * Seamlessly transitions prospects from sales to customer success.
 *
 * Strictly isolated: operates only in demo storage (.demo/demo_handoffs.json).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { assertDemoEnvironmentSafety } from "./guards";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import { findDemoLeadByTenantId } from "./demo-leads";
import { listDemoDeals } from "./demo-deals";
import { getLeadAssignment } from "./demo-sales-assignments";
import { calculateDemoHealthScore } from "./demo-health-score";
import { getTrackedDemoEvents } from "./demo-events";
import { recordDemoAudit } from "./demo-audit";

export interface OnboardingPacket {
  id: string;
  tenantId: string;
  company: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  country: string;
  vertical: string;
  plan: string;
  dealValue: number;
  currency: string;
  salesRepEmail: string;
  closedAt: string;
  healthScoreAtClose: number;
  accountSummary: {
    totalEvents: number;
    googleConnected: boolean;
    appointmentsCreated: boolean;
  };
  recommendedNextSteps: string[];
  generatedAt: string;
}

export const DEFAULT_HANDOFFS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_handoffs.json",
);

export function generateOnboardingPacket(
  tenantId: string,
  options: {
    customFilePath?: string;
    customEnv?: Record<string, string | undefined>;
  } = {},
): OnboardingPacket {
  assertDemoEnvironmentSafety(options.customEnv);
  const targetFile = options.customFilePath ?? DEFAULT_HANDOFFS_FILE;

  const lead = findDemoLeadByTenantId(tenantId);
  const deals = listDemoDeals({ tenantId });
  const wonDeal = deals.find((d) => d.status === "closed_won") || deals[0];
  const assignment = getLeadAssignment(tenantId);
  const health = calculateDemoHealthScore(tenantId);
  const events = getTrackedDemoEvents().filter((e) => e.tenant_id === tenantId);

  const eventNames = new Set(events.map((e) => e.event_name));

  const packet: OnboardingPacket = {
    id: crypto.randomUUID(),
    tenantId,
    company: lead?.company || "Clínica Demo",
    contactName: lead?.name || "Doctor/a Responsable",
    contactEmail: lead?.email || "contacto@demo.deskcomm.io",
    contactPhone: lead?.whatsapp,
    country: lead?.country || "CO",
    vertical: lead?.vertical || "dental-clinic",
    plan: wonDeal?.plan || "professional",
    dealValue: wonDeal?.value || 0,
    currency: wonDeal?.currency || "USD",
    salesRepEmail: assignment?.repEmail || "sales@deskcomm.io",
    closedAt: wonDeal?.closedAt || new Date().toISOString(),
    healthScoreAtClose: health.healthScore,
    accountSummary: {
      totalEvents: events.length,
      googleConnected: eventNames.has("google_connected"),
      appointmentsCreated: eventNames.has("appointment_created"),
    },
    recommendedNextSteps: [
      "1. Programar sesión de bienvenida y activación de cuenta de producción (45 min)",
      "2. Migrar equipo y operadores desde demo a producción con roles Admin/Recepción",
      "3. Conectar instancia definitiva de WhatsApp Evolution API",
      "4. Vincular Google Calendar oficial para sincronización bidireccional",
      "5. Configurar recordatorios automáticos de citas y política de confirmación",
    ],
    generatedAt: new Date().toISOString(),
  };

  const all = listOnboardingPackets(targetFile);
  const existingIdx = all.findIndex((p) => p.tenantId === tenantId);
  if (existingIdx >= 0) all[existingIdx] = packet;
  else all.push(packet);

  saveHandoffs(all, targetFile);

  // Record audit
  recordDemoAudit({
    tenantId,
    actionType: "commercial_action",
    description: `Customer success onboarding packet generated for ${packet.company}`,
    metadata: { plan: packet.plan, dealValue: packet.dealValue },
  });

  return packet;
}

export function getOnboardingPacket(
  tenantId: string,
  customFilePath = DEFAULT_HANDOFFS_FILE,
): OnboardingPacket | null {
  const all = listOnboardingPackets(customFilePath);
  return all.find((p) => p.tenantId === tenantId) ?? null;
}

export function listOnboardingPackets(
  customFilePath = DEFAULT_HANDOFFS_FILE,
): OnboardingPacket[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as OnboardingPacket[];
  } catch {
    return [];
  }
}

function saveHandoffs(list: OnboardingPacket[], targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
