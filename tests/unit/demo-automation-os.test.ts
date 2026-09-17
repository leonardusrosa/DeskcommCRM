/**
 * tests/unit/demo-automation-os.test.ts
 *
 * Unit tests for Demo Command Center & Automation OS:
 *   - demo-automation.ts (runDemoAutomations & idempotency)
 *   - demo-handoff.ts (generateOnboardingPacket)
 *   - demo-forecast.ts & scheduled jobs logic
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-auto-os-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function tmp(name: string) {
  return path.join(tmpDir, name);
}

// ─── 1. Automation Runner & Idempotency ─────────────────────────────────────

describe("Automation Runner (runDemoAutomations)", () => {
  it("runs automations and returns structured report", async () => {
    const { runDemoAutomations } = await import(
      "../../scripts/demo/lib/demo-automation"
    );

    const report = await runDemoAutomations({ dryRun: true });
    expect(report.executedAt).toBeDefined();
    expect(report.slasEvaluated).toBeGreaterThanOrEqual(0);
    expect(report.slaBreaches).toBeGreaterThanOrEqual(0);
    expect(typeof report.followupsQueued).toBe("number");
  });

  it("is idempotent on repeated runs", async () => {
    const { runDemoAutomations } = await import(
      "../../scripts/demo/lib/demo-automation"
    );

    const firstRun = await runDemoAutomations({ dryRun: true });
    expect(firstRun.executedAt).toBeDefined();
    const secondRun = await runDemoAutomations({ dryRun: true });

    // In an idempotent run immediately after, newly queued expiring/inactivity items should be 0
    expect(secondRun.expiringHandled).toBe(0);
    expect(secondRun.inactivityHandled).toBe(0);
  });

  it("enforces production safety isolation", async () => {
    const { runDemoAutomations } = await import(
      "../../scripts/demo/lib/demo-automation"
    );
    await expect(
      runDemoAutomations({ customEnv: { NODE_ENV: "production" } }),
    ).rejects.toThrow(/strictly prohibited when NODE_ENV=production/);
  });
});

// ─── 2. Customer Success Handoff ───────────────────────────────────────────

describe("Customer Success Handoff (generateOnboardingPacket)", () => {
  it("generates complete onboarding packet with all required steps", async () => {
    const { generateOnboardingPacket, getOnboardingPacket } = await import(
      "../../scripts/demo/lib/demo-handoff"
    );
    const file = tmp("handoffs.json");

    const packet = generateOnboardingPacket("t-won-1", {
      customFilePath: file,
    });

    expect(packet.tenantId).toBe("t-won-1");
    expect(packet.company).toBeDefined();
    expect(packet.plan).toBeDefined();
    expect(packet.recommendedNextSteps.length).toBeGreaterThanOrEqual(3);
    expect(packet.accountSummary).toBeDefined();

    const retrieved = getOnboardingPacket("t-won-1", file);
    expect(retrieved?.id).toBe(packet.id);
  });

  it("enforces production safety isolation", async () => {
    const { generateOnboardingPacket } = await import(
      "../../scripts/demo/lib/demo-handoff"
    );
    expect(() =>
      generateOnboardingPacket("t-prod", {
        customEnv: { NODE_ENV: "production" },
      }),
    ).toThrow(/strictly prohibited when NODE_ENV=production/);
  });
});

// ─── 3. Revenue Forecast & Scheduled Reports ───────────────────────────────

describe("Scheduled Reports Logic", () => {
  it("calculates ARR accurately for multi-currency operations", async () => {
    const { calculateRevenueForecast } = await import(
      "../../scripts/demo/lib/demo-forecast"
    );

    const report = calculateRevenueForecast({
      deals: [
        { id: "1", leadId: "l1", tenantId: "t1", plan: "starter", value: 1000, currency: "BRL", status: "closed_won", createdAt: "d", updatedAt: "d" },
        { id: "2", leadId: "l2", tenantId: "t2", plan: "pro", value: 2000, currency: "BRL", status: "negotiation", createdAt: "d", updatedAt: "d" }, // prob 0.8 -> 1600
      ],
    });

    const brl = report.forecastsByCurrency.BRL;
    expect(brl.wonMRR).toBe(1000);
    expect(brl.weightedRevenue).toBe(1600);
    // ARR: (1000 * 12) + (1600 * 12) = 12000 + 19200 = 31200
    expect(brl.arrForecast).toBe(31200);
  });
});

// ─── 4. Audit Trail on Exports ─────────────────────────────────────────────

describe("Export System Audit", () => {
  it("records audit event for system exports", async () => {
    const { recordDemoAudit, listDemoAuditEvents } = await import(
      "../../scripts/demo/lib/demo-audit"
    );
    const file = tmp("export_audit.json");

    recordDemoAudit(
      {
        tenantId: "system_export",
        actionType: "export",
        actorEmail: "admin@deskcomm.io",
        description: "Exported 15 demo records as CSV",
        metadata: { format: "csv", count: 15 },
      },
      file,
    );

    const events = listDemoAuditEvents({ actionType: "export" }, file);
    expect(events).toHaveLength(1);
    expect(events[0]?.description).toContain("CSV");
  });
});
