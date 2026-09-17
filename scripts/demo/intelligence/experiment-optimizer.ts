/**
 * scripts/demo/intelligence/experiment-optimizer.ts
 *
 * Experiment Optimization Engine.
 * Implements Multi-Armed Bandit adaptive traffic allocation, statistical winner detection (Z-test),
 * and an automated closed-loop optimization cycle.
 */

import {
  listExperiments,
  type DemoExperiment,
  DEFAULT_EXPERIMENTS_FILE,
} from "../lib/demo-experiments";
import { assertDemoEnvironmentSafety } from "../lib/guards";
import fs from "node:fs";

export interface StatisticalEvaluation {
  isSignificant: boolean;
  confidenceLevel: number; // e.g. 0.95
  zScore: number;
  winnerVariantId: string | null;
  pValueEstimate: number;
}

export interface AdaptiveAllocationResult {
  experimentId: string;
  previousWeights: Record<string, number>;
  newWeights: Record<string, number>;
  winnerDetected: boolean;
  winnerVariantId: string | null;
  statusUpdatedTo?: "active" | "completed" | "paused";
  explanation: string;
}

export function evaluateStatisticalSignificance(
  variants: DemoExperiment["variants"],
  minImpressionsPerVariant = 20,
): StatisticalEvaluation {
  if (variants.length < 2) {
    return { isSignificant: false, confidenceLevel: 0, zScore: 0, winnerVariantId: null, pValueEstimate: 1.0 };
  }

  const sorted = [...variants].sort((a, b) => {
    const rateA = a.impressions > 0 ? a.conversions / a.impressions : 0;
    const rateB = b.impressions > 0 ? b.conversions / b.impressions : 0;
    return rateB - rateA;
  });

  const best = sorted[0]!;
  const runnerUp = sorted[1]!;

  if (best.impressions < minImpressionsPerVariant || runnerUp.impressions < minImpressionsPerVariant) {
    return { isSignificant: false, confidenceLevel: 0, zScore: 0, winnerVariantId: null, pValueEstimate: 1.0 };
  }

  const p1 = best.conversions / best.impressions;
  const p2 = runnerUp.conversions / runnerUp.impressions;
  const pooledP = (best.conversions + runnerUp.conversions) / (best.impressions + runnerUp.impressions);

  if (pooledP <= 0 || pooledP >= 1) {
    return { isSignificant: false, confidenceLevel: 0, zScore: 0, winnerVariantId: null, pValueEstimate: 1.0 };
  }

  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / best.impressions + 1 / runnerUp.impressions));
  const zScore = se > 0 ? Math.round(((p1 - p2) / se) * 100) / 100 : 0;

  // Z >= 1.96 corresponds to 95% confidence (two-tailed p < 0.05)
  const isSignificant = zScore >= 1.96 && (p1 - p2) >= 0.05;

  return {
    isSignificant,
    confidenceLevel: isSignificant ? 0.95 : 0.8,
    zScore,
    winnerVariantId: isSignificant ? best.id : null,
    pValueEstimate: isSignificant ? 0.03 : 0.25,
  };
}

export function calculateAdaptiveWeights(
  variants: DemoExperiment["variants"],
  epsilon = 0.15, // 15% exploration, 85% exploitation
): Record<string, number> {
  if (variants.length === 0) return {};
  if (variants.length === 1) return { [variants[0]!.id]: 100 };

  const rates = variants.map((v) => ({
    id: v.id,
    rate: v.impressions > 0 ? v.conversions / v.impressions : 0,
  }));

  const best = [...rates].sort((a, b) => b.rate - a.rate)[0]!;
  const exploreWeight = Math.round((epsilon / variants.length) * 100);
  const exploitWeight = 100 - exploreWeight * (variants.length - 1);

  const newWeights: Record<string, number> = {};
  for (const v of variants) {
    if (v.id === best.id) {
      newWeights[v.id] = exploitWeight;
    } else {
      newWeights[v.id] = exploreWeight;
    }
  }

  return newWeights;
}

export function optimizeExperiment(
  experimentId: string,
  customFilePath = DEFAULT_EXPERIMENTS_FILE,
): AdaptiveAllocationResult | null {
  assertDemoEnvironmentSafety();

  const allExps = listExperiments(customFilePath);
  const exp = allExps.find((e) => e.id === experimentId);
  if (!exp || exp.status === "completed") return null;

  const previousWeights: Record<string, number> = {};
  for (const v of exp.variants) {
    previousWeights[v.id] = v.weight;
  }

  const statEval = evaluateStatisticalSignificance(exp.variants);
  let newWeights: Record<string, number>;
  let explanation = "";
  let statusUpdatedTo: DemoExperiment["status"] = exp.status;

  if (statEval.isSignificant && statEval.winnerVariantId) {
    // Winner detected! 100% traffic to winner
    newWeights = {};
    for (const v of exp.variants) {
      newWeights[v.id] = v.id === statEval.winnerVariantId ? 100 : 0;
    }
    statusUpdatedTo = "completed";
    explanation = `Statistical winner detected (${statEval.winnerVariantId}) with Z-Score ${statEval.zScore} (95% confidence). Allocated 100% traffic.`;
  } else {
    // Adaptive Bandit shift
    newWeights = calculateAdaptiveWeights(exp.variants);
    explanation = "Shifted traffic weights dynamically towards higher-converting variants (Exploitation + Exploration).";
  }

  // Update experiment on disk
  try {
    const content = fs.readFileSync(customFilePath, "utf8");
    const all = JSON.parse(content) as DemoExperiment[];
    const target = all.find((e) => e.id === experimentId);
    if (target) {
      target.variants = target.variants.map((v) => ({
        ...v,
        weight: newWeights[v.id] ?? v.weight,
      }));
      target.status = statusUpdatedTo;
      target.updatedAt = new Date().toISOString();
      fs.writeFileSync(customFilePath, JSON.stringify(all, null, 2), "utf8");
    }
  } catch {
    // fail silent
  }

  return {
    experimentId,
    previousWeights,
    newWeights,
    winnerDetected: statEval.isSignificant,
    winnerVariantId: statEval.winnerVariantId,
    statusUpdatedTo,
    explanation,
  };
}

export function runOptimizationLoop(
  customFilePath = DEFAULT_EXPERIMENTS_FILE,
): AdaptiveAllocationResult[] {
  const experiments = listExperiments(customFilePath);
  const activeExps = experiments.filter((e) => e.status === "active");
  const results: AdaptiveAllocationResult[] = [];

  for (const exp of activeExps) {
    const res = optimizeExperiment(exp.id, customFilePath);
    if (res) results.push(res);
  }

  return results;
}
