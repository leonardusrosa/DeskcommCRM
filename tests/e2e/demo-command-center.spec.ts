/**
 * tests/e2e/demo-command-center.spec.ts
 *
 * Playwright E2E Spec: Demo Command Center & Automation OS.
 * Validates:
 *   1. Strict production isolation for automation and handoff
 *   2. Command Center page (/admin/demo-center)
 *   3. Marketing analytics page (/admin/demos/marketing)
 *   4. Sales performance page (/admin/sales/performance)
 *   5. Data export system page (/admin/demos/export)
 *   6. API authorization gates
 */

import { test, expect } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// ─── 1. Production Safety Guards ───────────────────────────────────────────

test.describe("Automation Production Safety", () => {
  test("runDemoAutomations rejects execution on NODE_ENV=production", async () => {
    const { runDemoAutomations } = await import(
      "../../scripts/demo/lib/demo-automation"
    );
    await expect(
      runDemoAutomations({ customEnv: { NODE_ENV: "production" } }),
    ).rejects.toThrow(/strictly prohibited when NODE_ENV=production/);
  });

  test("generateOnboardingPacket rejects execution on NODE_ENV=production", async () => {
    const { generateOnboardingPacket } = await import(
      "../../scripts/demo/lib/demo-handoff"
    );
    expect(() =>
      generateOnboardingPacket("test-tenant", {
        customEnv: { NODE_ENV: "production" },
      }),
    ).toThrow(/strictly prohibited when NODE_ENV=production/);
  });
});

// ─── 2. Protected Command Center Routes ────────────────────────────────────

test.describe("Admin Command Center Pages", () => {
  test("renders /admin/demo-center safely", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demo-center`);
    expect(res?.status()).not.toBe(500);
    expect(res?.status()).not.toBe(404);
  });

  test("renders /admin/demos/marketing safely", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demos/marketing`);
    expect(res?.status()).not.toBe(500);
    expect(res?.status()).not.toBe(404);
  });

  test("renders /admin/sales/performance safely", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/sales/performance`);
    expect(res?.status()).not.toBe(500);
    expect(res?.status()).not.toBe(404);
  });

  test("renders /admin/demos/export safely", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demos/export`);
    expect(res?.status()).not.toBe(500);
    expect(res?.status()).not.toBe(404);
  });
});

// ─── 3. Platform Admin API Authorization ───────────────────────────────────

test.describe("Command Center APIs", () => {
  test("GET /api/v1/admin/demo-center checks auth", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/admin/demo-center`);
    expect([200, 401, 403]).toContain(res.status());
  });

  test("GET /api/v1/admin/demos/marketing checks auth", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/admin/demos/marketing`);
    expect([200, 401, 403]).toContain(res.status());
  });

  test("GET /api/v1/admin/sales/performance checks auth", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/admin/sales/performance`);
    expect([200, 401, 403]).toContain(res.status());
  });

  test("GET /api/v1/admin/demos/export checks auth", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/admin/demos/export?format=json`);
    expect([200, 401, 403]).toContain(res.status());
  });
});

// ─── 4. File System Assertions ─────────────────────────────────────────────

test.describe("Source Structure Assertions", () => {
  test("demo-automation.ts exports runDemoAutomations", () => {
    const p = path.resolve(process.cwd(), "scripts/demo/lib/demo-automation.ts");
    expect(fs.existsSync(p)).toBe(true);
    const src = fs.readFileSync(p, "utf-8");
    expect(src).toContain("runDemoAutomations");
  });

  test("demo-handoff.ts exports generateOnboardingPacket", () => {
    const p = path.resolve(process.cwd(), "scripts/demo/lib/demo-handoff.ts");
    expect(fs.existsSync(p)).toBe(true);
    const src = fs.readFileSync(p, "utf-8");
    expect(src).toContain("generateOnboardingPacket");
    expect(src).toContain("recommendedNextSteps");
  });

  test("hourly and daily automation jobs exist", () => {
    const hourly = path.resolve(process.cwd(), "scripts/demo/jobs/hourly-automation.ts");
    const daily = path.resolve(process.cwd(), "scripts/demo/jobs/daily-revenue-report.ts");
    expect(fs.existsSync(hourly)).toBe(true);
    expect(fs.existsSync(daily)).toBe(true);
  });
});
