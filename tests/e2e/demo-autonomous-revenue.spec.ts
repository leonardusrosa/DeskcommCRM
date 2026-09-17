/**
 * tests/e2e/demo-autonomous-revenue.spec.ts
 *
 * Playwright E2E Spec: Full Autonomous Revenue OS Lifecycle.
 * Validates the complete autonomous continuum:
 *   Visitor → Demo → Intelligence → Sales → Revenue → Expansion
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// ─── 1. Executive Intelligence Dashboard Route ────────────────────────────────

test.describe("Executive Intelligence UI", () => {
  test("renders /admin/intelligence with predictive models and human approval gate", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/intelligence`);
    expect(res?.status()).not.toBe(500);

    const content = await page.textContent("body");
    expect(content).toContain("Inteligencia de Ingresos");
    expect(content).toContain("Operaciones Autónomas");
  });
});

// ─── 2. Autonomous Revenue Engine Full Lifecycle Simulation ──────────────────

test.describe("Autonomous Revenue OS Continuum Simulation", () => {
  const TEST_DIR = path.resolve(process.cwd(), ".demo", "test_e2e_autonomous");
  const TEST_DEALS = path.join(TEST_DIR, "demo_deals.json");
  const TEST_LEADS = path.join(TEST_DIR, "demo_leads.json");
  const TEST_EVENTS = path.join(TEST_DIR, "demo_events.json");
  const TEST_ACTIONS = path.join(TEST_DIR, "demo_agent_actions.json");
  const TEST_EXPANSIONS = path.join(TEST_DIR, "demo_expansions.json");

  test.beforeAll(() => {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  test.afterAll(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("validates complete lifecycle: Visitor → Demo → Intelligence → Sales → Revenue → Expansion", async () => {
    const { captureDemoLead } = await import("../../scripts/demo/lib/demo-leads");
    const { createDemoDeal, updateDealStatus } = await import("../../scripts/demo/lib/demo-deals");
    const { trackDemoEvent } = await import("../../scripts/demo/lib/demo-events");
    const { runRevenueLearningEngine } = await import("../../scripts/demo/intelligence/learning-engine");
    const { runConversionOptimizer } = await import("../../scripts/demo/intelligence/conversion-optimizer");
    const { evaluateDealRisk } = await import("../../scripts/demo/intelligence/deal-review");
    const {
      proposeAgentAction,
      approveAgentAction,
      executeApprovedAction,
    } = await import("../../scripts/demo/lib/demo-sales-agent");
    const { buildRevenueWarehouse } = await import("../../scripts/demo/lib/demo-warehouse");
    const { detectExpansionOpportunities } = await import("../../scripts/demo/lib/demo-expansion");

    const tenantId = `tenant_auto_${Date.now()}`;

    // ── Phase 1: Visitor Acquires Demo ──
    const lead = captureDemoLead(
      {
        name: "Dra. Carolina Restrepo",
        email: "carolina@sonrisabogota.co",
        whatsapp: "+573105551234",
        company: "Clínica Dental Restrepo",
        country: "CO",
        vertical: "dental-clinic",
        demo_tenant_id: tenantId,
      },
      TEST_LEADS,
    );
    expect(lead.id).toBeDefined();

    // ── Phase 2: Demo Provisioning & Exploration ──
    await trackDemoEvent(tenantId, "demo_created", { plan: "starter" }, { eventsFilePath: TEST_EVENTS });
    await trackDemoEvent(tenantId, "agenda_viewed", { feature: "agenda_sillones" }, { eventsFilePath: TEST_EVENTS });

    const deal = createDemoDeal(
      {
        leadId: lead.id,
        tenantId,
        plan: "starter",
        currency: "COP",
        notes: "Evaluating for 3 dental chairs in Bogota",
      },
      TEST_DEALS,
    );
    expect(deal.status).toBe("prospecting");

    // ── Phase 3: Intelligence & Learning ──
    const learningReport = runRevenueLearningEngine({
      dealsFile: TEST_DEALS,
      leadsFile: TEST_LEADS,
      outputFile: path.join(TEST_DIR, "learning.json"),
    });
    expect(learningReport.analyzedAt).toBeDefined();

    const conversionSuite = runConversionOptimizer();
    expect(conversionSuite.channelRecommendations.length).toBeGreaterThan(0);
    const coChannel = conversionSuite.channelRecommendations.find((c) => c.territory === "co");
    expect(coChannel?.primaryChannel).toBe("whatsapp");

    // Deal risk review
    const dealRisk = evaluateDealRisk(deal, lead, []);
    expect(dealRisk.dealId).toBe(deal.id);
    expect(dealRisk.riskScore).toBeDefined();

    // ── Phase 4: Sales Agent Human Approval Gate ──
    const proposedAction = proposeAgentAction(
      {
        leadId: lead.id,
        tenantId,
        type: "send_whatsapp_message",
        title: "Enviar Invitación a Demostración de Agenda Odontológica",
        rationale: "Lead con alto interés en sincronización de sillones dentales.",
        proposedPayload: {
          recipient: lead.whatsapp,
          channel: "whatsapp",
          body: "Estimada Dra. Carolina, su clínica demo está lista con 3 sillones configurados.",
        },
      },
      TEST_ACTIONS,
    );
    expect(proposedAction.status).toBe("pending_approval");

    // Block unapproved execution
    const blockedExecution = await executeApprovedAction(proposedAction.id, TEST_ACTIONS);
    expect(blockedExecution.success).toBe(false);
    expect(blockedExecution.error).toContain("CANNOT_EXECUTE_UNAPPROVED");

    // Explicit human approval
    const approvedAction = approveAgentAction(proposedAction.id, "director@deskcomm.com", TEST_ACTIONS);
    expect(approvedAction?.status).toBe("approved");
    expect(approvedAction?.approvedBy).toBe("director@deskcomm.com");

    // Approved execution succeeds
    const executed = await executeApprovedAction(proposedAction.id, TEST_ACTIONS);
    expect(executed.success).toBe(true);
    expect(executed.action?.status).toBe("executed");

    // ── Phase 5: Commercial Closing & Revenue Warehouse ──
    const closedDeal = updateDealStatus(deal.id, "closed_won", {
      customFilePath: TEST_DEALS,
      notes: "Contrato anual cerrado vía WhatsApp",
    });
    expect(closedDeal?.status).toBe("closed_won");

    const warehouse = buildRevenueWarehouse({
      dealsFile: TEST_DEALS,
      leadsFile: TEST_LEADS,
      outputFile: path.join(TEST_DIR, "warehouse.json"),
    });
    expect(warehouse.aggregations.totalConversions).toBeGreaterThanOrEqual(1);
    expect(warehouse.aggregations.totalMrrUsd).toBeGreaterThan(0);
    expect(warehouse.aggregations.totalArrUsd).toBe(warehouse.aggregations.totalMrrUsd * 12);

    // ── Phase 6: Expansion & Upsell Engine ──
    // Simulate high appointment usage to trigger expansion signals
    await trackDemoEvent(tenantId, "appointment_created", { count: 120 }, { eventsFilePath: TEST_EVENTS });
    await trackDemoEvent(tenantId, "meeting_booked", {}, { eventsFilePath: TEST_EVENTS });

    const expansions = detectExpansionOpportunities({
      dealsFile: TEST_DEALS,
      leadsFile: TEST_LEADS,
      eventsFile: TEST_EVENTS,
      customOutputFile: TEST_EXPANSIONS,
    });
    expect(expansions.length).toBeGreaterThan(0);

    const upgradeOpportunity = expansions.find((e) => e.tenantId === tenantId && e.type === "plan_upgrade");
    expect(upgradeOpportunity).toBeDefined();
    expect(upgradeOpportunity?.recommendedPlan).toBe("professional");
    expect(upgradeOpportunity?.estimatedExpansionMrr).toBeGreaterThan(0);
  });
});
