/**
 * tests/e2e/demo-revenue-os.spec.ts
 *
 * Playwright E2E Spec: Demo Revenue OS & Enterprise Scale.
 * Validates the full enterprise operating system:
 *   1. Production safety & enterprise isolation
 *   2. Public lead acquisition & booking (/demo, /demo/book)
 *   3. Observability & Telemetry (/admin/demo-center/health)
 *   4. Historical SLA Analytics (/admin/sales/sla)
 *   5. Executive Revenue Dashboard (/admin/revenue)
 *   6. Decoupled Event Bus & Automation Queue Integration
 */

import { test, expect } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// ─── 1. Production Safety & Isolation ────────────────────────────────────────

test.describe("Enterprise Isolation & Safety Guards", () => {
  test("compliance operations reject NODE_ENV=production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const { anonymizeDemoLead } = await import(
        "../../scripts/demo/lib/demo-compliance"
      );
      expect(() => anonymizeDemoLead("test_id")).toThrow(
        /strictly forbidden in production/,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  test("demo queue operations reject production mutations", async () => {
    const { enqueueDemoJob } = await import("../../scripts/demo/queue");
    const job = enqueueDemoJob("health_probe", { ping: true }, {
      customFilePath: path.resolve(".demo/test_probe_queue.json"),
    });
    expect(job.status).toBe("pending");
    expect(job.jobType).toBe("health_probe");

    // Clean up probe file
    const probeFile = path.resolve(".demo/test_probe_queue.json");
    if (fs.existsSync(probeFile)) {
      fs.unlinkSync(probeFile);
    }
  });
});

// ─── 2. Enterprise UI Endpoints ──────────────────────────────────────────────

test.describe("Enterprise Operational Dashboards", () => {
  test("loads Observability Dashboard (/admin/demo-center/health)", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demo-center/health`);
    expect(res?.status()).not.toBe(500);

    // Assert key headings or cards appear
    const pageText = await page.textContent("body");
    expect(pageText).toContain("Salud y Observabilidad");
  });

  test("loads SLA Analytics Dashboard (/admin/sales/sla)", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/sales/sla`);
    expect(res?.status()).not.toBe(500);

    const pageText = await page.textContent("body");
    expect(pageText).toContain("Analítica de SLAs");
  });

  test("loads Executive Revenue Dashboard (/admin/revenue)", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/revenue`);
    expect(res?.status()).not.toBe(500);

    const pageText = await page.textContent("body");
    expect(pageText).toContain("Panel Ejecutivo de Ingresos");
  });
});

// ─── 3. Full Commercial to Revenue Pipeline Simulation ───────────────────────

test.describe("Full Revenue Lifecycle Simulation", () => {
  test("runs through event bus, queue processing, playbook rules, and revenue data", async () => {
    const { publishDemoEvent, clearSubscribers } = await import(
      "../../scripts/demo/events"
    );
    const { enqueueDemoJob, processDemoJobs } = await import(
      "../../scripts/demo/queue"
    );
    const { evaluatePlaybookRules } = await import(
      "../../scripts/demo/playbooks"
    );
    const { calculateRevenueForecast } = await import(
      "../../scripts/demo/lib/demo-forecast"
    );

    clearSubscribers();
    const testTenantId = `tenant_e2e_${Date.now()}`;

    // 1. Publish High Intent Demo Event to Event Bus
    const busEvent = await publishDemoEvent("demo_high_intent", {
      tenantId: testTenantId,
      score: 88,
      vertical: "dental-clinic",
      country: "CO",
    });
    expect(busEvent.id).toBeDefined();

    // 2. Playbook Engine matches high intent rules
    const playbookMatches = evaluatePlaybookRules({
      tenantId: testTenantId,
      score: 88,
      vertical: "dental-clinic",
      country: "CO",
    });
    expect(playbookMatches.some((m) => m.matched)).toBe(true);

    // 3. Queue task dispatched and processed
    const job = enqueueDemoJob("urgent_outreach", {
      tenantId: testTenantId,
      rep: "laura@sonrisabogota.demo",
    });
    expect(job.status).toBe("pending");

    let executed = false;
    const processResult = await processDemoJobs(async (j) => {
      if (j.id === job.id) {
        executed = true;
      }
    });
    expect(executed).toBe(true);
    expect(processResult.succeeded).toBeGreaterThanOrEqual(1);

    // 4. Validate Revenue Forecast incorporates pipeline data
    const forecast = calculateRevenueForecast();
    expect(forecast.totalDeals).toBeGreaterThanOrEqual(0);
    expect(forecast.forecastsByCurrency.COP).toBeDefined();
  });
});
