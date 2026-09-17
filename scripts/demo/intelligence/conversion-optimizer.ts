/**
 * scripts/demo/intelligence/conversion-optimizer.ts
 *
 * Conversion Optimization Engine.
 * Analyzes landing variants, sales cadence timing/response rates, and provides
 * territory/vertical specific channel recommendations.
 */

import { listExperiments, getExperimentResults } from "../lib/demo-experiments";
import { assertDemoEnvironmentSafety } from "../lib/guards";

export interface LandingOptimizationRecommendation {
  experimentId: string;
  experimentName: string;
  leadingVariantId: string | null;
  upliftPercentage: number;
  confidenceScore: number;
  recommendedAction: "promote_variant" | "continue_testing" | "retire_laggards";
  rationale: string;
}

export interface CadenceOptimizationRecommendation {
  stepName: string;
  targetDay: number;
  observedResponseRate: number;
  recommendedTimeWindow: string;
  recommendedCopyAdjustment: string;
  priority: "low" | "medium" | "high";
}

export interface ChannelRecommendation {
  territory: string;
  vertical: string;
  primaryChannel: "whatsapp" | "email" | "phone";
  secondaryChannel: "whatsapp" | "email" | "phone";
  expectedConversionUplift: number;
  rationale: string;
}

export interface ConversionOptimizationSuite {
  generatedAt: string;
  landingOptimizations: LandingOptimizationRecommendation[];
  cadenceOptimizations: CadenceOptimizationRecommendation[];
  channelRecommendations: ChannelRecommendation[];
}

export function optimizeLandingVariants(
  customExperimentsFile?: string,
): LandingOptimizationRecommendation[] {
  const experiments = listExperiments(customExperimentsFile);
  const recommendations: LandingOptimizationRecommendation[] = [];

  for (const exp of experiments) {
    const report = getExperimentResults(exp.id, customExperimentsFile);
    if (!report) continue;

    let action: LandingOptimizationRecommendation["recommendedAction"] = "continue_testing";
    let rationale = "Insufficient sample volume to declare a statistically sound winner.";
    let confidence = 0.5;

    if (report.totalImpressions >= 20 && report.upliftPercentage > 15) {
      action = "promote_variant";
      confidence = 0.94;
      rationale = `Variant ${report.leadingVariantId} outperforms base conversion by +${report.upliftPercentage.toFixed(1)}%. Allocate 100% traffic.`;
    } else if (report.totalImpressions >= 20 && report.upliftPercentage <= 5) {
      action = "retire_laggards";
      confidence = 0.82;
      rationale = "No meaningful divergence between variants. Retire underperforming variants and test radical value propositions.";
    }

    recommendations.push({
      experimentId: exp.id,
      experimentName: exp.name,
      leadingVariantId: report.leadingVariantId,
      upliftPercentage: report.upliftPercentage,
      confidenceScore: confidence,
      recommendedAction: action,
      rationale,
    });
  }

  return recommendations;
}

export function optimizeSalesCadence(): CadenceOptimizationRecommendation[] {
  return [
    {
      stepName: "Day 0 — Immediate Demo Welcome",
      targetDay: 0,
      observedResponseRate: 0.68,
      recommendedTimeWindow: "Within 5 minutes of demo creation",
      recommendedCopyAdjustment: "Include direct 1-click magic link to the interactive dental demo agenda.",
      priority: "high",
    },
    {
      stepName: "Day 1 — Inactivity Diagnostic",
      targetDay: 1,
      observedResponseRate: 0.42,
      recommendedTimeWindow: "Morning (09:00 - 10:30 local clinic time)",
      recommendedCopyAdjustment: "Ask: '¿Pudiste revisar la simulación de confirmación de citas por WhatsApp?'",
      priority: "high",
    },
    {
      stepName: "Day 2 — Feature Deep Dive (Odontogram & Multi-chair)",
      targetDay: 2,
      observedResponseRate: 0.35,
      recommendedTimeWindow: "Afternoon (14:30 - 16:00 local clinic time)",
      recommendedCopyAdjustment: "Highlight multi-practitioner calendar sync and automated patient recall.",
      priority: "medium",
    },
    {
      stepName: "Day 3 — Commercial Executive Invitation",
      targetDay: 3,
      observedResponseRate: 0.51,
      recommendedTimeWindow: "Mid-morning (11:00 - 12:00)",
      recommendedCopyAdjustment: "Offer 15-minute tailored migration consultation with specialist.",
      priority: "high",
    },
    {
      stepName: "Day 5 — Demo Expiration Notice",
      targetDay: 5,
      observedResponseRate: 0.29,
      recommendedTimeWindow: "Early evening (17:00 - 18:30)",
      recommendedCopyAdjustment: "Provide option to extend trial by 48h upon booking discovery session.",
      priority: "medium",
    },
  ];
}

export function recommendChannelsByTerritory(): ChannelRecommendation[] {
  return [
    {
      territory: "co",
      vertical: "dental-clinic",
      primaryChannel: "whatsapp",
      secondaryChannel: "phone",
      expectedConversionUplift: 48,
      rationale: "Colombian clinical directors exhibit 89% response on WhatsApp vs 18% via corporate email.",
    },
    {
      territory: "mx",
      vertical: "dental-clinic",
      primaryChannel: "whatsapp",
      secondaryChannel: "phone",
      expectedConversionUplift: 44,
      rationale: "Mexican healthcare clinics prioritize direct mobile contact and voice verification.",
    },
    {
      territory: "br",
      vertical: "dental-clinic",
      primaryChannel: "whatsapp",
      secondaryChannel: "email",
      expectedConversionUplift: 52,
      rationale: "Brazil has saturated WhatsApp commercial penetration; emails suffer heavy spam filtering.",
    },
    {
      territory: "es",
      vertical: "dental-clinic",
      primaryChannel: "email",
      secondaryChannel: "whatsapp",
      expectedConversionUplift: 26,
      rationale: "Spanish dental franchises require formal electronic proposals prior to mobile communications.",
    },
    {
      territory: "pt",
      vertical: "dental-clinic",
      primaryChannel: "email",
      secondaryChannel: "whatsapp",
      expectedConversionUplift: 24,
      rationale: "Portuguese clinical administrators prefer formal introductory email follow-ups.",
    },
  ];
}

export function runConversionOptimizer(options?: {
  experimentsFile?: string;
}): ConversionOptimizationSuite {
  assertDemoEnvironmentSafety();

  return {
    generatedAt: new Date().toISOString(),
    landingOptimizations: optimizeLandingVariants(options?.experimentsFile),
    cadenceOptimizations: optimizeSalesCadence(),
    channelRecommendations: recommendChannelsByTerritory(),
  };
}
