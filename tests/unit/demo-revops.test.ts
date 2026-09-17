/**
 * tests/unit/demo-revops.test.ts
 *
 * Unit tests for Demo Revenue Operations Layer:
 *   - demo-actions.ts
 *   - demo-cadence.ts
 *   - demo-notifications.ts
 *   - demo-activity.ts
 *   - demo-deals.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

// ─── Temp dir helpers ────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-revops-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function tmp(name: string) {
  return path.join(tmpDir, name);
}

// ─── demo-cadence ────────────────────────────────────────────────────────────

describe("Demo Cadence Engine", () => {
  it("returns correct step for day 0", async () => {
    const { getCadenceStepForDay } = await import("../../scripts/demo/lib/demo-cadence");
    const step = getCadenceStepForDay(0);
    expect(step).not.toBeNull();
    expect(step?.day).toBe(0);
    expect(step?.trigger).toBe("demo_created");
    expect(step?.channel).toBe("whatsapp");
  });

  it("returns step for days 1, 2, 3, 5", async () => {
    const { getCadenceStepForDay } = await import("../../scripts/demo/lib/demo-cadence");
    expect(getCadenceStepForDay(1)?.day).toBe(1);
    expect(getCadenceStepForDay(2)?.day).toBe(2);
    expect(getCadenceStepForDay(3)?.day).toBe(3);
    expect(getCadenceStepForDay(5)?.day).toBe(5);
  });

  it("returns null for day 4 (no cadence touch)", async () => {
    const { getCadenceStepForDay } = await import("../../scripts/demo/lib/demo-cadence");
    expect(getCadenceStepForDay(4)).toBeNull();
  });

  it("DEMO_CADENCE has exactly 5 touches", async () => {
    const { DEMO_CADENCE } = await import("../../scripts/demo/lib/demo-cadence");
    expect(DEMO_CADENCE).toHaveLength(5);
  });

  it("renders cadence message template", async () => {
    const { DEMO_CADENCE, renderCadenceMessage } = await import("../../scripts/demo/lib/demo-cadence");
    const step = DEMO_CADENCE[0]!;
    const rendered = renderCadenceMessage(step, {
      name: "Laura",
      company: "Clínica Test",
      country: "Colombia",
    });
    expect(rendered).toContain("Laura");
    expect(rendered).not.toContain("{{name}}");
    expect(rendered).not.toContain("{{company}}");
  });

  it("markCadenceStepComplete persists to file", async () => {
    const { markCadenceStepComplete } = await import("../../scripts/demo/lib/demo-cadence");
    const filePath = tmp("cadence.json");
    const result = markCadenceStepComplete("tenant-abc", 0, filePath);
    expect(result.completedSteps).toContain(0);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("getDueCadenceSteps filters already completed steps", async () => {
    const { getDueCadenceSteps, markCadenceStepComplete } = await import("../../scripts/demo/lib/demo-cadence");
    const filePath = tmp("cadence-due.json");
    markCadenceStepComplete("tenant-xyz", 0, filePath);

    // Day 3 has passed
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    // createdAt = now - 3 days; current day = 3
    const due = getDueCadenceSteps(
      "tenant-xyz",
      threeDaysAgo.toISOString(),
      new Date(),
      filePath,
    );
    // Step day 0 was completed, so only steps for days 1, 2, 3 should be due
    const days = due.map((s) => s.day);
    expect(days).not.toContain(0);
    expect(days).toContain(1);
    expect(days).toContain(2);
    expect(days).toContain(3);
  });
});

// ─── demo-notifications ──────────────────────────────────────────────────────

describe("Demo Notifications Adapter", () => {
  it("dryRun skips dispatch and records status=skipped", async () => {
    const { sendDemoNotification, listDemoNotifications } = await import(
      "../../scripts/demo/lib/demo-notifications"
    );
    const filePath = tmp("notifs.json");
    const result = await sendDemoNotification(
      {
        tenantId: "tenant-notif",
        channel: "whatsapp",
        recipient: "+5511999999999",
        message: "Test message",
      },
      { dryRun: true, customFilePath: filePath },
    );
    expect(result.status).toBe("skipped");
    const list = listDemoNotifications("tenant-notif", filePath);
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe("skipped");
  });

  it("fails silently when WhatsApp URL not configured", async () => {
    const { sendDemoNotification } = await import("../../scripts/demo/lib/demo-notifications");
    const filePath = tmp("notifs-fail.json");
    // No EVOLUTION_API_URL set → should not throw
    const result = await sendDemoNotification(
      {
        tenantId: "tenant-silent",
        channel: "whatsapp",
        recipient: "+5511999999999",
        message: "Test",
      },
      { customFilePath: filePath },
    );
    // Either sent (if stub logs) or failed-silently — never throws
    expect(["sent", "failed"]).toContain(result.status);
  });

  it("email channel records notification", async () => {
    const { sendDemoNotification, listDemoNotifications } = await import(
      "../../scripts/demo/lib/demo-notifications"
    );
    const filePath = tmp("notifs-email.json");
    await sendDemoNotification(
      {
        tenantId: "tenant-email",
        channel: "email",
        recipient: "laura@test.com",
        subject: "Demo subject",
        message: "Hello from Deskcomm",
      },
      { dryRun: true, customFilePath: filePath },
    );
    const list = listDemoNotifications("tenant-email", filePath);
    expect(list[0]?.channel).toBe("email");
    expect(list[0]?.subject).toBe("Demo subject");
  });
});

// ─── demo-activity ───────────────────────────────────────────────────────────

describe("Activity Timeline", () => {
  it("trackActivity persists event with correct category", async () => {
    const { trackActivity, getActivityTimeline } = await import(
      "../../scripts/demo/lib/demo-activity"
    );
    const filePath = tmp("activity.json");
    trackActivity(
      "tenant-act",
      "user_action",
      "inbox_viewed",
      "User opened the inbox",
      { customFilePath: filePath },
    );
    const timeline = getActivityTimeline("tenant-act", { customFilePath: filePath });
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.category).toBe("user_action");
    expect(timeline[0]?.eventName).toBe("inbox_viewed");
  });

  it("filters by category correctly", async () => {
    const { trackActivity, getActivityTimeline } = await import(
      "../../scripts/demo/lib/demo-activity"
    );
    const filePath = tmp("activity-cat.json");
    trackActivity("t1", "user_action", "login", "User logged in", { customFilePath: filePath });
    trackActivity("t1", "commercial_action", "followup_sent", "WhatsApp sent", { customFilePath: filePath });
    trackActivity("t1", "meeting", "meeting_booked", "Call scheduled", { customFilePath: filePath });

    const commercial = getActivityTimeline("t1", { category: "commercial_action", customFilePath: filePath });
    expect(commercial).toHaveLength(1);
    expect(commercial[0]?.eventName).toBe("followup_sent");
  });

  it("getGlobalActivitySummary aggregates by category", async () => {
    const { trackActivity, getGlobalActivitySummary } = await import(
      "../../scripts/demo/lib/demo-activity"
    );
    const filePath = tmp("activity-global.json");
    trackActivity("t1", "user_action", "e1", "d", { customFilePath: filePath });
    trackActivity("t1", "user_action", "e2", "d", { customFilePath: filePath });
    trackActivity("t2", "conversion", "e3", "d", { customFilePath: filePath });

    const summary = getGlobalActivitySummary(filePath);
    expect(summary.total).toBe(3);
    expect(summary.byCategory.user_action).toBe(2);
    expect(summary.byCategory.conversion).toBe(1);
  });
});

// ─── demo-deals ──────────────────────────────────────────────────────────────

describe("Deal Tracking", () => {
  it("createDemoDeal sets correct plan value for BRL", async () => {
    const { createDemoDeal, DESKCOMM_PLANS } = await import("../../scripts/demo/lib/demo-deals");
    const filePath = tmp("deals.json");
    const deal = createDemoDeal({
      leadId: "lead-1",
      tenantId: "tenant-deal",
      plan: "starter",
      currency: "BRL",
      customFilePath: filePath,
    });
    const plan = DESKCOMM_PLANS.find((p) => p.name === "starter");
    expect(deal.value).toBe(plan?.monthlyPrice.BRL);
    expect(deal.currency).toBe("BRL");
    expect(deal.status).toBe("prospecting");
  });

  it("updateDealStatus transitions to closed_won", async () => {
    const { createDemoDeal, updateDealStatus } = await import("../../scripts/demo/lib/demo-deals");
    const filePath = tmp("deals-update.json");
    const deal = createDemoDeal({
      leadId: "lead-2",
      tenantId: "tenant-deal-2",
      plan: "professional",
      currency: "COP",
      customFilePath: filePath,
    });
    const updated = updateDealStatus(deal.id, "closed_won", { customFilePath: filePath });
    expect(updated?.status).toBe("closed_won");
    expect(updated?.closedAt).toBeDefined();
  });

  it("estimateMRR sums closed_won deals by currency", async () => {
    const { createDemoDeal, updateDealStatus, estimateMRR } = await import(
      "../../scripts/demo/lib/demo-deals"
    );
    const filePath = tmp("deals-mrr.json");
    const d1 = createDemoDeal({ leadId: "l1", tenantId: "t1", plan: "starter", currency: "BRL", customFilePath: filePath });
    const d2 = createDemoDeal({ leadId: "l2", tenantId: "t2", plan: "starter", currency: "BRL", customFilePath: filePath });
    updateDealStatus(d1.id, "closed_won", { customFilePath: filePath });
    updateDealStatus(d2.id, "closed_won", { customFilePath: filePath });

    const mrr = estimateMRR({ customFilePath: filePath });
    expect(mrr.BRL).toBeGreaterThan(0);
    // Two starter BRL deals
    expect(mrr.BRL).toBe(d1.value + d2.value);
    expect(mrr.COP).toBe(0);
  });

  it("listDemoDeals filters by status", async () => {
    const { createDemoDeal, updateDealStatus, listDemoDeals } = await import(
      "../../scripts/demo/lib/demo-deals"
    );
    const filePath = tmp("deals-list.json");
    const d = createDemoDeal({ leadId: "l3", tenantId: "t3", plan: "enterprise", currency: "EUR", customFilePath: filePath });
    createDemoDeal({ leadId: "l4", tenantId: "t4", plan: "starter", currency: "EUR", customFilePath: filePath });
    updateDealStatus(d.id, "closed_lost", { customFilePath: filePath });

    const lost = listDemoDeals({ status: "closed_lost", customFilePath: filePath });
    expect(lost).toHaveLength(1);
    expect(lost[0]?.status).toBe("closed_lost");
  });
});

// ─── demo-actions (non-Supabase path) ───────────────────────────────────────

describe("Demo Actions Engine", () => {
  it("computeDemoAction throws on production env", async () => {
    const { computeDemoAction } = await import("../../scripts/demo/lib/demo-actions");
    await expect(
      computeDemoAction(
        {
          tenantId: "tenant-prod",
          leadStatus: "demo_created",
          score: 20,
          isActivated: false,
          customEnv: { NODE_ENV: "production" },
        },
        tmp("actions.json"),
      ),
    ).rejects.toThrow();
  });

  it("listDemoActions returns empty array for missing file", async () => {
    const { listDemoActions } = await import("../../scripts/demo/lib/demo-actions");
    const result = listDemoActions("tenant-x", undefined, tmp("nonexistent.json"));
    expect(result).toEqual([]);
  });

  it("completeDemoAction marks action completed", async () => {
    const { completeDemoAction } = await import("../../scripts/demo/lib/demo-actions");
    const filePath = tmp("actions-complete.json");
    // Seed a fake action file
    const fakeAction = {
      id: "action-id-1",
      tenantId: "t1",
      title: "Call lead",
      description: "desc",
      priority: "high",
      status: "pending",
      slaDueAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify([fakeAction], null, 2));
    const result = completeDemoAction("action-id-1", filePath);
    expect(result?.status).toBe("completed");
    expect(result?.completedAt).toBeDefined();
  });
});
