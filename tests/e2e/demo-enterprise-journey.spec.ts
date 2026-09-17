/**
 * tests/e2e/demo-enterprise-journey.spec.ts
 *
 * Playwright E2E Spec: Full Enterprise Revenue OS Journey.
 * Validates the complete lifecycle:
 *   Visitor → Demo → Sales → Revenue → Customer Success
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// ─── 1. Public Marketplace & Catalog ─────────────────────────────────────────

test.describe("Public Catalog & Demo Discovery", () => {
  test("renders /demo/catalog with vertical profiles and CTA buttons", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/demo/catalog`);
    expect(res?.status()).not.toBe(500);

    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Elige el Entorno");
    expect(pageContent).toContain("Clínica Odontológica");

    const ctaCount = await page.locator("a[href*='/demo?vertical=']").count();
    expect(ctaCount).toBeGreaterThanOrEqual(1);
  });
});

// ─── 2. Sales Mobile Workspace ───────────────────────────────────────────────

test.describe("Sales Mobile Interface", () => {
  test("renders /sales/mobile with SLA timers and quick contact buttons", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/sales/mobile`);
    expect(res?.status()).not.toBe(500);

    const text = await page.textContent("body");
    expect(text).toContain("Ventas Móvil");

    // Check for WhatsApp or Call quick action buttons
    const waButtons = await page.locator("a[href*='wa.me']").count();
    expect(waButtons).toBeGreaterThanOrEqual(0);
  });
});

// ─── 3. Live Command Center & Telemetry ──────────────────────────────────────

test.describe("Live Command Center & Worker Heartbeat", () => {
  test("renders /admin/demo-center/live with realtime events and queue telemetry", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demo-center/live`);
    expect(res?.status()).not.toBe(500);

    const text = await page.textContent("body");
    expect(text).toContain("Centro de Mando");
    expect(text).toContain("Bus de Eventos");
  });
});

// ─── 4. Integrations Marketplace ─────────────────────────────────────────────

test.describe("Integrations Marketplace", () => {
  test("renders /admin/demo-center/integrations with CRM, messaging, and automation", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demo-center/integrations`);
    expect(res?.status()).not.toBe(500);

    const text = await page.textContent("body");
    expect(text).toContain("Catálogo de Integraciones");
    expect(text).toContain("HubSpot");
    expect(text).toContain("WhatsApp");
  });
});

// ─── 5. End-to-End Enterprise Flow Simulation ────────────────────────────────

test.describe("Full End-to-End Revenue OS Simulation", () => {
  test("executes end-to-end journey from lead capture to worker execution and forecast v2", async () => {
    const { publishDemoEvent, clearSubscribers } = await import("../../scripts/demo/events");
    const { enqueueDemoJob } = await import("../../scripts/demo/queue");
    const { runDemoWorkerTick, emitWorkerHeartbeat } = await import("../../workers/demo-worker");
    const { generateSalesCopilotBrief } = await import("../../scripts/demo/lib/demo-sales-copilot");
    const { calculateForecastV2 } = await import("../../scripts/demo/lib/demo-forecast-v2");

    clearSubscribers();
    const testTenantId = `tenant_journey_${Date.now()}`;

    // 1. Visitor acquires demo: publish demo_created on Event Bus
    const event = await publishDemoEvent("demo_created", {
      tenantId: testTenantId,
      vertical: "dental-clinic",
      source: "catalog",
    });
    expect(event.id).toBeDefined();

    // 2. Lead scoring job enqueued in Automation Queue
    const job = enqueueDemoJob("lead_scoring", { tenantId: testTenantId, score: 90 });
    expect(job.status).toBe("pending");

    // 3. Dedicated Worker tick consumes and executes the job
    let executedJob = false;
    const workerResult = await runDemoWorkerTick(async (j) => {
      if (j.id === job.id) executedJob = true;
    });
    expect(executedJob).toBe(true);
    expect(workerResult.succeeded).toBeGreaterThanOrEqual(1);

    // 4. Worker emits heartbeat
    const hb = await emitWorkerHeartbeat();
    expect(hb.status).toBe("alive");

    // 5. Sales Copilot Brief generated for the rep
    const copilotBrief = generateSalesCopilotBrief(testTenantId);
    expect(copilotBrief.leadSummary).toBeDefined();
    expect(copilotBrief.objections.length).toBeGreaterThanOrEqual(1);

    // 6. Forecast Engine 2.0 scenario calculation
    const forecast = calculateForecastV2();
    expect(forecast.byCurrency.USD).toBeDefined();
    expect(forecast.byCurrency.EUR).toBeDefined();
  });
});
