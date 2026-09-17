/**
 * scripts/demo/playbooks/engine.ts
 *
 * Playbook Engine Implementation.
 * Evaluates conditional automation rules:
 *   - High intent routing (e.g. score >= 70)
 *   - Country routing (e.g. CO, MX, ES)
 *   - Vertical routing (e.g. dental-clinic)
 *
 * Persisted in .demo/demo_playbooks.json with standard defaults.
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_DIR } from "../lib/demo-session";
import type {
  PlaybookRule,
  PlaybookCondition,
  PlaybookContext,
  PlaybookExecutionResult,
} from "./types";

export const DEFAULT_PLAYBOOKS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_playbooks.json",
);

export const DEFAULT_RULES: PlaybookRule[] = [
  {
    id: "rule_high_intent",
    name: "High Intent Priority Routing",
    description: "Assigns leads with score >= 70 to senior reps and triggers Slack alert",
    enabled: true,
    conditions: [{ field: "score", operator: "greater_than", value: 69 }],
    actions: [
      { type: "assign_rep", target: "senior_rep@deskcomm.io" },
      { type: "send_alert", target: "slack", metadata: { severity: "critical" } },
    ],
  },
  {
    id: "rule_country_colombia",
    name: "Colombia Territory Routing",
    description: "Routes Colombian dental clinic demos to the Bogota sales desk",
    enabled: true,
    conditions: [{ field: "country", operator: "equals", value: "CO" }],
    actions: [
      { type: "assign_rep", target: "laura@bogota.demo" },
      { type: "tag_lead", target: "territory:colombia" },
    ],
  },
  {
    id: "rule_vertical_dental",
    name: "Dental Vertical Specialist Cadence",
    description: "Applies specialized clinical onboarding for dental clinics",
    enabled: true,
    conditions: [{ field: "vertical", operator: "equals", value: "dental-clinic" }],
    actions: [
      { type: "trigger_cadence", target: "dental_vip_cadence" },
      { type: "tag_lead", target: "vertical:dental" },
    ],
  },
];

export function evaluatePlaybookRules(
  context: PlaybookContext,
  customFilePath = DEFAULT_PLAYBOOKS_FILE,
): PlaybookExecutionResult[] {
  const rules = listPlaybookRules(customFilePath);
  const results: PlaybookExecutionResult[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const matched = rule.conditions.every((cond) => evaluateCondition(cond, context));
    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matched,
      actionsExecuted: matched ? rule.actions : [],
    });
  }

  return results;
}

function evaluateCondition(cond: PlaybookCondition, ctx: PlaybookContext): boolean {
  const actual = ctx[cond.field];
  if (actual === undefined || actual === null) return false;

  switch (cond.operator) {
    case "equals":
      return String(actual).toLowerCase() === String(cond.value).toLowerCase();
    case "greater_than":
      return Number(actual) > Number(cond.value);
    case "contains":
      return String(actual).toLowerCase().includes(String(cond.value).toLowerCase());
    case "in":
      if (Array.isArray(cond.value)) {
        return cond.value.map((v) => String(v).toLowerCase()).includes(String(actual).toLowerCase());
      }
      return false;
  }
}

export function registerPlaybookRule(
  rule: PlaybookRule,
  customFilePath = DEFAULT_PLAYBOOKS_FILE,
): void {
  const rules = listPlaybookRules(customFilePath);
  const idx = rules.findIndex((r) => r.id === rule.id);
  if (idx >= 0) rules[idx] = rule;
  else rules.push(rule);
  saveRules(rules, customFilePath);
}

export function listPlaybookRules(customFilePath = DEFAULT_PLAYBOOKS_FILE): PlaybookRule[] {
  if (!fs.existsSync(customFilePath)) {
    saveRules(DEFAULT_RULES, customFilePath);
    return DEFAULT_RULES;
  }
  try {
    return JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as PlaybookRule[];
  } catch {
    return DEFAULT_RULES;
  }
}

function saveRules(rules: PlaybookRule[], targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(rules, null, 2), "utf-8");
}
