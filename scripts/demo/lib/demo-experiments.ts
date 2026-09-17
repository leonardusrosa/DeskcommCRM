/**
 * scripts/demo/lib/demo-experiments.ts
 *
 * Demo Experiment Framework (demo_experiments).
 * Supports A/B testing on landing pages and conversion tracking with deterministic variant assignment.
 * Persisted locally in .demo/demo_experiments.json.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0-100 percentage
  impressions: number;
  conversions: number;
}

export interface DemoExperiment {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed";
  metric: string;
  variants: ExperimentVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentResultRow {
  variantId: string;
  variantName: string;
  impressions: number;
  conversions: number;
  conversionRatePercentage: number;
  isLeader: boolean;
}

export interface ExperimentReport {
  experimentId: string;
  name: string;
  status: string;
  totalImpressions: number;
  totalConversions: number;
  overallConversionRate: number;
  leadingVariantId: string | null;
  upliftPercentage: number;
  variants: ExperimentResultRow[];
}

export const DEFAULT_EXPERIMENTS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_experiments.json",
);

export function createExperiment(
  input: {
    id?: string;
    name: string;
    description?: string;
    metric?: string;
    variants?: Array<{ id: string; name: string; weight?: number }>;
  },
  customFilePath = DEFAULT_EXPERIMENTS_FILE,
): DemoExperiment {
  const expId = input.id ?? `exp_${Date.now()}`;
  const defaultVariants: ExperimentVariant[] = input.variants
    ? input.variants.map((v) => ({
        id: v.id,
        name: v.name,
        weight: v.weight ?? Math.round(100 / input.variants!.length),
        impressions: 0,
        conversions: 0,
      }))
    : [
        { id: "control", name: "Control (Versión A)", weight: 50, impressions: 0, conversions: 0 },
        { id: "variant_b", name: "Variante B (Enfoque Agenda)", weight: 50, impressions: 0, conversions: 0 },
      ];

  const experiment: DemoExperiment = {
    id: expId,
    name: input.name,
    description: input.description ?? "",
    status: "active",
    metric: input.metric ?? "demo_created",
    variants: defaultVariants,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  persistExperiment(experiment, customFilePath);
  return experiment;
}

/**
 * Deterministically assigns a variant to a visitor using hash modulo.
 * Increments impression count.
 */
export function assignExperimentVariant(
  experimentId: string,
  visitorId: string,
  customFilePath = DEFAULT_EXPERIMENTS_FILE,
): ExperimentVariant | null {
  const all = listExperiments(customFilePath);
  const exp = all.find((e) => e.id === experimentId);
  if (!exp || exp.variants.length === 0 || exp.status !== "active") return null;

  // Simple deterministic hash
  let hash = 0;
  const str = `${experimentId}:${visitorId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  // Weighted cumulative selection
  const totalWeight = exp.variants.reduce((acc, v) => acc + v.weight, 0);
  const point = positiveHash % (totalWeight > 0 ? totalWeight : 1);

  let cumulative = 0;
  let selected = exp.variants[0]!;
  for (const variant of exp.variants) {
    cumulative += variant.weight;
    if (point < cumulative) {
      selected = variant;
      break;
    }
  }

  // Increment impression
  selected.impressions += 1;
  exp.updatedAt = new Date().toISOString();
  saveAllExperiments(all, customFilePath);

  return selected;
}

export function recordExperimentConversion(
  experimentId: string,
  variantId: string,
  customFilePath = DEFAULT_EXPERIMENTS_FILE,
): boolean {
  const all = listExperiments(customFilePath);
  const exp = all.find((e) => e.id === experimentId);
  if (!exp) return false;

  const variant = exp.variants.find((v) => v.id === variantId);
  if (!variant) return false;

  variant.conversions += 1;
  exp.updatedAt = new Date().toISOString();
  saveAllExperiments(all, customFilePath);
  return true;
}

export function getExperimentResults(
  experimentId: string,
  customFilePath = DEFAULT_EXPERIMENTS_FILE,
): ExperimentReport | null {
  const all = listExperiments(customFilePath);
  const exp = all.find((e) => e.id === experimentId);
  if (!exp) return null;

  let totalImpressions = 0;
  let totalConversions = 0;
  let maxRate = -1;
  let leadingVariantId: string | null = null;

  const variantRows: ExperimentResultRow[] = exp.variants.map((v) => {
    totalImpressions += v.impressions;
    totalConversions += v.conversions;
    const rate = v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0;
    if (rate > maxRate) {
      maxRate = rate;
      leadingVariantId = v.id;
    }
    return {
      variantId: v.id,
      variantName: v.name,
      impressions: v.impressions,
      conversions: v.conversions,
      conversionRatePercentage: Math.round(rate * 10) / 10,
      isLeader: false,
    };
  });

  for (const row of variantRows) {
    if (row.variantId === leadingVariantId && maxRate > 0) {
      row.isLeader = true;
    }
  }

  const overallConversionRate =
    totalImpressions > 0
      ? Math.round((totalConversions / totalImpressions) * 100 * 10) / 10
      : 0;

  const controlRate = variantRows[0]?.conversionRatePercentage ?? 0;
  const upliftPercentage =
    controlRate > 0 && maxRate > controlRate
      ? Math.round(((maxRate - controlRate) / controlRate) * 100)
      : 0;

  return {
    experimentId: exp.id,
    name: exp.name,
    status: exp.status,
    totalImpressions,
    totalConversions,
    overallConversionRate,
    leadingVariantId,
    upliftPercentage,
    variants: variantRows,
  };
}

export function listExperiments(customFilePath = DEFAULT_EXPERIMENTS_FILE): DemoExperiment[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoExperiment[];
  } catch {
    return [];
  }
}

function persistExperiment(exp: DemoExperiment, targetFile: string): void {
  const all = listExperiments(targetFile);
  const idx = all.findIndex((e) => e.id === exp.id);
  if (idx >= 0) all[idx] = exp;
  else all.push(exp);
  saveAllExperiments(all, targetFile);
}

function saveAllExperiments(all: DemoExperiment[], targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(all, null, 2), "utf-8");
}
