/**
 * tests/unit/demo-production-hardening.test.ts
 *
 * Unit tests for Demo Revenue OS Production Hardening:
 *   - Dedicated Demo Worker (ticks, heartbeats, status)
 *   - AI Sales Copilot (briefs, objections, meeting prep)
 *   - Forecast Engine 2.0 (conservative, expected, aggressive scenarios)
 *   - Disaster Recovery (atomic backups, SHA-256 checksums, restore validation)
 *   - Marketplace Registries (vertical demo profiles, integration marketplace)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-hardening-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function tmp(name: string) {
  return path.join(tmpDir, name);
}

// ─── 1. Dedicated Demo Worker ────────────────────────────────────────────────

describe("Dedicated Demo Worker (workers/demo-worker)", () => {
  it("initializes state, emits heartbeat, and processes queue ticks", async () => {
    const { runDemoWorkerTick, getWorkerState, emitWorkerHeartbeat } = await import(
      "../../workers/demo-worker"
    );
    const { enqueueDemoJob } = await import("../../scripts/demo/queue");

    const queueFile = tmp("worker_queue.json");
    const hbFile = tmp("worker_hb.json");

    enqueueDemoJob("test_task", { val: 42 }, { customFilePath: queueFile });

    let executed = false;
    const tickResult = await runDemoWorkerTick(
      async (job) => {
        if (job.jobType === "test_task") executed = true;
      },
      { customQueueFile: queueFile, customHeartbeatFile: hbFile },
    );

    expect(executed).toBe(true);
    expect(tickResult.processed).toBe(1);
    expect(tickResult.succeeded).toBe(1);

    const hb = await emitWorkerHeartbeat({ customFilePath: hbFile });
    expect(hb.status).toBe("alive");
    expect(hb.jobsProcessed).toBeGreaterThanOrEqual(1);

    const state = getWorkerState(hbFile);
    expect(state).not.toBeNull();
    expect(state?.workerId).toBeDefined();
  });
});

// ─── 2. AI Sales Copilot ─────────────────────────────────────────────────────

describe("AI Sales Copilot (scripts/demo/lib/demo-sales-copilot)", () => {
  it("generates structured sales intelligence brief with tailored objections", async () => {
    const { generateSalesCopilotBrief } = await import(
      "../../scripts/demo/lib/demo-sales-copilot"
    );

    const brief = generateSalesCopilotBrief("lead_dental_test");

    expect(brief.leadId).toBeDefined();
    expect(brief.leadSummary.length).toBeGreaterThan(20);
    expect(brief.nextAction.title.length).toBeGreaterThan(5);
    expect(["whatsapp", "email", "call"]).toContain(brief.nextAction.recommendedChannel);
    expect(brief.objections.length).toBeGreaterThanOrEqual(2);
    expect(brief.objections[0]!.counterArgument.length).toBeGreaterThan(15);
    expect(brief.meetingPreparation.recommendedDemoFeatures.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 3. Forecast Engine 2.0 ──────────────────────────────────────────────────

describe("Forecast Engine 2.0 (scripts/demo/lib/demo-forecast-v2)", () => {
  it("projects conservative, expected, and aggressive revenue scenarios", async () => {
    const { calculateForecastV2 } = await import(
      "../../scripts/demo/lib/demo-forecast-v2"
    );

    const testDeals = [
      {
        id: "d1",
        leadId: "l1",
        tenantId: "t1",
        plan: "professional" as const,
        value: 1000,
        currency: "USD" as const,
        status: "negotiation" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "d2",
        leadId: "l2",
        tenantId: "t2",
        plan: "enterprise" as const,
        value: 2000,
        currency: "USD" as const,
        status: "closed_won" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const report = calculateForecastV2({ deals: testDeals });

    expect(report.totalDeals).toBe(2);
    expect(report.wonDealsCount).toBe(1);
    expect(report.openDealsCount).toBe(1);

    const usd = report.byCurrency.USD;
    expect(usd.expected.wonMRR).toBe(2000);
    // Conservative weighted <= Expected weighted <= Aggressive weighted
    expect(usd.conservative.weightedPipelineMRR).toBeLessThanOrEqual(usd.expected.weightedPipelineMRR);
    expect(usd.expected.weightedPipelineMRR).toBeLessThanOrEqual(usd.aggressive.weightedPipelineMRR);
    expect(usd.aggressive.arrForecast).toBeGreaterThan(usd.conservative.arrForecast);
  });
});

// ─── 4. Disaster Recovery ────────────────────────────────────────────────────

describe("Disaster Recovery Engine (scripts/demo/lib/demo-disaster-recovery)", () => {
  it("creates atomic backup with SHA-256 checksum and verifies integrity on restore", async () => {
    const { createDemoBackup, restoreDemoBackup } = await import(
      "../../scripts/demo/lib/demo-disaster-recovery"
    );

    const demoDir = tmp("demo_source");
    const backupsDir = tmp("demo_backups");
    fs.mkdirSync(demoDir, { recursive: true });

    // Seed test files
    fs.writeFileSync(path.join(demoDir, "test_file_a.json"), JSON.stringify([{ id: 1, name: "Alpha" }]));
    fs.writeFileSync(path.join(demoDir, "test_file_b.json"), JSON.stringify({ config: "active" }));

    const backup = createDemoBackup({ demoDir, backupsDir });
    expect(backup.backupId).toBeDefined();
    expect(backup.fileCount).toBe(2);
    expect(backup.masterChecksum.length).toBe(64); // SHA-256 hex length

    // Empty demoDir to test restore
    fs.rmSync(path.join(demoDir, "test_file_a.json"));

    const restore = restoreDemoBackup(backup.backupId, { demoDir, backupsDir });
    expect(restore.success).toBe(true);
    expect(restore.verifiedChecksum).toBe(true);
    expect(fs.existsSync(path.join(demoDir, "test_file_a.json"))).toBe(true);
  });
});

// ─── 5. Marketplace Registries ───────────────────────────────────────────────

describe("Marketplace Registries (Demo Catalog & Integrations)", () => {
  it("lists vertical demo catalog profiles", async () => {
    const { listDemoCatalogProfiles } = await import(
      "../../scripts/demo/lib/demo-catalog"
    );
    const profiles = listDemoCatalogProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(3);
    expect(profiles.some((p) => p.vertical === "dental-clinic")).toBe(true);
  });

  it("lists and filters integrations by category", async () => {
    const { listMarketplaceIntegrations } = await import(
      "../../scripts/demo/integrations/marketplace"
    );
    const all = listMarketplaceIntegrations();
    expect(all.length).toBeGreaterThanOrEqual(5);

    const crms = listMarketplaceIntegrations("crm");
    expect(crms.every((c) => c.category === "crm")).toBe(true);
    expect(crms.some((c) => c.id === "hubspot")).toBe(true);
  });
});
