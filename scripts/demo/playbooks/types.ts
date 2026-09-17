/**
 * scripts/demo/playbooks/types.ts
 *
 * Types for Demo Playbook Automation Engine.
 * Supports conditional rules for sales routing, alerts, and cadences.
 */

export type RuleOperator = "equals" | "greater_than" | "contains" | "in";

export interface PlaybookCondition {
  field: "score" | "country" | "vertical" | "status" | "healthScore";
  operator: RuleOperator;
  value: string | number | string[];
}

export type PlaybookActionType =
  | "assign_rep"
  | "send_alert"
  | "trigger_cadence"
  | "tag_lead";

export interface PlaybookAction {
  type: PlaybookActionType;
  target?: string;
  metadata?: Record<string, unknown>;
}

export interface PlaybookRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: PlaybookCondition[];
  actions: PlaybookAction[];
}

export interface PlaybookContext {
  tenantId: string;
  score?: number;
  healthScore?: number;
  country?: string;
  vertical?: string;
  status?: string;
}

export interface PlaybookExecutionResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsExecuted: PlaybookAction[];
}
