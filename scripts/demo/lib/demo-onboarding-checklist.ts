/**
 * scripts/demo/lib/demo-onboarding-checklist.ts
 *
 * Lightweight 48-hour onboarding guidance and First-Value evaluator for Pilot #4.
 * Defines the progressive checklist steps without implementing heavy workflow engines.
 */

import type {
  OnboardingStepsTracking,
  PerceivedValueCategory,
} from "@/types/demo-pilot-4";

export interface OnboardingStepDefinition {
  stepNumber: number;
  title: string;
  description: string;
  requiredForFirstValue: boolean;
  actionKey: keyof OnboardingStepsTracking;
}

export const GUIDED_48H_CHECKLIST_STEPS: OnboardingStepDefinition[] = [
  {
    stepNumber: 1,
    title: "Configuración Inicial de Clínica",
    description: "Confirmar nombre, zona horaria (America/Bogota), horarios de atención y servicios clínicos.",
    requiredForFirstValue: true,
    actionKey: "clinic_setup_completed",
  },
  {
    stepNumber: 2,
    title: "Equipo y Especialistas",
    description: "Invitar odontólogos y equipo de recepción con roles diferenciados.",
    requiredForFirstValue: true,
    actionKey: "team_setup_completed",
  },
  {
    stepNumber: 3,
    title: "Recepción WhatsApp Oficial",
    description: "Conectar la línea de recepción de la clínica y responder la primera conversación real.",
    requiredForFirstValue: true,
    actionKey: "whatsapp_connected",
  },
  {
    stepNumber: 4,
    title: "Agenda de Sillones y Disponibilidad",
    description: "Configurar horarios de doctores, duración de consulta y tipos de cita odontológica.",
    requiredForFirstValue: true,
    actionKey: "agenda_configured",
  },
  {
    stepNumber: 5,
    title: "Sincronización con Google Calendar",
    description: "Conexión opcional para reflejar turnos personales de los odontólogos.",
    requiredForFirstValue: false,
    actionKey: "google_connected",
  },
  {
    stepNumber: 6,
    title: "Primera Acción Clínica Real",
    description: "Atención de primer paciente por WhatsApp o registro de primera cita en la agenda.",
    requiredForFirstValue: true,
    actionKey: "first_real_appointment_created",
  },
];

/**
 * Evaluates whether a customer has reached First Value according to Pilot #4 rules:
 * 1. Usable reception/workflow (whatsapp_connected || clinic_setup_completed)
 * 2. At least one real team member active (activated_users >= 1)
 * 3. Agenda configured (agenda_configured)
 * 4. At least one real operational action:
 *    - real patient conversation handled (first_real_conversation); OR
 *    - real appointment created (first_real_appointment_created).
 */
export function evaluateFirstValue(
  steps: OnboardingStepsTracking,
  activatedUsers: number,
): { reached: boolean; qualifyingEvent?: "first_real_conversation" | "first_real_appointment_created" } {
  const receptionUsable = steps.whatsapp_connected || steps.clinic_setup_completed;
  const teamActive = activatedUsers >= 1;
  const agendaDone = steps.agenda_configured;

  if (receptionUsable && teamActive && agendaDone) {
    if (steps.first_real_conversation) {
      return { reached: true, qualifyingEvent: "first_real_conversation" };
    }
    if (steps.first_real_appointment_created) {
      return { reached: true, qualifyingEvent: "first_real_appointment_created" };
    }
  }

  return { reached: false };
}

/**
 * Classifies the customer raw response to:
 * "¿Qué fue lo primero que hizo que Deskcomm se sintiera útil para su clínica?"
 */
export function classifyPerceivedValue(rawResponse: string): PerceivedValueCategory {
  const lower = rawResponse.toLowerCase();
  if (lower.includes("whatsapp") || lower.includes("mensajes") || lower.includes("bandeja")) {
    return "WhatsApp organization";
  }
  if (lower.includes("agenda") || lower.includes("citas") || lower.includes("recordatorios")) {
    return "Agenda";
  }
  if (lower.includes("google") || lower.includes("calendar")) {
    return "Google Calendar";
  }
  if (lower.includes("equipo") || lower.includes("doctores") || lower.includes("recepcion")) {
    return "team visibility";
  }
  if (lower.includes("seguimiento") || lower.includes("presupuestos")) {
    return "follow-up";
  }
  if (lower.includes("historia") || lower.includes("paciente")) {
    return "patient history";
  }
  return "other";
}
