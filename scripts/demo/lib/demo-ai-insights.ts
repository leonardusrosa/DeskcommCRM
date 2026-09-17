/**
 * scripts/demo/lib/demo-ai-insights.ts
 *
 * Revenue Intelligence Synthesis Engine.
 * Analyzes funnel bottlenecks, cohort trends, attribution ROI, A/B experiments,
 * and deal velocities to produce executive-grade actionable insights.
 */

import crypto from "node:crypto";
import { getDemoFunnelMetrics } from "./demo-funnel";
import { computeDemoCohorts } from "./demo-cohorts";
import { getAttributionSummary } from "./demo-attribution";
import { listExperiments, getExperimentResults } from "./demo-experiments";
import { listDemoDeals } from "./demo-deals";

export interface AIRevenueInsight {
  id: string;
  category: "funnel" | "cohorts" | "attribution" | "experiments" | "deals";
  impact: "high" | "medium" | "low";
  title: string;
  summary: string;
  recommendation: string;
  metricValue?: string;
}

export interface RevenueIntelligenceReport {
  generatedAt: string;
  overallHealthSummary: string;
  insights: AIRevenueInsight[];
}

export function generateRevenueInsights(): RevenueIntelligenceReport {
  const funnel = getDemoFunnelMetrics();
  const cohorts = computeDemoCohorts({ dimension: "country" });
  const attribution = getAttributionSummary();
  const rawExperiments = listExperiments();
  const deals = listDemoDeals();

  const insights: AIRevenueInsight[] = [];

  // 1. Funnel Bottleneck Insight
  let maxDropOffStage = funnel.stages[1];
  for (let i = 1; i < funnel.stages.length; i++) {
    const s = funnel.stages[i]!;
    if (!maxDropOffStage || s.dropOffRate > maxDropOffStage.dropOffRate) {
      maxDropOffStage = s;
    }
  }

  if (maxDropOffStage) {
    insights.push({
      id: crypto.randomUUID(),
      category: "funnel",
      impact: maxDropOffStage.dropOffRate >= 50 ? "high" : "medium",
      title: `Pérdida Crítica en Etapa: ${maxDropOffStage.label}`,
      summary: `La tasa de abandono alcanza el ${maxDropOffStage.dropOffRate}% al pasar a '${maxDropOffStage.label}'.`,
      recommendation:
        maxDropOffStage.stage === "activated"
          ? "Automatizar mensaje de bienvenida con vídeo tour de 60 segundos por WhatsApp para elevar activación."
          : maxDropOffStage.stage === "meeting_booked"
          ? "Insertar llamada a la acción flotante con selector de horario en la demo para facilitar el agendamiento."
          : "Revisar la propuesta comercial estándar y agregar testimonios específicos del sector dental.",
      metricValue: `${maxDropOffStage.dropOffRate}% Abandono`,
    });
  }

  // 2. Cohort Top Performer Insight
  if (cohorts.cohorts.length > 0) {
    const topCohort = cohorts.cohorts[0]!;
    insights.push({
      id: crypto.randomUUID(),
      category: "cohorts",
      impact: "high",
      title: `Segmento Destacado: ${topCohort.label}`,
      summary: `Registra ${topCohort.demosCount} demos con una tasa de activación del ${topCohort.activationRatePercentage}% y ${topCohort.convertedCount} conversiones.`,
      recommendation: `Aumentar presupuesto publicitario en ${topCohort.label} e incorporar casos de éxito locales en las plantillas de seguimiento.`,
      metricValue: `${topCohort.conversionRatePercentage}% Conversión`,
    });
  }

  // 3. Attribution ROI Insight
  const sources = Object.entries(attribution.bySource);
  if (sources.length > 0) {
    sources.sort((a, b) => b[1].revenue - a[1].revenue);
    const [topSrc, data] = sources[0]!;
    insights.push({
      id: crypto.randomUUID(),
      category: "attribution",
      impact: "high",
      title: `Fuente de Mayor Retorno: ${topSrc.toUpperCase()}`,
      summary: `Ha generado un total de ${data.revenue.toLocaleString()} en ingresos atribuidos a través de ${data.count} prospectos.`,
      recommendation: `Fortalecer campañas enfocadas en ${topSrc} y optimizar los términos de búsqueda que originan los prospectos calificados.`,
      metricValue: `${data.revenue.toLocaleString()} Ingresos`,
    });
  }

  // 4. Experiments Uplift Insight
  for (const exp of rawExperiments) {
    const res = getExperimentResults(exp.id);
    if (res && res.upliftPercentage > 10 && res.leadingVariantId) {
      insights.push({
        id: crypto.randomUUID(),
        category: "experiments",
        impact: "medium",
        title: `Ganador Detectado en Test A/B: ${res.name}`,
        summary: `La variante '${res.leadingVariantId}' supera al control con un incremento de conversión del +${res.upliftPercentage}%.`,
        recommendation: `Desplegar la variante ganadora al 100% del tráfico para maximizar la tasa global de conversión de la página.`,
        metricValue: `+${res.upliftPercentage}% Uplift`,
      });
      break;
    }
  }

  // 5. Deals Velocity Insight
  const wonDeals = deals.filter((d) => d.status === "closed_won");
  const openDeals = deals.filter(
    (d) => d.status !== "closed_won" && d.status !== "closed_lost",
  );

  insights.push({
    id: crypto.randomUUID(),
    category: "deals",
    impact: openDeals.length > wonDeals.length ? "medium" : "low",
    title: "Oportunidades en Negociación Activa",
    summary: `Existen ${openDeals.length} tratos abiertos en proceso de negociación frente a ${wonDeals.length} ya cerrados con éxito.`,
    recommendation:
      openDeals.length > 0
        ? "Programar revisión de propuestas abiertas y ofrecer incentivo de descuento por cierre en el mes en curso."
        : "Incrementar prospección en frío y acelerar la captación de nuevas demostraciones.",
    metricValue: `${openDeals.length} Tratos Abiertos`,
  });

  const overallHealthSummary =
    insights.filter((i) => i.impact === "high").length > 2
      ? "Pipeline comercial dinámico con oportunidades clave de optimización en etapas intermedias del embudo."
      : "Rendimiento comercial estable con velocidad adecuada de conversión y retención de prospectos.";

  return {
    generatedAt: new Date().toISOString(),
    overallHealthSummary,
    insights,
  };
}
