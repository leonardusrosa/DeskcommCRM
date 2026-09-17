/**
 * tests/unit/demo-conversion.test.ts
 *
 * Unit tests for Demo Conversion Engine:
 *   1. Commercial lead entity isolation (demo_leads vs crm_leads)
 *   2. Commercial scoring calculations and intent thresholds
 *   3. Automated commercial signals (high intent, inactivity, expiration)
 *   4. Lead conversion lifecycle states
 *   5. Production safety blocking
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createDemoLead,
  listDemoLeads,
  findDemoLeadByTenantId,
  updateDemoLeadStatus,
  type DemoLeadStatus,
} from "../../scripts/demo/lib/demo-leads";
import {
  getDemoScore,
  getCommercialSignals,
  DEMO_SCORE_WEIGHTS,
} from "../../scripts/demo/lib/demo-score";
import { assertSafetyGuards, assertDemoEnvironmentSafety } from "../../scripts/demo/lib/guards";
import type { DemoEventRecord } from "../../scripts/demo/lib/demo-events";

const TEST_LEADS_FILE = path.resolve(process.cwd(), ".demo", "test_demo_leads.json");

describe("Demo Conversion Engine — Lead Entity & Isolation", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_LEADS_FILE)) fs.unlinkSync(TEST_LEADS_FILE);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_LEADS_FILE)) fs.unlinkSync(TEST_LEADS_FILE);
  });

  it("creates a demo lead stored in isolated commercial storage", async () => {
    const lead = await createDemoLead(
      {
        name: "Dra. Sofía Morales",
        company: "Clínica Dental Provenza",
        country: "CO",
        vertical: "dental-clinic",
        email: "sofia@dentalprovenza.demo",
        whatsapp: "+573009988776",
        demo_tenant_id: "tenant-demo-123",
      },
      { customFilePath: TEST_LEADS_FILE },
    );

    expect(lead.id).toBeDefined();
    expect(lead.name).toBe("Dra. Sofía Morales");
    expect(lead.country).toBe("CO");
    expect(lead.status).toBe("demo_created");
    expect(lead.demo_tenant_id).toBe("tenant-demo-123");

    const retrieved = findDemoLeadByTenantId("tenant-demo-123", TEST_LEADS_FILE);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.company).toBe("Clínica Dental Provenza");
  });

  it("updates demo lead through the complete commercial lifecycle", async () => {
    await createDemoLead(
      {
        name: "Dr. Carlos Ruiz",
        company: "Ruiz Odontología",
        country: "MX",
        email: "carlos@ruizdental.mx",
        whatsapp: "+525512345678",
        demo_tenant_id: "tenant-mx-456",
        status: "requested",
      },
      { customFilePath: TEST_LEADS_FILE },
    );

    const statuses: DemoLeadStatus[] = [
      "demo_created",
      "active",
      "qualified",
      "converted",
      "lost",
    ];

    for (const st of statuses) {
      const updated = updateDemoLeadStatus("tenant-mx-456", st, TEST_LEADS_FILE);
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe(st);
    }
  });

  it("filters demo leads by status and country", async () => {
    await createDemoLead(
      {
        name: "Lead Colombia",
        company: "Col Clinic",
        country: "CO",
        email: "col@test.com",
        whatsapp: "+57123",
        demo_tenant_id: "tenant-co-1",
        status: "qualified",
      },
      { customFilePath: TEST_LEADS_FILE },
    );

    await createDemoLead(
      {
        name: "Lead España",
        company: "Es Clinic",
        country: "ES",
        email: "es@test.com",
        whatsapp: "+34123",
        demo_tenant_id: "tenant-es-1",
        status: "demo_created",
      },
      { customFilePath: TEST_LEADS_FILE },
    );

    const colLeads = listDemoLeads({ country: "CO" }, TEST_LEADS_FILE);
    expect(colLeads).toHaveLength(1);
    expect(colLeads[0]?.company).toBe("Col Clinic");

    const qualifiedLeads = listDemoLeads({ status: "qualified" }, TEST_LEADS_FILE);
    expect(qualifiedLeads).toHaveLength(1);
    expect(qualifiedLeads[0]?.country).toBe("CO");
  });
});

describe("Demo Conversion Engine — Scoring & Intent", () => {
  const tenantId = "demo-tenant-score-test";

  it("calculates correct weight for each interaction event", () => {
    expect(DEMO_SCORE_WEIGHTS.first_login).toBe(10);
    expect(DEMO_SCORE_WEIGHTS.inbox_viewed).toBe(15);
    expect(DEMO_SCORE_WEIGHTS.pipeline_viewed).toBe(15);
    expect(DEMO_SCORE_WEIGHTS.agenda_viewed).toBe(15);
    expect(DEMO_SCORE_WEIGHTS.google_connected).toBe(25);
    expect(DEMO_SCORE_WEIGHTS.appointment_created).toBe(20);

    const sum = Object.values(DEMO_SCORE_WEIGHTS).reduce((acc, v) => acc + v, 0);
    expect(sum).toBe(100);
  });

  it("evaluates score and level correctly with progressive events", () => {
    const now = new Date().toISOString();
    const events: DemoEventRecord[] = [
      { tenant_id: tenantId, event_name: "first_login", created_at: now },
      { tenant_id: tenantId, event_name: "inbox_viewed", created_at: now },
    ];

    const score1 = getDemoScore(tenantId, events);
    expect(score1.score).toBe(25);
    expect(score1.level).toBe("low");
    expect(score1.isHighIntent).toBe(false);

    // Add pipeline & agenda: 25 + 15 + 15 = 55
    events.push(
      { tenant_id: tenantId, event_name: "pipeline_viewed", created_at: now },
      { tenant_id: tenantId, event_name: "agenda_viewed", created_at: now },
    );

    const score2 = getDemoScore(tenantId, events);
    expect(score2.score).toBe(55);
    expect(score2.level).toBe("medium");
    expect(score2.isHighIntent).toBe(false);

    // Add google_connected (+25): 55 + 25 = 80 -> High intent
    events.push({ tenant_id: tenantId, event_name: "google_connected", created_at: now });

    const score3 = getDemoScore(tenantId, events);
    expect(score3.score).toBe(80);
    expect(score3.level).toBe("high");
    expect(score3.isHighIntent).toBe(true);
  });

  it("caps total score at 100 even with duplicate events", () => {
    const now = new Date().toISOString();
    const events: DemoEventRecord[] = [
      { tenant_id: tenantId, event_name: "first_login", created_at: now },
      { tenant_id: tenantId, event_name: "first_login", created_at: now },
      { tenant_id: tenantId, event_name: "inbox_viewed", created_at: now },
      { tenant_id: tenantId, event_name: "pipeline_viewed", created_at: now },
      { tenant_id: tenantId, event_name: "agenda_viewed", created_at: now },
      { tenant_id: tenantId, event_name: "google_connected", created_at: now },
      { tenant_id: tenantId, event_name: "appointment_created", created_at: now },
    ];

    const result = getDemoScore(tenantId, events);
    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
  });
});

describe("Demo Conversion Engine — Commercial Signals", () => {
  const tenantId = "demo-tenant-signals-test";

  it("triggers demo_high_intent when score reaches 70+", () => {
    const now = new Date();
    const highEvents: DemoEventRecord[] = [
      { tenant_id: tenantId, event_name: "first_login", created_at: now.toISOString() },
      { tenant_id: tenantId, event_name: "inbox_viewed", created_at: now.toISOString() },
      { tenant_id: tenantId, event_name: "pipeline_viewed", created_at: now.toISOString() },
      { tenant_id: tenantId, event_name: "agenda_viewed", created_at: now.toISOString() },
      { tenant_id: tenantId, event_name: "google_connected", created_at: now.toISOString() },
    ];

    const signals = getCommercialSignals(tenantId, { customEvents: highEvents, now });
    expect(signals.some((s) => s.signal === "demo_high_intent")).toBe(true);
  });

  it("triggers demo_inactive when no activity for 48 hours", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const activeTime = new Date("2026-09-15T02:00:00Z").toISOString(); // 10h ago
    const inactiveTime = new Date("2026-09-12T12:00:00Z").toISOString(); // 72h ago

    const activeSignals = getCommercialSignals(tenantId, {
      customEvents: [],
      lastActivity: activeTime,
      now,
    });
    expect(activeSignals.some((s) => s.signal === "demo_inactive")).toBe(false);

    const inactiveSignals = getCommercialSignals(tenantId, {
      customEvents: [],
      lastActivity: inactiveTime,
      now,
    });
    expect(inactiveSignals.some((s) => s.signal === "demo_inactive")).toBe(true);
  });

  it("triggers demo_expiring when expiration is within 24 hours", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const farExpiration = new Date("2026-09-20T12:00:00Z").toISOString(); // 5 days
    const nearExpiration = new Date("2026-09-16T08:00:00Z").toISOString(); // 20 hours

    const farSignals = getCommercialSignals(tenantId, {
      customEvents: [],
      expiresAt: farExpiration,
      now,
    });
    expect(farSignals.some((s) => s.signal === "demo_expiring")).toBe(false);

    const nearSignals = getCommercialSignals(tenantId, {
      customEvents: [],
      expiresAt: nearExpiration,
      now,
    });
    expect(nearSignals.some((s) => s.signal === "demo_expiring")).toBe(true);
  });
});

describe("Demo Conversion Engine — Production Blocking Guard", () => {
  it("strictly rejects execution when NODE_ENV is production", () => {
    expect(() =>
      assertSafetyGuards({
        NODE_ENV: "production",
        DEMO_SEED_ALLOWED: "true",
        DEMO_USER_PASSWORD: "secure-password-123",
      }),
    ).toThrow(/NODE_ENV=production/);

    expect(() =>
      assertDemoEnvironmentSafety({
        NODE_ENV: "production",
      }),
    ).toThrow(/NODE_ENV=production/);
  });

  it("strictly rejects execution against production Supabase instance", () => {
    const prodRef = "zywwwvrotgqouxillpvi";
    expect(() =>
      assertSafetyGuards({
        NEXT_PUBLIC_SUPABASE_URL: `https://${prodRef}.supabase.co`,
        SUPABASE_SERVICE_ROLE_KEY: "dummy-key",
        DEMO_SEED_ALLOWED: "true",
        DEMO_USER_PASSWORD: "secure-password-123",
      }),
    ).toThrow(/production Supabase/);

    expect(() =>
      assertDemoEnvironmentSafety({
        NEXT_PUBLIC_SUPABASE_URL: `https://${prodRef}.supabase.co`,
        SUPABASE_SERVICE_ROLE_KEY: "dummy-key",
      }),
    ).toThrow(/production Supabase/);
  });
});
