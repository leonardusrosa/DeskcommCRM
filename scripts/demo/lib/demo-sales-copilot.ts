/**
 * scripts/demo/lib/demo-sales-copilot.ts
 *
 * AI Sales Copilot Engine.
 * Generates tailored sales intelligence briefs:
 *   - Lead context summary
 *   - Strategic next sales action & recommended channel
 *   - Anticipated objections with counter-arguments
 *   - Meeting preparation checklist and discovery questions
 *
 * Safe & isolated in demo environment.
 */

import { listDemoLeads, type DemoLead } from "./demo-leads";
import { calculateDemoScore } from "./demo-score";
import { calculateNextAction } from "./demo-actions";
import { resolveTerritory } from "./demo-territories";

export interface SalesCopilotBrief {
  leadId: string;
  tenantId: string;
  leadSummary: string;
  nextAction: {
    title: string;
    priority: "low" | "medium" | "high" | "urgent";
    dueInHours: number;
    recommendedChannel: "whatsapp" | "email" | "call";
    talkingPoint: string;
  };
  objections: Array<{
    objection: string;
    counterArgument: string;
  }>;
  meetingPreparation: {
    recommendedDemoFeatures: string[];
    discoveryQuestions: string[];
    pitchHook: string;
  };
  generatedAt: string;
}

const VERTICAL_OBJECTIONS: Record<string, Array<{ objection: string; counterArgument: string }>> = {
  "dental-clinic": [
    {
      objection: "El equipo auxiliar está acostumbrado a nuestro software antiguo y temen la curva de aprendizaje.",
      counterArgument: "Deskcomm tiene una interfaz intuitiva tipo WhatsApp web que secretarias y odontólogos dominan en menos de 30 minutos.",
    },
    {
      objection: "¿Cómo migramos las historias clínicas y agendas de pacientes existentes?",
      counterArgument: "Contamos con importadores guiados de Excel y sincronización directa de Google Calendar para migración sin interrupción del servicio.",
    },
    {
      objection: "Queremos evitar costos fijos elevados en dólares o euros.",
      counterArgument: "Facturamos en moneda local según territorio con planes escalables ajustados al número de sillones dentales.",
    },
  ],
  default: [
    {
      objection: "Actualmente gestionamos las citas de forma manual o con libretas.",
      counterArgument: "La automatización de recordatorios por WhatsApp reduce el ausentismo de pacientes hasta en un 42% desde el primer mes.",
    },
    {
      objection: "No tenemos departamento de sistemas para mantener el software.",
      counterArgument: "Deskcomm es una plataforma cloud totalmente administrada, con copias de seguridad automáticas y soporte directo.",
    },
  ],
};

/**
 * Generates an executive-grade AI sales copilot brief for a demo prospect.
 */
export function generateSalesCopilotBrief(
  leadIdOrTenantId: string,
  options: { customLeadsFile?: string } = {},
): SalesCopilotBrief {
  const leads = listDemoLeads(undefined, options.customLeadsFile);
  const lead: DemoLead | undefined = leads.find(
    (l) => l.id === leadIdOrTenantId || l.demo_tenant_id === leadIdOrTenantId,
  );

  const fallbackLead: DemoLead = {
    id: leadIdOrTenantId,
    name: "Dr. Prospecto Demo",
    company: "Clínica Odontológica Demo",
    country: "CO",
    vertical: "dental-clinic",
    email: "doctor@sonrisabogota.demo",
    whatsapp: "+573001234567",
    demo_tenant_id: leadIdOrTenantId,
    status: "activated",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const target = lead || fallbackLead;
  const scoreResult = calculateDemoScore(target.demo_tenant_id);
  const nextAction = calculateNextAction(target.demo_tenant_id);
  const territory = resolveTerritory(target.country);

  const channel: "whatsapp" | "email" | "call" =
    scoreResult.score >= 70 ? "whatsapp" : "email";

  const leadSummary = `${target.name} de ${target.company} (${target.country}, Territorio ${territory.name}). Estado comercial: '${target.status}' con puntuación de intención de ${scoreResult.score}/100. Registra interés en optimización operativa clínica.`;

  const objections = VERTICAL_OBJECTIONS[target.vertical] || VERTICAL_OBJECTIONS.default!;

  const meetingPreparation = {
    pitchHook: `Enfocar la propuesta de valor en la reducción de inasistencias en ${target.company} mediante recordatorios automatizados de citas por WhatsApp sincronizados con Google Calendar.`,
    recommendedDemoFeatures: [
      "Bandeja de entrada multicanal unificada (WhatsApp + Agenda)",
      "Sincronización en tiempo real con Google Calendar",
      "Embudos comerciales para seguimiento de presupuestos clínicos",
      "Métricas de tiempos de respuesta del equipo asistencial",
    ],
    discoveryQuestions: [
      `¿Cuántas citas programadas se pierden al mes por falta de confirmación de pacientes en ${target.company}?`,
      "¿Utilizan actualmente Google Calendar para coordinar doctores y salas?",
      "¿Quién en la clínica toma la decisión final sobre la incorporación de nuevas herramientas digitales?",
    ],
  };

  return {
    leadId: target.id,
    tenantId: target.demo_tenant_id,
    leadSummary,
    nextAction: {
      title: nextAction.title,
      priority: nextAction.priority,
      dueInHours: nextAction.slaHours,
      recommendedChannel: channel,
      talkingPoint: `Hola ${target.name}, vi que estuviste revisando la demo de ${target.company}. Me gustaría mostrarte en 10 minutos cómo sincronizar tu agenda de Google Calendar para no perder más citas.`,
    },
    objections,
    meetingPreparation,
    generatedAt: new Date().toISOString(),
  };
}
