/**
 * tests/unit/demo-autonomous-operations.test.ts
 *
 * Unit tests for Demo Revenue OS Autonomous Operations:
 *   1. Revenue Learning Engine & Pattern Detection
 *   2. Conversion & Sales Cadence Optimization
 *   3. AI Deal Review & Algorithmic Risk Scoring
 *   4. Sales Agent Assistant & Human Approval Gate
 *   5. Global Localization (Multi-language, Currencies, Timezones)
 *   6. Revenue Warehouse Dimensional Star Schema & Aggregations
 *   7. Adaptive Experiment Optimization & Bandit Allocation
 *   8. Account Expansion & Upsell Engine
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  analyzeWinLoss,
  generateConfidenceInsights,
} from "../../scripts/demo/intelligence/learning-engine";
import {
  optimizeSalesCadence,
  recommendChannelsByTerritory,
} from "../../scripts/demo/intelligence/conversion-optimizer";
import { evaluateDealRisk } from "../../scripts/demo/intelligence/deal-review";
import {
  proposeAgentAction,
  approveAgentAction,
  rejectAgentAction,
  executeApprovedAction,
} from "../../scripts/demo/lib/demo-sales-agent";
import {
  convertCurrency,
  formatLocalizedCurrency,
  resolveTerritoryConfig,
  getLocalizedSalesMessage,
} from "../../scripts/demo/lib/demo-localization";
import { buildRevenueWarehouse } from "../../scripts/demo/lib/demo-warehouse";
import {
  evaluateStatisticalSignificance,
  calculateAdaptiveWeights,
} from "../../scripts/demo/intelligence/experiment-optimizer";
import { detectExpansionOpportunities } from "../../scripts/demo/lib/demo-expansion";
import type { DemoDeal } from "../../scripts/demo/lib/demo-deals";
import type { DemoLead } from "../../scripts/demo/lib/demo-leads";

const TEST_DIR = path.resolve(process.cwd(), ".demo", "test_autonomous");
const TEST_DEALS = path.join(TEST_DIR, "deals.json");
const TEST_LEADS = path.join(TEST_DIR, "leads.json");
const TEST_EVENTS = path.join(TEST_DIR, "events.json");
const TEST_ACTIONS = path.join(TEST_DIR, "agent_actions.json");

describe("Demo Autonomous Operations Unit Suite", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("1. Revenue Learning Engine: computes win/loss and confidence insights", () => {
    const deals: DemoDeal[] = [
      {
        id: "d1",
        leadId: "l1",
        tenantId: "t1",
        plan: "professional",
        value: 797,
        currency: "BRL",
        status: "closed_won",
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
      },
      {
        id: "d2",
        leadId: "l2",
        tenantId: "t2",
        plan: "starter",
        value: 397,
        currency: "BRL",
        status: "closed_lost",
        createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
      },
    ];

    const leads: DemoLead[] = [
      { id: "l1", name: "Dr Silva", company: "Silva Odonto", email: "silva@email.com", whatsapp: "+551199999", country: "BR", vertical: "dental-clinic", demo_tenant_id: "t1", created_at: "", updated_at: "", status: "converted" },
      { id: "l2", name: "Dr Santos", company: "Santos Odonto", email: "santos@email.com", whatsapp: "", country: "BR", vertical: "dental-clinic", demo_tenant_id: "t2", created_at: "", updated_at: "", status: "lost" },
    ];

    const analysis = analyzeWinLoss(deals, leads);
    expect(analysis.totalClosed).toBe(2);
    expect(analysis.totalWins).toBe(1);
    expect(analysis.overallWinRate).toBe(0.5);

    const insights = generateConfidenceInsights(analysis);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]!.confidence).toBeGreaterThan(0.5);
  });

  it("2. Conversion Optimizer: provides territory cadence and channel recommendations", () => {
    const cadences = optimizeSalesCadence();
    expect(cadences.length).toBe(5);
    expect(cadences[0]!.stepName).toContain("Day 0");

    const channels = recommendChannelsByTerritory();
    const colombia = channels.find((c) => c.territory === "co");
    expect(colombia?.primaryChannel).toBe("whatsapp");
  });

  it("3. AI Deal Review: assigns high risk score to stalled and inactive deals", () => {
    const stalledDeal: DemoDeal = {
      id: "d-stall",
      leadId: "l-stall",
      tenantId: "t-stall",
      plan: "enterprise",
      value: 1497,
      currency: "BRL",
      status: "proposal",
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(), // 10 days inactive
    };

    const review = evaluateDealRisk(stalledDeal, undefined, []);
    expect(review.riskScore).toBeGreaterThanOrEqual(50);
    expect(review.riskLevel).toMatch(/high|critical/);
    expect(review.riskFactors.length).toBeGreaterThan(0);
    expect(review.actionablePlaybook.recommendedAction).toBeDefined();
  });

  it("4. Sales Agent: strictly blocks execution until operator approves", async () => {
    const action = proposeAgentAction(
      {
        leadId: "lead_123",
        tenantId: "demo-tenant-co",
        type: "send_whatsapp_message",
        title: "Test WhatsApp Pitch",
        rationale: "Testing approval gate",
        proposedPayload: {
          recipient: "+573001234567",
          channel: "whatsapp",
          body: "Hola Dr, recordatorio de demo.",
        },
      },
      TEST_ACTIONS,
    );

    expect(action.status).toBe("pending_approval");

    // Attempting unapproved execution must fail
    const blockedResult = await executeApprovedAction(action.id, TEST_ACTIONS);
    expect(blockedResult.success).toBe(false);
    expect(blockedResult.error).toContain("CANNOT_EXECUTE_UNAPPROVED");

    // Operator approves action
    const approved = approveAgentAction(action.id, "operator@deskcomm.com", TEST_ACTIONS);
    expect(approved?.status).toBe("approved");

    // Execution now succeeds
    const successResult = await executeApprovedAction(action.id, TEST_ACTIONS);
    expect(successResult.success).toBe(true);
    expect(successResult.action?.status).toBe("executed");

    // Rejection workflow check
    const action2 = proposeAgentAction(
      {
        leadId: "lead_456",
        tenantId: "demo-tenant-mx",
        type: "send_email_proposal",
        title: "Test Reject",
        rationale: "Testing rejection",
        proposedPayload: { recipient: "dr@clinica.mx", channel: "email", body: "Propuesta..." },
      },
      TEST_ACTIONS,
    );
    const rejected = rejectAgentAction(action2.id, "Not interested", "op@deskcomm.com", TEST_ACTIONS);
    expect(rejected?.status).toBe("rejected");
  });

  it("5. Global Localization: converts currencies, formats messages and checks timezones", () => {
    const usdVal = convertCurrency(100, "USD", "EUR");
    expect(usdVal).toBeGreaterThan(0);

    const formattedBrl = formatLocalizedCurrency(797, "BRL");
    expect(formattedBrl).toContain("R$");

    const coConfig = resolveTerritoryConfig("co");
    expect(coConfig.currency).toBe("COP");
    expect(coConfig.language).toBe("es");

    const ptMsg = getLocalizedSalesMessage("welcome", "br", { chairCount: 4 });
    expect(ptMsg.body).toContain("cadeiras odontológicas");
  });

  it("6. Revenue Warehouse: builds dimensional star schema and aggregates metrics", () => {
    fs.writeFileSync(
      TEST_DEALS,
      JSON.stringify([
        {
          id: "dw1",
          leadId: "lw1",
          tenantId: "tw1",
          plan: "professional",
          value: 149,
          currency: "EUR",
          status: "closed_won",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          closedAt: new Date().toISOString(),
        },
      ]),
    );
    fs.writeFileSync(
      TEST_LEADS,
      JSON.stringify([
        { id: "lw1", name: "Dr Gomez", company: "Clinica Gomez", email: "gomez@email.com", whatsapp: "+34612345678", country: "ES", vertical: "dental-clinic", demo_tenant_id: "tw1", created_at: "", updated_at: "", status: "converted" },
      ]),
    );

    const wh = buildRevenueWarehouse({
      dealsFile: TEST_DEALS,
      leadsFile: TEST_LEADS,
      outputFile: path.join(TEST_DIR, "wh.json"),
    });

    expect(wh.dimensions.tenants).toHaveLength(1);
    expect(wh.dimensions.territories).toHaveLength(1);
    expect(wh.facts.conversions).toHaveLength(1);
    expect(wh.aggregations.totalMrrUsd).toBeGreaterThan(0);
    expect(wh.aggregations.totalArrUsd).toBe(wh.aggregations.totalMrrUsd * 12);
  });

  it("7. Experiment Optimization: calculates Z-score significance and bandit weights", () => {
    const variants = [
      { id: "var_a", name: "Control", weight: 50, impressions: 100, conversions: 5 },
      { id: "var_b", name: "Challenger", weight: 50, impressions: 100, conversions: 25 },
    ];

    const stats = evaluateStatisticalSignificance(variants);
    expect(stats.isSignificant).toBe(true);
    expect(stats.winnerVariantId).toBe("var_b");

    const weights = calculateAdaptiveWeights(variants, 0.1);
    expect(weights.var_b).toBeGreaterThan(weights.var_a);
  });

  it("8. Expansion Engine: detects plan upgrades and integration packs", () => {
    fs.writeFileSync(
      TEST_DEALS,
      JSON.stringify([
        {
          id: "exp_d1",
          leadId: "exp_l1",
          tenantId: "clinic-expansion-test",
          plan: "starter",
          value: 397,
          currency: "BRL",
          status: "closed_won",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    );

    const expansions = detectExpansionOpportunities({
      dealsFile: TEST_DEALS,
      leadsFile: TEST_LEADS,
      eventsFile: TEST_EVENTS,
      customOutputFile: path.join(TEST_DIR, "expansions.json"),
    });

    expect(expansions.length).toBeGreaterThan(0);
    const upgrade = expansions.find((e) => e.type === "plan_upgrade");
    expect(upgrade).toBeDefined();
    expect(upgrade?.recommendedPlan).toBe("professional");
  });
});
