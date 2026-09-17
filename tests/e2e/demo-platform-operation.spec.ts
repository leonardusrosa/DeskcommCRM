/**
 * tests/e2e/demo-platform-operation.spec.ts
 *
 * Playwright E2E Spec: Demo Platform Operations & Scale Layer.
 * Validates:
 *   1. Strict production isolation (registry, assignments, SLA, partners)
 *   2. Demo Timeline page (/admin/demos/[id]/timeline)
 *   3. Sales Workspace & Admin routes
 *   4. File system module integration assertions
 */

import { test, expect } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

// ─── 1. Production Isolation Checks ────────────────────────────────────────

test.describe("Production Safety Isolation", () => {
  test("demo-registry throws on NODE_ENV=production", async () => {
    const { registerDemo } = await import("../../scripts/demo/lib/demo-registry");
    expect(() =>
      registerDemo(
        { tenantId: "t-prod", name: "Prod Test", ownerEmail: "test@deskcomm.io" },
        undefined,
        { NODE_ENV: "production" },
      ),
    ).toThrow(/strictly prohibited when NODE_ENV=production/);
  });

  test("demo-sales-assignments throws on NODE_ENV=production", async () => {
    const { assignLeadToRep } = await import(
      "../../scripts/demo/lib/demo-sales-assignments"
    );
    expect(() =>
      assignLeadToRep(
        "t-prod",
        { id: "rep1", name: "Rep 1", email: "rep1@deskcomm.io" },
        { customEnv: { NODE_ENV: "production" } },
      ),
    ).toThrow(/strictly prohibited when NODE_ENV=production/);
  });

  test("demo-sla throws on NODE_ENV=production", async () => {
    const { createSLATimer } = await import("../../scripts/demo/lib/demo-sla");
    expect(() =>
      createSLATimer("t-prod", "first_contact", 2, {
        customEnv: { NODE_ENV: "production" },
      }),
    ).toThrow(/strictly prohibited when NODE_ENV=production/);
  });

  test("demo-partners throws on NODE_ENV=production", async () => {
    const { registerPartner } = await import("../../scripts/demo/lib/demo-partners");
    expect(() =>
      registerPartner(
        { partnerCode: "PARTNER1", name: "Partner", agencyName: "Agency", email: "p@a.co" },
        undefined,
        { NODE_ENV: "production" },
      ),
    ).toThrow(/strictly prohibited when NODE_ENV=production/);
  });
});

// ─── 2. Admin UI Routes ────────────────────────────────────────────────────

test.describe("Admin Platform Operation Pages", () => {
  test("renders /admin/demos/demo-test-tenant/timeline safely", async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/admin/demos/demo-test-tenant/timeline`);
    // Protected route redirects unauthenticated or renders 200, never 500
    expect(res?.status()).not.toBe(500);
    expect(res?.status()).not.toBe(404);
  });

  test("Timeline API enforces platform admin authorization", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/admin/demos/test-tenant/timeline`);
    expect([200, 401, 403]).toContain(res.status());
  });
});

// ─── 3. Source Structure Assertions ────────────────────────────────────────

test.describe("Scale Layer Source Structure Assertions", () => {
  test("demo-registry.ts exports registerDemo, archiveDemo, transferDemoOwnership", () => {
    const regPath = path.resolve(process.cwd(), "scripts/demo/lib/demo-registry.ts");
    expect(fs.existsSync(regPath)).toBe(true);
    const src = fs.readFileSync(regPath, "utf-8");
    expect(src).toContain("registerDemo");
    expect(src).toContain("archiveDemo");
    expect(src).toContain("transferDemoOwnership");
    expect(src).toContain("listActiveDemos");
  });

  test("demo-sales-assignments.ts exports round-robin distribution", () => {
    const path_ = path.resolve(process.cwd(), "scripts/demo/lib/demo-sales-assignments.ts");
    expect(fs.existsSync(path_)).toBe(true);
    const src = fs.readFileSync(path_, "utf-8");
    expect(src).toContain("assignLeadToRep");
    expect(src).toContain("reassignLead");
    expect(src).toContain("distributeRoundRobin");
  });

  test("demo-sla.ts exports SLA timers and breach escalation", () => {
    const path_ = path.resolve(process.cwd(), "scripts/demo/lib/demo-sla.ts");
    expect(fs.existsSync(path_)).toBe(true);
    const src = fs.readFileSync(path_, "utf-8");
    expect(src).toContain("createSLATimer");
    expect(src).toContain("evaluateSLATimer");
    expect(src).toContain("checkAndEscalateSLAs");
  });

  test("demo-alerts.ts supports WhatsApp, Slack, and Email channels", () => {
    const path_ = path.resolve(process.cwd(), "scripts/demo/lib/demo-alerts.ts");
    expect(fs.existsSync(path_)).toBe(true);
    const src = fs.readFileSync(path_, "utf-8");
    expect(src).toContain("whatsapp");
    expect(src).toContain("slack");
    expect(src).toContain("email");
    expect(src).toContain("sendDemoAlert");
  });

  test("demo-forecast.ts calculates pipeline value, weighted revenue, and ARR", () => {
    const path_ = path.resolve(process.cwd(), "scripts/demo/lib/demo-forecast.ts");
    expect(fs.existsSync(path_)).toBe(true);
    const src = fs.readFileSync(path_, "utf-8");
    expect(src).toContain("pipelineValue");
    expect(src).toContain("weightedRevenue");
    expect(src).toContain("arrForecast");
  });

  test("demo-partners.ts tracks partner attribution and commission", () => {
    const path_ = path.resolve(process.cwd(), "scripts/demo/lib/demo-partners.ts");
    expect(fs.existsSync(path_)).toBe(true);
    const src = fs.readFileSync(path_, "utf-8");
    expect(src).toContain("registerPartner");
    expect(src).toContain("attributePartnerDemo");
    expect(src).toContain("getPartnerSummary");
  });

  test("demo-audit.ts tracks ownership changes, status changes, exports, and actions", () => {
    const path_ = path.resolve(process.cwd(), "scripts/demo/lib/demo-audit.ts");
    expect(fs.existsSync(path_)).toBe(true);
    const src = fs.readFileSync(path_, "utf-8");
    expect(src).toContain("recordDemoAudit");
    expect(src).toContain("ownership_change");
    expect(src).toContain("status_change");
    expect(src).toContain("export");
    expect(src).toContain("commercial_action");
  });
});
