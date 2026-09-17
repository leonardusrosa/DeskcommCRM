/**
 * scripts/demo/intelligence/types.ts
 *
 * Domain types for Demo Revenue Learning & Intelligence Engine.
 * Supports autonomous pattern learning, win/loss modeling, and confidence-scored insights.
 */

export type InsightType = "channel" | "territory" | "vertical" | "velocity";
export type InsightImpact = "low" | "medium" | "high";

export interface RevenueInsight {
  id: string;
  title: string;
  type: InsightType;
  summary: string;
  confidence: number; // 0.0 - 1.0 (statistical/heuristic confidence)
  impact: InsightImpact;
  recommendations: string[];
  evidence: Record<string, unknown>;
  createdAt: string;
}

export interface WinLossPattern {
  segmentKey: string;
  label: string;
  totalDeals: number;
  wins: number;
  losses: number;
  winRate: number; // 0.0 - 1.0
  avgCycleDays: number;
  totalValue: number;
}

export interface WinLossAnalysis {
  totalClosed: number;
  totalWins: number;
  totalLosses: number;
  overallWinRate: number;
  avgTimeToConvertDays: number;
  byChannel: WinLossPattern[];
  byTerritory: WinLossPattern[];
  byVertical: WinLossPattern[];
}

export interface LearningEngineReport {
  analyzedAt: string;
  winLoss: WinLossAnalysis;
  insights: RevenueInsight[];
}
