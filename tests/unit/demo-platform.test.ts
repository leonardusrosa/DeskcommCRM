/**
 * tests/unit/demo-platform.test.ts
 *
 * Unit tests for Demo Platform Operations & Scale Layer:
 *   - demo-registry.ts
 *   - demo-sales-assignments.ts
 *   - demo-sla.ts
 *   - demo-alerts.ts
 *   - demo-forecast.ts
 *   - demo-partners.ts
 *   - demo-audit.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import type { SalesRep } from "../../scripts/demo/lib/demo-sales-assignments";
import type { DemoDeal } from "../../scripts/demo/lib/demo-deals";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-platform-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function tmp(name: string) {
  return path.join(tmpDir, name);
}

// ─── 1. Demo Registry ──────────────────────────────────────────────────────

describe("Demo Registry", () => {
  it("registers demo and lists active demos", async () => {
    const { registerDemo, listActiveDemos } = await import(
      "../../scripts/demo/lib/demo-registry"
    );
    const file = tmp("registry.json");
    registerDemo(
      { tenantId: "t1", name: "Clinica Bogota", ownerEmail: "laura@bogota.co" },
      file,
    );

    const active = listActiveDemos(file);
    expect(active).toHaveLength(1);
    expect(active[0]?.tenantId).toBe("t1");
    expect(active[0]?.status).toBe("active");
  });

  it("archives demo with reason", async () => {
    const { registerDemo, archiveDemo, listActiveDemos } = await import(
      "../../scripts/demo/lib/demo-registry"
    );
    const file = tmp("registry_arch.json");
    registerDemo({ tenantId: "t2", name: "Clinica 2", ownerEmail: "c2@d.co" }, file);
    archiveDemo("t2", "Closed won migration", file);

    const active = listActiveDemos(file);
    expect(active).toHaveLength(0);
  });

  it("transfers ownership and keeps audit trail", async () => {
    const { registerDemo, transferDemoOwnership, listAllRegistryDemos } = await import(
      "../../scripts/demo/lib/demo-registry"
    );
    const file = tmp("registry_transfer.json");
    registerDemo({ tenantId: "t3", name: "Clinica 3", ownerEmail: "old@d.co" }, file);

    transferDemoOwnership("t3", "new@d.co", {
      transferredBy: "admin@deskcomm.io",
      reason: "Territory reassignment",
      customFilePath: file,
    });

    const all = listAllRegistryDemos(file);
    expect(all[0]?.ownerEmail).toBe("new@d.co");
    expect(all[0]?.transferHistory).toHaveLength(1);
    expect(all[0]?.transferHistory[0]?.previousOwner).toBe("old@d.co");
  });
});

// ─── 2. Sales Assignments & Round Robin ────────────────────────────────────

describe("Sales Assignments", () => {
  const reps: SalesRep[] = [
    { id: "rep1", name: "Ana", email: "ana@deskcomm.io" },
    { id: "rep2", name: "Carlos", email: "carlos@deskcomm.io" },
  ];

  it("distributes leads round-robin based on workload", async () => {
    const { distributeRoundRobin, getLeadAssignment } = await import(
      "../../scripts/demo/lib/demo-sales-assignments"
    );
    const file = tmp("assignments.json");

    // First lead -> should assign to rep1 (both have 0 load)
    const a1 = distributeRoundRobin("t1", reps, { customFilePath: file });
    // Second lead -> rep2 now has lower load (0 vs 1)
    const a2 = distributeRoundRobin("t2", reps, { customFilePath: file });

    expect(a1.repId).toBe("rep1");
    expect(a2.repId).toBe("rep2");

    const match = getLeadAssignment("t1", file);
    expect(match?.repEmail).toBe("ana@deskcomm.io");
  });

  it("reassigns lead and records previous rep", async () => {
    const { assignLeadToRep, reassignLead, getLeadAssignment } = await import(
      "../../scripts/demo/lib/demo-sales-assignments"
    );
    const file = tmp("reassign.json");
    assignLeadToRep("t3", reps[0]!, { customFilePath: file });
    reassignLead("t3", reps[1]!, "Vacation coverage", { customFilePath: file });

    const current = getLeadAssignment("t3", file);
    expect(current?.repEmail).toBe("carlos@deskcomm.io");
    expect(current?.previousRepEmail).toBe("ana@deskcomm.io");
  });
});

// ─── 3. SLA Engine ─────────────────────────────────────────────────────────

describe("SLA Engine", () => {
  it("calculates due and warning timestamps correctly", async () => {
    const { createSLATimer, evaluateSLATimer } = await import(
      "../../scripts/demo/lib/demo-sla"
    );
    const file = tmp("sla.json");
    const timer = createSLATimer("t1", "initial_contact", 2, { customFilePath: file });

    expect(timer.status).toBe("on_track");
    expect(new Date(timer.dueAt).getTime()).toBeGreaterThan(Date.now());

    // Evaluated right now -> on_track
    const evalNow = evaluateSLATimer(timer, new Date());
    expect(evalNow.status).toBe("on_track");
  });

  it("detects breach when time has passed and escalates", async () => {
    const { createSLATimer, checkAndEscalateSLAs } = await import(
      "../../scripts/demo/lib/demo-sla"
    );
    const file = tmp("sla_breach.json");
    createSLATimer("t2", "demo_activation", 1, { customFilePath: file });

    // Simulate time 2 hours in future (breached)
    const future = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const result = checkAndEscalateSLAs({ customFilePath: file, now: future });

    expect(result.breachesCount).toBe(1);
    expect(result.escalatedTimers).toHaveLength(1);
    expect(result.escalatedTimers[0]?.status).toBe("breached");
    expect(result.escalatedTimers[0]?.escalatedAt).toBeDefined();
  });
});

// ─── 4. Alert Engine ───────────────────────────────────────────────────────

describe("Alert Engine", () => {
  it("dispatches alert with fail-silent resilience and audits send", async () => {
    const { sendDemoAlert, listDemoAlerts } = await import(
      "../../scripts/demo/lib/demo-alerts"
    );
    const file = tmp("alerts.json");

    const alert = await sendDemoAlert(
      {
        tenantId: "t1",
        channel: "slack",
        severity: "critical",
        title: "SLA Breached",
        message: "Demo t1 has breached 2h SLA",
        recipient: "https://hooks.slack.com/services/test",
      },
      { customFilePath: file },
    );

    // Without active network hook, resolves fail-silently (failed or skipped, never throws)
    expect(["sent", "failed", "skipped"]).toContain(alert.status);

    const all = listDemoAlerts("t1", file);
    expect(all).toHaveLength(1);
    expect(all[0]?.title).toBe("SLA Breached");
  });
});

// ─── 5. Revenue Forecast ───────────────────────────────────────────────────

describe("Revenue Forecast Engine", () => {
  const mockDeals: DemoDeal[] = [
    { id: "1", leadId: "l1", tenantId: "t1", plan: "starter", value: 1000, currency: "USD", status: "prospecting", createdAt: "d", updatedAt: "d" }, // prob 0.1 -> 100
    { id: "2", leadId: "l2", tenantId: "t2", plan: "professional", value: 2000, currency: "USD", status: "proposal", createdAt: "d", updatedAt: "d" }, // prob 0.6 -> 1200
    { id: "3", leadId: "l3", tenantId: "t3", plan: "enterprise", value: 3000, currency: "USD", status: "closed_won", createdAt: "d", updatedAt: "d" }, // won MRR = 3000
  ];

  it("calculates pipeline value, weighted revenue, and ARR forecast", async () => {
    const { calculateRevenueForecast } = await import(
      "../../scripts/demo/lib/demo-forecast"
    );
    const report = calculateRevenueForecast({ deals: mockDeals });

    expect(report.totalDeals).toBe(3);
    expect(report.wonDealsCount).toBe(1);
    expect(report.openDealsCount).toBe(2);

    const usd = report.forecastsByCurrency.USD;
    expect(usd.pipelineValue).toBe(3000); // 1000 + 2000
    expect(usd.wonMRR).toBe(3000);
    expect(usd.weightedRevenue).toBe(1300); // 100 + 1200
    // ARR: (3000 * 12) + (1300 * 12) = 36000 + 15600 = 51600
    expect(usd.arrForecast).toBe(51600);
  });
});

// ─── 6. Partner Mode ───────────────────────────────────────────────────────

describe("Partner Mode", () => {
  it("registers partner, attributes demo, and calculates commission", async () => {
    const {
      registerPartner,
      attributePartnerDemo,
      recordPartnerDealWon,
      getPartnerSummary,
    } = await import("../../scripts/demo/lib/demo-partners");
    const file = tmp("partners.json");

    registerPartner(
      {
        partnerCode: "AGENCY-CO",
        name: "Agencia Bogota",
        agencyName: "Growth Med",
        email: "contact@growthmed.co",
        commissionRatePercentage: 25, // 25%
      },
      file,
    );

    const attr = attributePartnerDemo("t1", "AGENCY-CO", {
      dealValue: 2000,
      currency: "USD",
      customFilePath: file,
    });
    expect(attr?.commissionRatePercentage).toBe(25);

    // Deal closed won
    recordPartnerDealWon("t1", 2000, "USD", file);

    const summary = getPartnerSummary("AGENCY-CO", file);
    expect(summary?.totalWonDeals).toBe(1);
    expect(summary?.totalGrossRevenue.USD).toBe(2000);
    expect(summary?.totalCommissionsEarned.USD).toBe(500); // 25% of 2000
  });
});

// ─── 7. Audit Layer ────────────────────────────────────────────────────────

describe("Audit Layer", () => {
  it("records and queries platform audit events", async () => {
    const {
      recordDemoAudit,
      listDemoAuditEvents,
      getDemoAuditSummary,
    } = await import("../../scripts/demo/lib/demo-audit");
    const file = tmp("audit.json");

    recordDemoAudit(
      {
        tenantId: "t1",
        actionType: "ownership_change",
        description: "Transferred to new sales rep",
        before: { owner: "old@d.co" },
        after: { owner: "new@d.co" },
      },
      file,
    );

    recordDemoAudit(
      {
        tenantId: "t1",
        actionType: "commercial_action",
        description: "Sent enterprise proposal",
      },
      file,
    );

    const events = listDemoAuditEvents({ tenantId: "t1" }, file);
    expect(events).toHaveLength(2);

    const summary = getDemoAuditSummary(file);
    expect(summary.total).toBe(2);
    expect(summary.byActionType.ownership_change).toBe(1);
    expect(summary.byActionType.commercial_action).toBe(1);
  });
});
