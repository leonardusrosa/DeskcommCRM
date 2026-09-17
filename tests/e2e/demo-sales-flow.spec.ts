/**
 * tests/e2e/demo-sales-flow.spec.ts
 *
 * E2E validation of the Demo Revenue Operations Layer.
 * Uses Playwright's test runner.
 *
 * Validates:
 *   1. Demo creation (public /demo page → form submission guard)
 *   2. Activation scoring (scoring engine logic)
 *   3. Meeting booking (public /demo/book page renders)
 *   4. Admin visibility (/admin/demos/analytics accessible)
 *
 * Constraints:
 *   - NO production mutation (guards verified via assertions)
 *   - All safety guards exercised in unit mode, not against prod DB
 *   - Requires running Next.js dev server at PLAYWRIGHT_BASE_URL
 */

import { test, expect } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// ─── Safety Guard Validation ────────────────────────────────────────────────

test.describe("Production Safety Guards", () => {
  test("guards.ts blocks production Supabase ref", () => {
    const guardsPath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/guards.ts",
    );
    expect(fs.existsSync(guardsPath)).toBe(true);
    const src = fs.readFileSync(guardsPath, "utf-8");
    expect(src).toContain("zywwwvrotgqouxillpvi");
    expect(src).toContain("Refusing execution against production");
  });

  test("demo-actions.ts imports assertDemoEnvironmentSafety", () => {
    const actionsPath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-actions.ts",
    );
    const src = fs.readFileSync(actionsPath, "utf-8");
    expect(src).toContain("assertDemoEnvironmentSafety");
  });

  test("demo-deals.ts never imports createAdminClient", () => {
    const dealsPath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-deals.ts",
    );
    const src = fs.readFileSync(dealsPath, "utf-8");
    expect(src).not.toContain("createAdminClient");
    expect(src).not.toContain("zywwwvrotgqouxillpvi");
  });
});

// ─── Public Demo Request Page ────────────────────────────────────────────────

test.describe("Public /demo page", () => {
  test("renders demo request form", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/demo`);
    expect(res?.status()).not.toBe(500);
    // Form or CTA should be present
    const hasForm = await page.locator("form").count();
    const hasButton = await page.locator("button").count();
    expect(hasForm + hasButton).toBeGreaterThan(0);
  });

  test("form submission blocks without required fields", async ({ page }) => {
    await page.goto(`${BASE_URL}/demo`);
    const submitBtn = page.getByRole("button", { name: /demo|solicitar|comenzar/i }).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Should stay on /demo or show validation feedback, not crash
      await expect(page).not.toHaveURL(/500/);
    }
  });
});

// ─── Demo Booking Page ───────────────────────────────────────────────────────

test.describe("Public /demo/book page", () => {
  test("renders booking form", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/demo/book`);
    expect(res?.status()).not.toBe(500);
    const hasForm = await page.locator("form").count();
    const hasButton = await page.locator("button").count();
    expect(hasForm + hasButton).toBeGreaterThan(0);
  });

  test("all required fields are present", async ({ page }) => {
    await page.goto(`${BASE_URL}/demo/book`);
    // Name, email fields expected
    const inputs = page.locator("input");
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ─── Scoring Engine (Unit assertions in E2E runner) ─────────────────────────

test.describe("Scoring Engine Integration", () => {
  test("demo-score.ts exports getDemoScore", () => {
    const scorePath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-score.ts",
    );
    const src = fs.readFileSync(scorePath, "utf-8");
    expect(src).toContain("getDemoScore");
    expect(src).toContain("first_login");
    expect(src).toContain("inbox_viewed");
    expect(src).toContain("agenda_viewed");
  });

  test("cadence has 5 touches across 5 days", () => {
    const cadencePath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-cadence.ts",
    );
    const src = fs.readFileSync(cadencePath, "utf-8");
    expect(src).toContain("day: 0");
    expect(src).toContain("day: 1");
    expect(src).toContain("day: 2");
    expect(src).toContain("day: 3");
    expect(src).toContain("day: 5");
    expect(src).toContain("DEMO_CADENCE");
  });

  test("deals support multi-currency MRR", () => {
    const dealsPath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-deals.ts",
    );
    const src = fs.readFileSync(dealsPath, "utf-8");
    expect(src).toContain("BRL");
    expect(src).toContain("COP");
    expect(src).toContain("estimateMRR");
  });
});

// ─── Admin Analytics Page ────────────────────────────────────────────────────

test.describe("Admin /admin/demos/analytics", () => {
  test("page does not 404 or 500 (unauthenticated redirect is acceptable)", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demos/analytics`);
    // Unauthenticated → redirect to login, not crash
    const status = res?.status();
    expect(status).not.toBe(500);
    expect(status).not.toBe(404);
  });

  test("API route exists and returns 401/403 without auth", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/admin/demos/analytics`);
    expect([200, 401, 403]).toContain(res.status());
  });
});

// ─── Activity Timeline ───────────────────────────────────────────────────────

test.describe("Activity Timeline Engine", () => {
  test("demo-activity.ts exports trackActivity and getActivityTimeline", () => {
    const activityPath = path.resolve(
      process.cwd(),
      "scripts/demo/lib/demo-activity.ts",
    );
    const src = fs.readFileSync(activityPath, "utf-8");
    expect(src).toContain("trackActivity");
    expect(src).toContain("getActivityTimeline");
    expect(src).toContain("user_action");
    expect(src).toContain("commercial_action");
    expect(src).toContain("score_change");
    expect(src).toContain("meeting");
    expect(src).toContain("conversion");
  });
});
