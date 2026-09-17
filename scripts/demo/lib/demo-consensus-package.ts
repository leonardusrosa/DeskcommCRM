/**
 * scripts/demo/lib/demo-consensus-package.ts
 *
 * Lightweight consensus package generator for Pilot #3 treatment deals.
 * Generates forwardable WhatsApp summaries and prospect-provided ROI estimates.
 */

import type { ConsensusProposalPackage, Pilot3ProposalRecord } from "@/types/demo-pilot-3";

export function generateConsensusProposalPackage(
  deal: Pick<Pilot3ProposalRecord, "clinic" | "city" | "chairs" | "number_of_decision_makers">,
): ConsensusProposalPackage {
  const isLargeClinic = deal.chairs >= 4;
  const recommendedPlan = isLargeClinic ? "Professional" : "Starter";
  const monthlyPriceCop = isLargeClinic ? 360000 : 180000;
  const dentistsCount = Math.max(deal.number_of_decision_makers, Math.ceil(deal.chairs * 0.75));

  // Scenario modeling based on prospect inputs (approximate dental benchmarks in Colombia)
  const avgAppointmentValueCop = 120000;
  const missedPerMonth = deal.chairs * 14; // ~14 missed slots/chair/month
  const recoveredPerMonth = Math.round(missedPerMonth * 0.22); // 22% recovered with instant WhatsApp reminders
  const hoursSaved = deal.chairs * 4.5;
  const estimatedNetMonthlyImpactCop = recoveredPerMonth * avgAppointmentValueCop;

  const coreFeatures = [
    "Bandeja unificada multi-agente para WhatsApp Business",
    "Recordatorios automatizados de citas con confirmación 1-clic",
    "Pipeline visual de tratamientos y cotizaciones",
    "Sincronización bidireccional con Google Calendar",
  ];

  const implementationSteps = [
    "Día 1: Conexión de línea WhatsApp oficial sin interrumpir atención",
    "Día 2: Configuración de agenda y profesionales de la clínica",
    "Día 3: Capacitación en vivo de 30 min al equipo de recepción",
  ];

  const forwardableText = [
    `*Propuesta Deskcomm para ${deal.clinic}*`,
    `Hola doctores, les comparto el resumen de la plataforma para centralizar la clínica:`,
    `• WhatsApp de pacientes atendido por recepción y doctores`,
    `• Recordatorios automáticos para reducir inasistencias (~${recoveredPerMonth} citas recuperables/mes)`,
    `• Agenda médica integrada y seguimiento de presupuestos`,
    `• Inversión mensual: $${monthlyPriceCop.toLocaleString("es-CO")} COP/mes (Plan ${recommendedPlan})`,
    `• Retorno estimado: ~$${estimatedNetMonthlyImpactCop.toLocaleString("es-CO")} COP/mes en citas no perdidas`,
    `¿Le damos luz verde para iniciar este mes?`,
  ].join("\n");

  return {
    clinicSummary: {
      clinicName: deal.clinic,
      city: deal.city,
      dentistsCount,
      chairsCount: deal.chairs,
      operationalProblem:
        "Fuga de pacientes por respuestas tardías en WhatsApp y citas canceladas sin reprogramación ágil.",
    },
    roiSummary: {
      averageAppointmentValueCop: avgAppointmentValueCop,
      estimatedMissedPerMonth: missedPerMonth,
      recoverableAppointmentsPerMonth: recoveredPerMonth,
      estimatedHoursSavedPerMonth: hoursSaved,
      estimatedNetMonthlyImpactCop,
      disclaimer:
        "Estimaciones proyectadas con base en la capacidad reportada por la clínica. Resultados sujetos a volumen real de consultas.",
    },
    deskcommRecommendation: {
      recommendedPlan,
      monthlyPriceCop,
      coreFeatures,
      implementationSteps,
    },
    decisionMakerSummary: {
      centralizedCapabilities: [
        "Conversaciones de pacientes por WhatsApp centralizadas",
        "Seguimiento automático de tratamientos presentados",
        "Pipeline de ventas clínicas y agenda sincronizada",
      ],
      monthlyInvestmentCop: monthlyPriceCop,
      expectedOperationalBenefit: `Recuperación proyectada de ${recoveredPerMonth} citas al mes y ahorro de ${hoursSaved} horas operativas en recepción.`,
      forwardableText,
    },
    shareCta: {
      label: "Compartir con mis socios",
      action: "share_with_partners",
    },
    decisionCta: {
      options: [
        { label: "Aprobar", outcome: "approve" },
        { label: "Tengo una pregunta", outcome: "question" },
        { label: "No seguir", outcome: "decline" },
      ],
    },
  };
}
