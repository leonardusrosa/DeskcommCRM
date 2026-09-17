/**
 * scripts/demo/intelligence/learning-engine.ts
 *
 * Revenue Learning Engine.
 * Analyzes wins, losses, conversion time, channels, territories, and verticals.
 * Produces confidence-scored actionable commercial insights.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_DIR } from "../lib/demo-session";
import { listDemoDeals, type DemoDeal } from "../lib/demo-deals";
import { listDemoLeads, type DemoLead } from "../lib/demo-leads";
import { assertDemoEnvironmentSafety } from "../lib/guards";
import type {
  RevenueInsight,
  WinLossAnalysis,
  WinLossPattern,
  LearningEngineReport,
} from "./types";

export const DEFAULT_LEARNING_REPORT_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_revenue_learning.json",
);

function calculateCycleDays(createdAt: string, closedAt?: string): number {
  if (!closedAt) return 0;
  const start = new Date(createdAt).getTime();
  const end = new Date(closedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round(((end - start) / (1000 * 60 * 60 * 24)) * 10) / 10;
}

function aggregateSegment(
  deals: Array<{ deal: DemoDeal; lead?: DemoLead; cycleDays: number }>,
  getKey: (item: { deal: DemoDeal; lead?: DemoLead }) => { key: string; label: string },
): WinLossPattern[] {
  const map = new Map<string, { label: string; deals: Array<{ deal: DemoDeal; cycleDays: number }> }>();

  for (const item of deals) {
    const { key, label } = getKey(item);
    const existing = map.get(key) ?? { label, deals: [] };
    existing.deals.push(item);
    map.set(key, existing);
  }

  const results: WinLossPattern[] = [];
  for (const [key, val] of map.entries()) {
    const wins = val.deals.filter((d) => d.deal.status === "closed_won").length;
    const losses = val.deals.filter((d) => d.deal.status === "closed_lost").length;
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) / 100 : 0;
    const wonCycleDays = val.deals.filter((d) => d.deal.status === "closed_won");
    const avgCycleDays = wonCycleDays.length > 0
      ? Math.round((wonCycleDays.reduce((acc, c) => acc + c.cycleDays, 0) / wonCycleDays.length) * 10) / 10
      : 0;
    const totalValue = val.deals
      .filter((d) => d.deal.status === "closed_won")
      .reduce((sum, d) => sum + (d.deal.value || 0), 0);

    results.push({
      segmentKey: key,
      label: val.label,
      totalDeals: total,
      wins,
      losses,
      winRate,
      avgCycleDays,
      totalValue,
    });
  }

  return results.sort((a, b) => b.totalDeals - a.totalDeals);
}

export function analyzeWinLoss(
  deals: DemoDeal[],
  leads: DemoLead[],
): WinLossAnalysis {
  const closedDeals = deals.filter(
    (d) => d.status === "closed_won" || d.status === "closed_lost",
  );

  const leadsMap = new Map<string, DemoLead>();
  for (const l of leads) {
    leadsMap.set(l.id, l);
    if (l.demo_tenant_id) leadsMap.set(l.demo_tenant_id, l);
  }

  const enriched = closedDeals.map((d) => ({
    deal: d,
    lead: leadsMap.get(d.leadId) ?? leadsMap.get(d.tenantId),
    cycleDays: calculateCycleDays(d.createdAt, d.closedAt),
  }));

  const wins = closedDeals.filter((d) => d.status === "closed_won").length;
  const losses = closedDeals.filter((d) => d.status === "closed_lost").length;
  const total = wins + losses;
  const overallWinRate = total > 0 ? Math.round((wins / total) * 100) / 100 : 0;

  const wonItems = enriched.filter((e) => e.deal.status === "closed_won");
  const avgTimeToConvertDays = wonItems.length > 0
    ? Math.round((wonItems.reduce((acc, i) => acc + i.cycleDays, 0) / wonItems.length) * 10) / 10
    : 0;

  const byChannel = aggregateSegment(enriched, (item) => {
    const channel = item.lead?.whatsapp ? "whatsapp" : "direct";
    return { key: String(channel), label: String(channel).toUpperCase() };
  });

  const byTerritory = aggregateSegment(enriched, (item) => {
    const terr = item.lead?.country || item.deal.currency || "GLOBAL";
    return { key: String(terr).toLowerCase(), label: String(terr).toUpperCase() };
  });

  const byVertical = aggregateSegment(enriched, (item) => {
    const vert = item.lead?.vertical || "dental-clinic";
    return { key: String(vert), label: String(vert).replace(/-/g, " ") };
  });

  return {
    totalClosed: total,
    totalWins: wins,
    totalLosses: losses,
    overallWinRate,
    avgTimeToConvertDays,
    byChannel,
    byTerritory,
    byVertical,
  };
}

export function generateConfidenceInsights(analysis: WinLossAnalysis): RevenueInsight[] {
  const insights: RevenueInsight[] = [];
  const now = new Date().toISOString();

  // Channel pattern
  if (analysis.byChannel.length > 0) {
    const topChannel = [...analysis.byChannel].sort((a, b) => b.winRate - a.winRate)[0];
    if (topChannel && topChannel.totalDeals >= 1) {
      insights.push({
        id: `ins_chan_${Date.now()}`,
        title: `High Conversion Velocity via ${topChannel.label}`,
        type: "channel",
        summary: `Channel ${topChannel.label} demonstrates a ${Math.round(topChannel.winRate * 100)}% win rate with ${topChannel.avgCycleDays} days cycle time.`,
        confidence: Math.min(0.92, 0.65 + topChannel.totalDeals * 0.05),
        impact: topChannel.winRate >= 0.5 ? "high" : "medium",
        recommendations: [
          `Prioritize ${topChannel.label} first-touch cadences for incoming demo requests.`,
          `Allocate higher ad budget and automation triggers to ${topChannel.label}.`,
        ],
        evidence: { channel: topChannel.segmentKey, winRate: topChannel.winRate, totalDeals: topChannel.totalDeals },
        createdAt: now,
      });
    }
  }

  // Territory pattern
  if (analysis.byTerritory.length > 0) {
    const topTerritory = [...analysis.byTerritory].sort((a, b) => b.totalValue - a.totalValue)[0];
    if (topTerritory && topTerritory.totalDeals >= 1) {
      insights.push({
        id: `ins_terr_${Date.now() + 1}`,
        title: `Revenue Density in Territory ${topTerritory.label}`,
        type: "territory",
        summary: `Territory ${topTerritory.label} generated $${topTerritory.totalValue.toLocaleString()} in closed deals with ${Math.round(topTerritory.winRate * 100)}% conversion.`,
        confidence: 0.88,
        impact: "high",
        recommendations: [
          `Ensure localized currency and regional working hours are strictly applied for ${topTerritory.label}.`,
          `Deploy dedicated clinical sales representatives to handle ${topTerritory.label} volume.`,
        ],
        evidence: { territory: topTerritory.segmentKey, totalValue: topTerritory.totalValue, wins: topTerritory.wins },
        createdAt: now,
      });
    }
  }

  // Velocity pattern
  if (analysis.avgTimeToConvertDays > 0) {
    const isFast = analysis.avgTimeToConvertDays <= 5;
    insights.push({
      id: `ins_velo_${Date.now() + 2}`,
      title: isFast ? "Fast Sales Cycle Acceleration" : "Extended Decision Cycle Detected",
      type: "velocity",
      summary: `Average closed-won deal takes ${analysis.avgTimeToConvertDays} days from demo creation to agreement.`,
      confidence: 0.85,
      impact: isFast ? "medium" : "high",
      recommendations: isFast
        ? ["Maintain 24h response SLA to prevent momentum decay."]
        : ["Deploy automated Day 2 objection-handling guides to compress evaluation timeline."],
      evidence: { avgTimeToConvertDays: analysis.avgTimeToConvertDays, totalWins: analysis.totalWins },
      createdAt: now,
    });
  }

  return insights;
}

export function runRevenueLearningEngine(options?: {
  dealsFile?: string;
  leadsFile?: string;
  outputFile?: string;
}): LearningEngineReport {
  assertDemoEnvironmentSafety();

  const deals = listDemoDeals({ customFilePath: options?.dealsFile });
  const leads = listDemoLeads({}, options?.leadsFile);

  const winLoss = analyzeWinLoss(deals, leads);
  const insights = generateConfidenceInsights(winLoss);

  const report: LearningEngineReport = {
    analyzedAt: new Date().toISOString(),
    winLoss,
    insights,
  };

  const outFile = options?.outputFile ?? DEFAULT_LEARNING_REPORT_FILE;
  try {
    const dir = path.dirname(outFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
  } catch {
    // fail silent
  }

  return report;
}
