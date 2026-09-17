/**
 * tests/unit/demo-growth.test.ts
 *
 * Unit tests for Demo Growth & Revenue Intelligence Layer:
 *   - demo-funnel.ts
 *   - demo-cohorts.ts
 *   - demo-health-score.ts
 *   - scripts/demo/integrations/ (HubSpot, Pipedrive, Salesforce)
 *   - demo-attribution.ts
 *   - demo-experiments.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import type { DemoLead } from "../../scripts/demo/lib/demo-leads";
import type { DemoDeal } from "../../scripts/demo/lib/demo-deals";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-growth-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function tmp(name: string) {
  return path.join(tmpDir, name);
}

// ─── 1. Funnel Analytics ───────────────────────────────────────────────────

describe("Demo Funnel Analytics", () => {
  const mockLeads: DemoLead[] = [
    { id: "1", name: "L1", company: "C1", country: "CO", vertical: "dental", email: "l1@d.co", whatsapp: "1", demo_tenant_id: "t1", status: "requested", created_at: "2026-09-01", updated_at: "2026-09-01" },
    { id: "2", name: "L2", company: "C2", country: "CO", vertical: "dental", email: "l2@d.co", whatsapp: "2", demo_tenant_id: "t2", status: "demo_created", created_at: "2026-09-01", updated_at: "2026-09-01" },
    { id: "3", name: "L3", company: "C3", country: "MX", vertical: "dental", email: "l3@d.co", whatsapp: "3", demo_tenant_id: "t3", status: "activated", created_at: "2026-09-02", updated_at: "2026-09-02" },
    { id: "4", name: "L4", company: "C4", country: "ES", vertical: "dental", email: "l4@d.co", whatsapp: "4", demo_tenant_id: "t4", status: "meeting_booked", created_at: "2026-09-03", updated_at: "2026-09-03" },
    { id: "5", name: "L5", company: "C5", country: "CO", vertical: "dental", email: "l5@d.co", whatsapp: "5", demo_tenant_id: "t5", status: "converted", created_at: "2026-09-04", updated_at: "2026-09-04" },
  ];

  it("calculates cumulative waterfall funnel across 7 stages", async () => {
    const { getDemoFunnelMetrics } = await import("../../scripts/demo/lib/demo-funnel");
    const report = getDemoFunnelMetrics({ leads: mockLeads });

    expect(report.stages).toHaveLength(7);
    expect(report.totalRequested).toBe(5);
    expect(report.totalConverted).toBe(1);
    expect(report.overallConversionRate).toBe(20); // 1 / 5 = 20%

    // Waterfall: every lead has reached 'requested'
    const requestedStage = report.stages.find((s) => s.stage === "requested");
    expect(requestedStage?.cumulativeCount).toBe(5);

    // Converted lead has reached all stages
    const convertedStage = report.stages.find((s) => s.stage === "converted");
    expect(convertedStage?.cumulativeCount).toBe(1);
  });

  it("filters funnel by country correctly", async () => {
    const { getDemoFunnelMetrics } = await import("../../scripts/demo/lib/demo-funnel");
    const coReport = getDemoFunnelMetrics({ leads: mockLeads, country: "CO" });
    expect(coReport.totalRequested).toBe(3);
    expect(coReport.totalConverted).toBe(1);
  });
});

// ─── 2. Cohort Analytics ───────────────────────────────────────────────────

describe("Demo Cohort Analytics", () => {
  const mockLeads: DemoLead[] = [
    { id: "1", name: "A", company: "A", country: "CO", vertical: "dental", email: "a@d.co", whatsapp: "1", demo_tenant_id: "t1", status: "converted", created_at: "2026-08-10", updated_at: "2026-08-10" },
    { id: "2", name: "B", company: "B", country: "CO", vertical: "dental", email: "b@d.co", whatsapp: "2", demo_tenant_id: "t2", status: "activated", created_at: "2026-09-01", updated_at: "2026-09-01" },
    { id: "3", name: "C", company: "C", country: "MX", vertical: "aesthetic", email: "c@d.co", whatsapp: "3", demo_tenant_id: "t3", status: "meeting_booked", created_at: "2026-09-05", updated_at: "2026-09-05" },
  ];

  const mockDeals: DemoDeal[] = [
    { id: "d1", leadId: "1", tenantId: "t1", plan: "starter", value: 180000, currency: "COP", status: "closed_won", createdAt: "2026-08-12", updatedAt: "2026-08-12" },
  ];

  it("groups by country with activation and MRR metrics", async () => {
    const { computeDemoCohorts } = await import("../../scripts/demo/lib/demo-cohorts");
    const report = computeDemoCohorts({ dimension: "country", leads: mockLeads, deals: mockDeals });

    expect(report.cohorts.length).toBeGreaterThanOrEqual(2);
    const coCohort = report.cohorts.find((c) => c.key === "CO");
    expect(coCohort).toBeDefined();
    expect(coCohort?.demosCount).toBe(2);
    expect(coCohort?.convertedCount).toBe(1);
    expect(coCohort?.conversionRatePercentage).toBe(50);
    expect(coCohort?.estimatedMRR.COP).toBe(180000);
  });

  it("groups by month correctly", async () => {
    const { computeDemoCohorts } = await import("../../scripts/demo/lib/demo-cohorts");
    const report = computeDemoCohorts({ dimension: "month", leads: mockLeads, deals: mockDeals });
    const keys = report.cohorts.map((c) => c.key);
    expect(keys).toContain("2026-08");
    expect(keys).toContain("2026-09");
  });
});

// ─── 3. Health Score Engine ────────────────────────────────────────────────

describe("Demo Health Score Engine", () => {
  it("computes 4-pillar weighted health score", async () => {
    const { calculateDemoHealthScore, HEALTH_WEIGHTS } = await import(
      "../../scripts/demo/lib/demo-health-score"
    );

    // Verify weights sum to 1.0
    const sum =
      HEALTH_WEIGHTS.usage +
      HEALTH_WEIGHTS.intent +
      HEALTH_WEIGHTS.commercial +
      HEALTH_WEIGHTS.time;
    expect(Math.round(sum * 10) / 10).toBe(1.0);

    const result = calculateDemoHealthScore("tenant-test", {
      events: [
        { tenant_id: "tenant-test", event_name: "first_login", created_at: new Date().toISOString() },
        { tenant_id: "tenant-test", event_name: "inbox_viewed", created_at: new Date().toISOString() },
        { tenant_id: "tenant-test", event_name: "agenda_viewed", created_at: new Date().toISOString() },
        { tenant_id: "tenant-test", event_name: "google_connected", created_at: new Date().toISOString() },
      ],
      leadStatus: "meeting_booked",
      lastActivity: new Date().toISOString(),
    });

    expect(result.healthScore).toBeGreaterThanOrEqual(60);
    expect(["low", "medium"]).toContain(result.riskLevel);
    expect(result.breakdown.usage).toBe(100);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("classifies critical risk for inactive leads", async () => {
    const { calculateDemoHealthScore } = await import(
      "../../scripts/demo/lib/demo-health-score"
    );
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateDemoHealthScore("tenant-inactive", {
      events: [],
      leadStatus: "demo_created",
      lastActivity: sixDaysAgo,
    });
    expect(result.healthScore).toBeLessThan(30);
    expect(["high", "critical"]).toContain(result.riskLevel);
  });
});

// ─── 4. CRM Integration Framework ──────────────────────────────────────────

describe("CRM Integrations (HubSpot, Pipedrive, Salesforce)", () => {
  it("all adapters run fail-silent and return simulation IDs without API keys", async () => {
    const { syncToHubSpot } = await import("../../scripts/demo/integrations/hubspot");
    const { syncToPipedrive } = await import("../../scripts/demo/integrations/pipedrive");
    const { syncToSalesforce } = await import("../../scripts/demo/integrations/salesforce");

    const payload = {
      tenantId: "t-crm",
      eventType: "lead_created" as const,
      lead: { name: "Dr. Gomez", email: "gomez@test.co", company: "Clinica Gomez" },
      timestamp: new Date().toISOString(),
    };

    const hs = await syncToHubSpot(payload);
    expect(hs.success).toBe(true);
    expect(hs.provider).toBe("hubspot");

    const pd = await syncToPipedrive(payload);
    expect(pd.success).toBe(true);
    expect(pd.provider).toBe("pipedrive");

    const sf = await syncToSalesforce(payload);
    expect(sf.success).toBe(true);
    expect(sf.provider).toBe("salesforce");
  });

  it("dispatcher broadcasts to all 3 providers and persists audit file", async () => {
    const { dispatchCRMIntegration } = await import("../../scripts/demo/integrations");
    const auditFile = tmp("crm_audit.json");

    const results = await dispatchCRMIntegration(
      {
        tenantId: "t-broadcast",
        eventType: "meeting_booked",
        lead: { name: "Dr. Laura", email: "laura@bogota.demo", company: "Sonrisa" },
        timestamp: new Date().toISOString(),
      },
      { customAuditFile: auditFile },
    );

    expect(results.hubspot.success).toBe(true);
    expect(results.pipedrive.success).toBe(true);
    expect(results.salesforce.success).toBe(true);
    expect(fs.existsSync(auditFile)).toBe(true);
  });
});

// ─── 5. Attribution Engine ─────────────────────────────────────────────────

describe("Demo Attribution Engine", () => {
  it("records attribution and computes channel revenue", async () => {
    const {
      recordDemoAttribution,
      updateAttributionRevenue,
      getAttributionSummary,
    } = await import("../../scripts/demo/lib/demo-attribution");

    const file = tmp("attribution.json");
    recordDemoAttribution(
      {
        tenantId: "t1",
        campaign: "google_search_colombia",
        source: "google",
        vertical: "dental",
        country: "CO",
        revenue: 0,
        currency: "COP",
      },
      file,
    );

    updateAttributionRevenue("t1", 360000, "COP", file);

    const summary = getAttributionSummary(file);
    expect(summary.totalAttributions).toBe(1);
    expect(summary.totalRevenue.COP).toBe(360000);
    expect(summary.bySource.google?.revenue).toBe(360000);
    expect(summary.byCountry.CO?.count).toBe(1);
  });
});

// ─── 6. Experiment Framework ───────────────────────────────────────────────

describe("Demo Experiment Framework", () => {
  it("assigns variants deterministically and tracks conversions", async () => {
    const {
      createExperiment,
      assignExperimentVariant,
      recordExperimentConversion,
      getExperimentResults,
    } = await import("../../scripts/demo/lib/demo-experiments");

    const file = tmp("experiments.json");
    createExperiment(
      {
        id: "exp_hero_cta",
        name: "Test CTA Hero",
        variants: [
          { id: "a", name: "Versión A", weight: 50 },
          { id: "b", name: "Versión B", weight: 50 },
        ],
      },
      file,
    );

    // Same visitor gets same variant consistently
    const v1 = assignExperimentVariant("exp_hero_cta", "visitor_123", file);
    const v2 = assignExperimentVariant("exp_hero_cta", "visitor_123", file);
    expect(v1?.id).toBe(v2?.id);

    // Record conversion
    recordExperimentConversion("exp_hero_cta", v1!.id, file);

    const report = getExperimentResults("exp_hero_cta", file);
    expect(report?.totalImpressions).toBeGreaterThanOrEqual(2);
    expect(report?.totalConversions).toBe(1);
    expect(report?.leadingVariantId).toBe(v1!.id);
  });
});
