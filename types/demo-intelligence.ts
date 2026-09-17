/**
 * types/demo-intelligence.ts
 *
 * Unified types for Executive Intelligence Dashboard.
 */

import type { RevenueInsight, WinLossAnalysis } from "../scripts/demo/intelligence/types";
import type { DealRiskReview } from "../scripts/demo/intelligence/deal-review";
import type {
  LandingOptimizationRecommendation,
  CadenceOptimizationRecommendation,
  ChannelRecommendation,
} from "../scripts/demo/intelligence/conversion-optimizer";
import type { AgentAction } from "../scripts/demo/lib/demo-sales-agent";
import type { WarehouseAggregations } from "../scripts/demo/lib/demo-warehouse";
import type { ExpansionOpportunity } from "../scripts/demo/lib/demo-expansion";

export interface ExecutiveIntelligencePayload {
  analyzedAt: string;
  warehouse: WarehouseAggregations;
  winLoss: WinLossAnalysis;
  insights: RevenueInsight[];
  dealRisks: DealRiskReview[];
  pendingActions: AgentAction[];
  expansionOpportunities: ExpansionOpportunity[];
  landingOptimizations: LandingOptimizationRecommendation[];
  cadenceOptimizations: CadenceOptimizationRecommendation[];
  channelRecommendations: ChannelRecommendation[];
}
