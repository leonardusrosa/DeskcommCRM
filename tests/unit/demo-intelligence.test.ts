/**
 * tests/unit/demo-intelligence.test.ts
 *
 * Unit tests for Demo Intelligence Layer:
 *   1. Demo event tracking isolation and resilience
 *   2. Strict production blocking
 *   3. Expiration cleanup safety and dry-run
 *   4. Demo status metrics and formatting
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  trackDemoEvent,
  getTrackedDemoEvents,
  getTrackedDemoSessions,
  type DemoEventName,
} from "../../scripts/demo/lib/demo-events";
import { cleanupExpiredDemos } from "../../scripts/demo/cleanup-expired";
import {
  getDemoStatus,
  formatCreatedAgo,
  formatExpiresIn,
} from "../../scripts/demo/status";

const TEST_EVENTS_FILE = path.resolve(process.cwd(), ".demo", "test_events.json");
const TEST_SESSIONS_FILE = path.resolve(process.cwd(), ".demo", "test_sessions.json");

describe("Demo Intelligence — Event Tracking & Isolation", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_EVENTS_FILE)) fs.unlinkSync(TEST_EVENTS_FILE);
    if (fs.existsSync(TEST_SESSIONS_FILE)) fs.unlinkSync(TEST_SESSIONS_FILE);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_EVENTS_FILE)) fs.unlinkSync(TEST_EVENTS_FILE);
    if (fs.existsSync(TEST_SESSIONS_FILE)) fs.unlinkSync(TEST_SESSIONS_FILE);
  });

  it("records events for verified demo tenants in local storage", async () => {
    const success = await trackDemoEvent(
      "clinica-sonrisa-bogota",
      "demo_opened",
      { surface: "browser_launcher" },
      {
        eventsFilePath: TEST_EVENTS_FILE,
        sessionsFilePath: TEST_SESSIONS_FILE,
        profile: "dental-clinic-colombia",
        country: "CO",
      },
    );

    expect(success).toBe(true);

    const events = getTrackedDemoEvents("clinica-sonrisa-bogota", TEST_EVENTS_FILE);
    expect(events).toHaveLength(1);
    expect(events[0]!.event_name).toBe("demo_opened");

    const sessions = getTrackedDemoSessions(TEST_SESSIONS_FILE);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tenant_id).toBe("clinica-sonrisa-bogota");
    expect(sessions[0]!.country).toBe("CO");
  });

  it("isolates analytics: ignores events for non-demo organizations", async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "real-production-org", settings: { demo: false } },
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const success = await trackDemoEvent(
      "real-production-org",
      "demo_created" as DemoEventName,
      {},
      {
        adminClient: mockAdmin,
        eventsFilePath: TEST_EVENTS_FILE,
        sessionsFilePath: TEST_SESSIONS_FILE,
      },
    );

    expect(success).toBe(false);
    expect(getTrackedDemoEvents("real-production-org", TEST_EVENTS_FILE)).toHaveLength(0);
  });

  it("fail-silent resilience: never crashes even if storage write fails", async () => {
    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("Disk write failure");
    });

    const result = await trackDemoEvent(
      "clinica-sonrisa-bogota",
      "demo_completed",
      {},
      { eventsFilePath: TEST_EVENTS_FILE, sessionsFilePath: TEST_SESSIONS_FILE },
    );

    // Function must handle error gracefully and return false instead of throwing
    expect(result).toBe(false);
    writeSpy.mockRestore();
  });
});

describe("Demo Intelligence — Production Guard Verification", () => {
  it("blocks cleanupExpiredDemos when targeting production Supabase", async () => {
    await expect(
      cleanupExpiredDemos({
        customEnv: {
          NEXT_PUBLIC_SUPABASE_URL: "https://zywwwvrotgqouxillpvi.supabase.co",
          DEMO_SEED_ALLOWED: "true",
          DEMO_USER_PASSWORD: "Password123!",
        },
      }),
    ).rejects.toThrow(/Refusing execution against production Supabase/);
  });

  it("blocks cleanupExpiredDemos when NODE_ENV=production", async () => {
    await expect(
      cleanupExpiredDemos({
        customEnv: {
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NODE_ENV: "production",
          DEMO_SEED_ALLOWED: "true",
          DEMO_USER_PASSWORD: "Password123!",
        },
      }),
    ).rejects.toThrow(/strictly prohibited when NODE_ENV=production/);
  });

  it("blocks getDemoStatus when targeting production Supabase", async () => {
    await expect(
      getDemoStatus({
        customEnv: {
          NEXT_PUBLIC_SUPABASE_URL: "https://zywwwvrotgqouxillpvi.supabase.co",
          DEMO_SEED_ALLOWED: "true",
          DEMO_USER_PASSWORD: "Password123!",
        },
      }),
    ).rejects.toThrow(/Refusing execution against production Supabase/);
  });
});

describe("Demo Intelligence — Expiration Cleanup & Safety", () => {
  const baseValidEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NODE_ENV: "development",
    DEMO_SEED_ALLOWED: "true",
    DEMO_USER_PASSWORD: "ValidPassword123!",
  };

  it("dry-run identifies expired demo tenants without deleting them", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "org-expired-demo",
                  slug: "clinica-expired",
                  display_name: "Clínica Expirada",
                  settings: { demo: true, demo_expires_at: pastDate },
                },
                {
                  id: "org-active-demo",
                  slug: "clinica-activa",
                  display_name: "Clínica Activa",
                  settings: { demo: true, demo_expires_at: futureDate },
                },
                {
                  id: "org-prod",
                  slug: "empresa-real",
                  display_name: "Empresa Real",
                  settings: { demo: false },
                },
              ],
              error: null,
            }),
            delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        return {
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }),
    } as unknown as SupabaseClient;

    const result = await cleanupExpiredDemos({
      dryRun: true,
      customEnv: baseValidEnv,
      customAdmin: mockAdmin,
    });

    expect(result.dryRun).toBe(true);
    expect(result.expiredCount).toBe(1);
    expect(result.deletedCount).toBe(0);
    expect(result.tenants[0]?.id).toBe("org-expired-demo");
  });

  it("deletes only expired demo tenants and leaves active/non-demo tenants untouched", async () => {
    const pastDate = new Date(Date.now() - 100000).toISOString();
    const deleteSpy = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "org-expired-demo",
                  slug: "clinica-expired",
                  display_name: "Clínica Expirada",
                  settings: { demo: true, demo_expires_at: pastDate },
                },
                {
                  id: "org-prod",
                  slug: "empresa-real",
                  display_name: "Empresa Real",
                  settings: { demo: false },
                },
              ],
              error: null,
            }),
            delete: deleteSpy,
          };
        }
        return { delete: deleteSpy };
      }),
    } as unknown as SupabaseClient;

    const result = await cleanupExpiredDemos({
      dryRun: false,
      customEnv: baseValidEnv,
      customAdmin: mockAdmin,
    });

    expect(result.expiredCount).toBe(1);
    expect(result.deletedCount).toBe(1);
    expect(deleteSpy).toHaveBeenCalled();
  });
});

describe("Demo Intelligence — Status Reporting", () => {
  const baseValidEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NODE_ENV: "development",
    DEMO_SEED_ALLOWED: "true",
    DEMO_USER_PASSWORD: "ValidPassword123!",
  };

  it("calculates metrics and formats active demo summary", async () => {
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "org-demo-1",
                  slug: "clinica-sonrisa-bogota",
                  display_name: "🇨🇴 Clínica Sonrisa Bogotá",
                  settings: { demo: true, demo_expires_at: new Date(Date.now() + 5 * 86400000).toISOString() },
                  created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
                },
              ],
              error: null,
            }),
          };
        }
        if (table === "user_organizations") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 4, error: null }) }) };
        }
        if (table === "contacts") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 25, error: null }) }) };
        }
        if (table === "calendar_appointments") {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 8, error: null }) }) };
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ count: 0, error: null }) }) };
      }),
    } as unknown as SupabaseClient;

    const items = await getDemoStatus({
      customEnv: baseValidEnv,
      customAdmin: mockAdmin,
      silent: true,
    });

    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("🇨🇴 Clínica Sonrisa Bogotá");
    expect(items[0]!.usersCount).toBe(4);
    expect(items[0]!.contactsCount).toBe(25);
    expect(items[0]!.appointmentsCount).toBe(8);
    expect(items[0]!.createdAgo).toBe("2 days ago");
    expect(items[0]!.expiresIn).toBe("5 days");
  });

  it("formats relative times correctly", () => {
    const now = new Date();
    expect(formatCreatedAgo(now.toISOString())).toBe("Just now");

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatCreatedAgo(twoDaysAgo)).toBe("2 days ago");

    const fiveDaysFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatExpiresIn(fiveDaysFuture)).toBe("5 days");

    const expiredPast = new Date(Date.now() - 1000).toISOString();
    expect(formatExpiresIn(expiredPast)).toBe("Expired");
  });
});
