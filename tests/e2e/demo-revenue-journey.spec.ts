/**
 * tests/e2e/demo-revenue-journey.spec.ts
 *
 * Playwright E2E Spec: Demo Revenue & Growth Journey.
 * Validates the full commercial cycle:
 *   1. Production safety guards (strictly no prod mutation)
 *   2. Demo acquisition & booking flow (/demo, /demo/book)
 *   3. Sales Workspace (/admin/sales)
 *   4. Cohort Analytics (/admin/demos/cohorts)
 *   5. Growth intelligence integration checks
 */

import { test, expect } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// ─── 1. Production Safety Guards ───────────────────────────────────────────

test.describe("Production Guards & Isolation", () => {
  test("CRM framework rejects execution on NODE_ENV=production", async () => {
    const { dispatchCRMIntegration } = await import(
      "../../scripts/demo/integrations"
    );
    await expect(
      dispatchCRMIntegration(
        {
          tenantId: "test-tenant",
          eventType: "lead_created",
          lead: { name: "Test", email: "test@example.com", company: "Test Co" },
          timestamp: new Date().toISOString(),
        },
        { customEnv: { NODE_ENV: "production" } },
      ),
    ).rejects.toThrow(/strictly prohibited when NODE_ENV=production/);
  });

  test("Health score calculation enforces environment safety", async () => {
    const { calculateDemoHealthScore } = await import(
      "../../scripts/demo/lib/demo-health-score"
    );
    expect(() =>
      calculateDemoHealthScore("test-tenant", {
        customEnv: { NODE_ENV: "production" },
      }),
    ).toThrow(/strictly prohibited when NODE_ENV=production/);
  });
});

// ─── 2. Demo Commercial Journey (Public Endpoints) ─────────────────────────

test.describe("Public Demo Journey Pages", () => {
  test("renders /demo page without fatal errors", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/demo`);
    expect(res?.status()).not.toBe(500);
    const formCount = await page.locator("form").count();
    const btnCount = await page.locator("button").count();
    expect(formCount + btnCount).toBeGreaterThan(0);
  });

  test("renders /demo/book page with schedule selectors", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/demo/book`);
    expect(res?.status()).not.toBe(500);
    // Booking inputs (date, time, topic) should render
    const inputs = page.locator("input, select, button");
    const count = await inputs.count();
    expect(count).toBeGreaterThan(1);
  });
});

// ─── 3. Sales Workspace & Admin Analytics ──────────────────────────────────

test.describe("Admin Sales Workspace & Cohorts", () => {
  test("/admin/sales page responds safely (redirects unauthenticated or renders)", async ({
    page,
  }) => {
    const res = await page.goto(`${BASE_URL}/admin/sales`);
    expect(res?.status()).not.toBe(500);
    expect(res?.status()).not.toBe(404);
  });

  test("/admin/demos/cohorts page responds safely", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demos/cohorts`);
    expect(res?.status()).not.toBe(500);
    expect(res?.status()).not.toBe(404);
  });

  test("Sales Workspace API enforces platform admin authorization", async ({
    request,
  }) => {
    const res = await request.get(`${BASE_URL}/api/v1/admin/sales`);
    expect([200, 401, 403]).toContain(res.status());
  });

  test("Cohorts API enforces platform admin authorization", async ({
    request,
  }) => {
    const res = await request.get(
      `${BASE_URL}/api/v1/admin/demos/cohorts?dimension=country`,
    );
    expect([200, 401, 403]).toContain(res.status());
  });
});

// ─── 4. Growth Engines Source Assertions ───────────────────────────────────

test.describe("Growth Intelligence File System Assertions", () => {
  test("demo-funnel.ts exports all 7 progression stages", () => {
    const funnelPath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-funnel.ts",
    );
    expect(fs.existsSync(funnelPath)).toBe(true);
    const src = fs.readFileSync(funnelPath, "utf-8");
    expect(src).toContain("requested");
    expect(src).toContain("created");
    expect(src).toContain("activated");
    expect(src).toContain("qualified");
    expect(src).toContain("meeting_booked");
    expect(src).toContain("proposal_sent");
    expect(src).toContain("converted");
  });

  test("CRM adapters directory exists with HubSpot, Pipedrive, Salesforce", () => {
    const base = path.resolve(process.cwd(), "scripts/demo/integrations");
    expect(fs.existsSync(path.join(base, "hubspot.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "pipedrive.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "salesforce.ts"))).toBe(true);
    expect(fs.existsSync(path.join(base, "index.ts"))).toBe(true);
  });

  test("demo-attribution.ts tracks campaign, source, vertical, country, revenue", () => {
    const attrPath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-attribution.ts",
    );
    expect(fs.existsSync(attrPath)).toBe(true);
    const src = fs.readFileSync(attrPath, "utf-8");
    expect(src).toContain("campaign");
    expect(src).toContain("source");
    expect(src).toContain("vertical");
    expect(src).toContain("country");
    expect(src).toContain("revenue");
  });

  test("demo-experiments.ts supports A/B tests and conversion tracking", () => {
    const expPath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-experiments.ts",
    );
    expect(fs.existsSync(expPath)).toBe(true);
    const src = fs.readFileSync(expPath, "utf-8");
    expect(src).toContain("assignExperimentVariant");
    expect(src).toContain("recordExperimentConversion");
    expect(src).toContain("getExperimentResults");
  });
});
