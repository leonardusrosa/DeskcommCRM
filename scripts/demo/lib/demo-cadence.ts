/**
 * scripts/demo/lib/demo-cadence.ts
 *
 * Sales Cadence Engine for Deskcomm Demo Tenants.
 * Defines a 5-touch sales sequence per demo, keyed by day since creation.
 * Only fires for verified demo tenants. Never mutates production data.
 */

import { DEFAULT_DEMO_DIR } from "./demo-session";
import path from "node:path";
import fs from "node:fs";

export interface CadenceStep {
  day: number;
  name: string;
  trigger: string;
  channel: "whatsapp" | "email" | "in_app";
  subject: string;
  message: string;
  goal: string;
}

export interface CadenceState {
  tenantId: string;
  startedAt: string;
  completedSteps: number[];
  lastStepAt?: string;
}

export const DEMO_CADENCE: CadenceStep[] = [
  {
    day: 0,
    name: "Welcome & Activate",
    trigger: "demo_created",
    channel: "whatsapp",
    subject: "¡Tu demo de Deskcomm está lista!",
    message:
      "Hola {{name}} 👋 Tu entorno de {{company}} ya está configurado. Entra, revisa el inbox con conversaciones reales y el pipeline de pacientes. ¿Preguntas? Aquí estoy.",
    goal: "First login + inbox explored",
  },
  {
    day: 1,
    name: "Inbox Recovery",
    trigger: "demo_inactive",
    channel: "whatsapp",
    subject: "¿Viste el WhatsApp integrado?",
    message:
      "Hola {{name}}, notamos que aún no has explorado el inbox de tu demo. Hay 3 conversaciones de pacientes reales esperándote — incluyendo una en negociación activa. Vale la pena verlo 👆",
    goal: "inbox_viewed event fired",
  },
  {
    day: 2,
    name: "Feature Education",
    trigger: "demo_inactive",
    channel: "email",
    subject: "Cómo {{company}} puede reducir 60% el tiempo de recepción",
    message:
      "Hola {{name}},\n\nLas clínicas que usan Deskcomm reportan hasta 60% menos tiempo en coordinación de citas porque el agente de IA maneja las preguntas repetitivas.\n\nEn tu demo ya está configurado. ¿Lo probaste?\n\n→ Entra y ve la sección Agenda\n\nSaludos,\nEquipo Deskcomm",
    goal: "agenda_viewed + pipeline_viewed",
  },
  {
    day: 3,
    name: "Meeting Invitation",
    trigger: "demo_high_intent",
    channel: "whatsapp",
    subject: "¿30 minutos para diagnóstico personalizado?",
    message:
      "Hola {{name}}, quiero mostrarte exactamente cómo otra clínica dental en {{country}} usó Deskcomm para aumentar sus citas en 40% el primer mes. ¿Agenda una llamada de 30 min esta semana? 👉 deskcomm.io/demo/book",
    goal: "meeting_booked conversion event",
  },
  {
    day: 5,
    name: "Expiration Follow-up",
    trigger: "demo_expiring",
    channel: "email",
    subject: "Tu acceso demo expira pronto — ¿continuamos?",
    message:
      "Hola {{name}},\n\nTu periodo de prueba de Deskcomm para {{company}} finalizará en menos de 24 horas.\n\nPuedo extender el acceso o activar tu plan directamente hoy con condiciones especiales de lanzamiento.\n\n¿Hablamos? Responde este correo o escríbeme al WhatsApp.",
    goal: "proposal_sent or converted",
  },
];

export const DEFAULT_CADENCE_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_cadence.json");

/**
 * Returns which cadence step should fire today given days since demo creation.
 */
export function getCadenceStepForDay(daysSinceCreation: number): CadenceStep | null {
  return DEMO_CADENCE.find((s) => s.day === daysSinceCreation) ?? null;
}

/**
 * Returns all cadence steps that are due or overdue for a tenant.
 */
export function getDueCadenceSteps(
  tenantId: string,
  createdAt: string,
  now: Date = new Date(),
  customFilePath?: string,
): CadenceStep[] {
  const state = loadCadenceState(tenantId, customFilePath);
  const createdDate = new Date(createdAt);
  const daysSince = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  return DEMO_CADENCE.filter((step) => {
    if (step.day > daysSince) return false;
    return !state.completedSteps.includes(step.day);
  });
}

/**
 * Marks a cadence step as completed for a tenant.
 */
export function markCadenceStepComplete(
  tenantId: string,
  day: number,
  customFilePath = DEFAULT_CADENCE_FILE,
): CadenceState {
  const state = loadCadenceState(tenantId, customFilePath);
  if (!state.completedSteps.includes(day)) {
    state.completedSteps.push(day);
  }
  state.lastStepAt = new Date().toISOString();
  saveCadenceState(state, customFilePath);
  return state;
}

/**
 * Renders a cadence message template with lead data.
 */
export function renderCadenceMessage(
  step: CadenceStep,
  vars: { name?: string; company?: string; country?: string },
): string {
  return step.message
    .replace(/\{\{name\}\}/g, vars.name || "Doctor/a")
    .replace(/\{\{company\}\}/g, vars.company || "su clínica")
    .replace(/\{\{country\}\}/g, vars.country || "su país");
}

function loadCadenceState(
  tenantId: string,
  customFilePath = DEFAULT_CADENCE_FILE,
): CadenceState {
  const defaultState: CadenceState = {
    tenantId,
    startedAt: new Date().toISOString(),
    completedSteps: [],
  };

  if (!fs.existsSync(customFilePath)) return defaultState;
  try {
    const all = JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as CadenceState[];
    return all.find((s) => s.tenantId === tenantId) ?? defaultState;
  } catch {
    return defaultState;
  }
}

function saveCadenceState(state: CadenceState, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let all: CadenceState[] = [];
  if (fs.existsSync(targetFile)) {
    try { all = JSON.parse(fs.readFileSync(targetFile, "utf-8")); } catch { all = []; }
  }
  const idx = all.findIndex((s) => s.tenantId === state.tenantId);
  if (idx >= 0) all[idx] = state; else all.push(state);
  fs.writeFileSync(targetFile, JSON.stringify(all, null, 2), "utf-8");
}
