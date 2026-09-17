/**
 * tests/unit/demo-sales-automation.test.ts
 *
 * Unit tests for Demo Sales Automation Layer:
 *   1. Automated demo follow-up engine & isolation
 *   2. Commercial pipeline states & conversion event tracking
 *   3. Demo activation metrics (first_login + inbox_viewed + agenda_viewed)
 *   4. Sales next-action recommendations
 *   5. Production blocking safety guards
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  triggerDemoFollowup,
  listDemoFollowups,
  executeDemoFollowup,
  type DemoFollowupTrigger,
} from "../../scripts/demo/lib/demo-followups";
import {
  trackConversionEvent,
  listConversionEvents,
  type DemoConversionEventName,
} from "../../scripts/demo/lib/demo-conversion-events";
import {
  isDemoActivated,
  getDemoActivationRate,
  getSuggestedNextAction,
} from "../../scripts/demo/lib/demo-activation";
import {
  createDemoLead,
  findDemoLeadByTenantId,
  DEMO_LEAD_STAGES,
  type DemoLeadStatus,
} from "../../scripts/demo/lib/demo-leads";
import type { DemoEventRecord } from "../../scripts/demo/lib/demo-events";

const TEST_FOLLOWUPS_FILE = path.resolve(process.cwd(), ".demo", "test_followups.json");
const TEST_CONVERSIONS_FILE = path.resolve(process.cwd(), ".demo", "test_conversions.json");
const TEST_LEADS_FILE = path.resolve(process.cwd(), ".demo", "test_auto_leads.json");

describe("Demo Sales Automation — Follow-up Engine", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_FOLLOWUPS_FILE)) fs.unlinkSync(TEST_FOLLOWUPS_FILE);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_FOLLOWUPS_FILE)) fs.unlinkSync(TEST_FOLLOWUPS_FILE);
  });

  it("triggers follow-up plans for all 4 demo triggers", async () => {
    const triggers: DemoFollowupTrigger[] = [
      "demo_created",
      "demo_high_intent",
      "demo_inactive",
      "demo_expiring",
    ];

    for (const trigger of triggers) {
      const plan = await triggerDemoFollowup(
        "clinica-sonrisa-bogota",
        trigger,
        { name: "Dra. Laura", company: "Clínica Sonrisa" },
        { customFilePath: TEST_FOLLOWUPS_FILE },
      );

      expect(plan.id).toBeDefined();
      expect(plan.trigger).toBe(trigger);
      expect(plan.messageTemplate).toContain("Laura");
      expect(plan.suggestedAction).toBeTruthy();
      expect(plan.executed).toBe(false);
    }

    const all = listDemoFollowups("clinica-sonrisa-bogota", TEST_FOLLOWUPS_FILE);
    expect(all).toHaveLength(4);
  });

  it("marks a follow-up as executed", async () => {
    const plan = await triggerDemoFollowup(
      "clinica-sonrisa-bogota",
      "demo_created",
      { name: "Dr. Carlos" },
      { customFilePath: TEST_FOLLOWUPS_FILE },
    );

    const executed = executeDemoFollowup(plan.id, TEST_FOLLOWUPS_FILE);
    expect(executed).not.toBeNull();
    expect(executed?.executed).toBe(true);
    expect(executed?.executedAt).toBeDefined();
  });

  it("strictly isolates follow-ups: rejects non-demo tenants", async () => {
    await expect(
      triggerDemoFollowup(
        "real-customer-tenant-xyz",
        "demo_created",
        { name: "Cliente Real" },
        {
          customFilePath: TEST_FOLLOWUPS_FILE,
          customAdmin: {
            from: () => ({
              select: () => ({
                or: () => ({
                  maybeSingle: async () => ({
                    data: { settings: { demo: false } },
                  }),
                }),
              }),
            }),
          } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        },
      ),
    ).rejects.toThrow(/not a verified demo tenant/);
  });
});

describe("Demo Sales Automation — Pipeline States & Conversion Events", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_CONVERSIONS_FILE)) fs.unlinkSync(TEST_CONVERSIONS_FILE);
    if (fs.existsSync(TEST_LEADS_FILE)) fs.unlinkSync(TEST_LEADS_FILE);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_CONVERSIONS_FILE)) fs.unlinkSync(TEST_CONVERSIONS_FILE);
    if (fs.existsSync(TEST_LEADS_FILE)) fs.unlinkSync(TEST_LEADS_FILE);
  });

  it("supports all extended commercial pipeline states", () => {
    const expectedStages: DemoLeadStatus[] = [
      "requested",
      "demo_created",
      "activated",
      "engaged",
      "meeting_booked",
      "proposal_sent",
      "converted",
      "lost",
    ];

    for (const stage of expectedStages) {
      expect(DEMO_LEAD_STAGES).toContain(stage);
    }
  });

  it("tracks conversion events and automatically advances lead status", async () => {
    const tenantId = "tenant-demo-conversion-flow";
    await createDemoLead(
      {
        name: "Dr. Juan Dental",
        company: "Juan Dental Care",
        country: "CO",
        email: "juan@juandental.demo",
        whatsapp: "+573001112233",
        demo_tenant_id: tenantId,
        status: "demo_created",
      },
      { customFilePath: TEST_LEADS_FILE },
    );

    const conversionEvents: DemoConversionEventName[] = [
      "meeting_booked",
      "proposal_sent",
      "converted",
    ];

    for (const eventName of conversionEvents) {
      const record = await trackConversionEvent(
        tenantId,
        eventName,
        { note: `Progressed to ${eventName}` },
        { filePath: TEST_CONVERSIONS_FILE, leadsFilePath: TEST_LEADS_FILE },
      );

      expect(record.id).toBeDefined();
      expect(record.event_name).toBe(eventName);

      const lead = findDemoLeadByTenantId(tenantId, TEST_LEADS_FILE);
      expect(lead?.status).toBe(eventName);
    }

    const recorded = listConversionEvents(tenantId, TEST_CONVERSIONS_FILE);
    expect(recorded).toHaveLength(3);
  });
});

describe("Demo Sales Automation — Activation Metrics", () => {
  const tenantId = "demo-activation-check";
  const now = new Date().toISOString();

  it("identifies unactivated vs activated demos strictly (first_login + inbox_viewed + agenda_viewed)", () => {
    // 1. Only first_login -> Not activated
    const events1: DemoEventRecord[] = [
      { tenant_id: tenantId, event_name: "first_login", created_at: now },
    ];
    expect(isDemoActivated(tenantId, events1)).toBe(false);

    // 2. first_login + inbox_viewed -> Not activated
    events1.push({ tenant_id: tenantId, event_name: "inbox_viewed", created_at: now });
    expect(isDemoActivated(tenantId, events1)).toBe(false);

    // 3. first_login + inbox_viewed + agenda_viewed -> Activated!
    events1.push({ tenant_id: tenantId, event_name: "agenda_viewed", created_at: now });
    expect(isDemoActivated(tenantId, events1)).toBe(true);
  });

  it("calculates overall demo activation rate correctly", () => {
    const events: DemoEventRecord[] = [
      // Tenant 1: Activated
      { tenant_id: "demo-t1", event_name: "first_login", created_at: now },
      { tenant_id: "demo-t1", event_name: "inbox_viewed", created_at: now },
      { tenant_id: "demo-t1", event_name: "agenda_viewed", created_at: now },
      // Tenant 2: Not activated (missing agenda_viewed)
      { tenant_id: "demo-t2", event_name: "first_login", created_at: now },
      { tenant_id: "demo-t2", event_name: "inbox_viewed", created_at: now },
    ];

    const metrics = getDemoActivationRate({
      tenantIds: ["demo-t1", "demo-t2"],
      customEvents: events,
    });

    expect(metrics.totalDemos).toBe(2);
    expect(metrics.activatedDemos).toBe(1);
    expect(metrics.activationRatePercentage).toBe(50);
    expect(metrics.activatedTenantIds).toEqual(["demo-t1"]);
    expect(metrics.pendingTenantIds).toEqual(["demo-t2"]);
  });

  it("suggests contextual next sales actions based on activation and pipeline stage", () => {
    expect(getSuggestedNextAction("t1", { status: "converted" })).toContain("onboarding definitivo");
    expect(getSuggestedNextAction("t1", { status: "meeting_booked" })).toContain("reunión comercial");
    expect(getSuggestedNextAction("t1", { score: 85 })).toContain("Alta Intención");
    expect(getSuggestedNextAction("t1", { isActivated: true, score: 30 })).toContain("Demo activada");
    expect(getSuggestedNextAction("t1", { isExpiring: true })).toContain("Expira pronto");
    expect(getSuggestedNextAction("t1", { isInactive: true })).toContain("Inactiva");
  });
});

describe("Demo Sales Automation — Production Blocking Guard", () => {
  it("rejects follow-up triggering in production environment", async () => {
    await expect(
      triggerDemoFollowup(
        "clinica-sonrisa-bogota",
        "demo_created",
        {},
        {
          customEnv: {
            NODE_ENV: "production",
          },
        },
      ),
    ).rejects.toThrow(/NODE_ENV=production/);

    await expect(
      triggerDemoFollowup(
        "clinica-sonrisa-bogota",
        "demo_created",
        {},
        {
          customEnv: {
            NEXT_PUBLIC_SUPABASE_URL: "https://zywwwvrotgqouxillpvi.supabase.co",
          },
        },
      ),
    ).rejects.toThrow(/production Supabase/);
  });
});
