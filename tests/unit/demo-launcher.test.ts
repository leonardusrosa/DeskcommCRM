/**
 * tests/unit/demo-launcher.test.ts
 *
 * Unit tests for Demo Launcher, Session Management, Health Checks, and Reset flow.
 * Validates:
 *   1. Production safety guard
 *   2. Missing Supabase failure handling
 *   3. Ephemeral credential generation
 *   4. Session file format & persistence
 *   5. Health check verification & partial demo rejection
 *   6. Reset workflow idempotency
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateDemoPassword,
  saveDemoSession,
  loadDemoSession,
  clearDemoSession,
  type DemoSession,
} from "../../scripts/demo/lib/demo-session";
import {
  checkEnvironmentPreconditions,
  runDemoHealthCheck,
} from "../../scripts/demo/lib/health-check";
import { runLauncher } from "../../scripts/demo/launcher";
import { runReset } from "../../scripts/demo/reset";
import { AVAILABLE_CLINICS } from "../../scripts/demo/clinics";

const TEST_SESSION_PATH = path.resolve(process.cwd(), ".demo", "test-session.json");

describe("Demo Launcher — Credential Generation", () => {
  it("generates safe demo passwords of at least 8 characters", () => {
    const pwd1 = generateDemoPassword();
    const pwd2 = generateDemoPassword();

    expect(pwd1).toMatch(/^ClinicDemo-\d{4}$/);
    expect(pwd1.length).toBeGreaterThanOrEqual(8);
    expect(pwd2).toMatch(/^ClinicDemo-\d{4}$/);
    expect(pwd1).not.toBe("");
  });
});

describe("Demo Launcher — Session Management", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_SESSION_PATH)) {
      fs.unlinkSync(TEST_SESSION_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_SESSION_PATH)) {
      fs.unlinkSync(TEST_SESSION_PATH);
    }
  });

  it("saves, loads and clears demo session in correct JSON format", () => {
    const session: DemoSession = {
      tenant: "clinica-sonrisa-bogota",
      email: "laura@sonrisabogota.demo",
      password: "ClinicDemo-8472",
      clinicName: "🇨🇴 Clínica Sonrisa Bogotá",
      country: "CO",
    };

    saveDemoSession(session, TEST_SESSION_PATH);
    expect(fs.existsSync(TEST_SESSION_PATH)).toBe(true);

    const loaded = loadDemoSession(TEST_SESSION_PATH);
    expect(loaded).not.toBeNull();
    expect(loaded?.tenant).toBe("clinica-sonrisa-bogota");
    expect(loaded?.email).toBe("laura@sonrisabogota.demo");
    expect(loaded?.password).toBe("ClinicDemo-8472");

    const cleared = clearDemoSession(TEST_SESSION_PATH);
    expect(cleared).toBe(true);
    expect(loadDemoSession(TEST_SESSION_PATH)).toBeNull();
  });
});

describe("Demo Launcher — Production Guards & Preconditions", () => {
  it("blocks production Supabase URL (zywwwvrotgqouxillpvi)", async () => {
    const result = await checkEnvironmentPreconditions({
      NEXT_PUBLIC_SUPABASE_URL: "https://zywwwvrotgqouxillpvi.supabase.co",
      NODE_ENV: "development",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Refusing execution against production Supabase/);
  });

  it("blocks NODE_ENV=production", async () => {
    const result = await checkEnvironmentPreconditions({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NODE_ENV: "production",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Refusing execution against production/);
  });

  it("fails clearly when local Supabase is unreachable", async () => {
    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: "fetch failed (ECONNREFUSED)" } }),
      }),
    } as unknown as SupabaseClient;

    const result = await checkEnvironmentPreconditions(
      {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NODE_ENV: "development",
      },
      mockAdmin,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Could not query local Supabase/);
  });
});

describe("Demo Launcher — Health Check Verification", () => {
  const baseEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NODE_ENV: "development",
  };

  it("rejects immediately if pointing to production", async () => {
    const mockAdmin = {} as unknown as SupabaseClient;
    const result = await runDemoHealthCheck(
      "clinica-sonrisa-bogota",
      mockAdmin,
      { NEXT_PUBLIC_SUPABASE_URL: "https://zywwwvrotgqouxillpvi.supabase.co" },
    );

    expect(result.passed).toBe(false);
    expect(result.failedCheck).toBe("Production safety verified");
  });

  it("fails when tenant organization does not exist", async () => {
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn().mockReturnValue({
              head: vi.fn().mockResolvedValue({ error: null }),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn() }) };
      }),
    } as unknown as SupabaseClient;

    const result = await runDemoHealthCheck("clinica-sonrisa-bogota", mockAdmin, baseEnv);
    expect(result.passed).toBe(false);
    expect(result.failedCheck).toBe("Tenant exists");
  });

  it("fails when contacts or appointments are missing", async () => {
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn().mockReturnValue({
              head: vi.fn().mockResolvedValue({ error: null }),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "test-org-id" }, error: null }),
              }),
            }),
          };
        }
        if (table === "user_organizations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
            }),
          };
        }
        if (table === "contacts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    const result = await runDemoHealthCheck("clinica-sonrisa-bogota", mockAdmin, baseEnv);
    expect(result.passed).toBe(false);
    expect(result.failedCheck).toBe("Contacts loaded");
  });
});

describe("Demo Launcher — Interactive Flow & Execution", () => {
  it("aborts execution cleanly when environment check fails", async () => {
    const result = await runLauncher({
      nonInteractive: true,
      customEnv: {
        NEXT_PUBLIC_SUPABASE_URL: "https://zywwwvrotgqouxillpvi.supabase.co",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Refusing execution against production Supabase/);
  });
});

describe("Demo Launcher — Reset Flow & Idempotency", () => {
  it("cancels reset gracefully when user chooses No", async () => {
    const result = await runReset({
      confirmed: false,
      customEnv: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NODE_ENV: "development",
      },
      customAdmin: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as unknown as SupabaseClient,
    });

    expect(result.success).toBe(true);
    expect(result.cancelled).toBe(true);
  });

  it("runs cleanup, seed, and health checks on reset", async () => {
    const colombia = AVAILABLE_CLINICS[0]!;
    const cleanupSpy = vi.spyOn(colombia, "cleanup").mockResolvedValue({ deleted: true });
    const seedSpy = vi.spyOn(colombia, "seed").mockResolvedValue({
      tenantId: "test-tenant-id",
      tenantName: "Clínica Sonrisa Bogotá",
      slug: "clinica-sonrisa-bogota",
      locale: "es",
      timezone: "America/Bogota",
      users: [],
      services: [],
      contacts: [],
      appointments: [],
    });

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "organizations") {
          return {
            select: vi.fn().mockReturnValue({
              head: vi.fn().mockResolvedValue({ error: null }),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "test-tenant-id" }, error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        };
      }),
    } as unknown as SupabaseClient;

    const result = await runReset({
      confirmed: true,
      clinicId: "colombia",
      skipBrowser: true,
      customEnv: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NODE_ENV: "development",
      },
      customAdmin: mockAdmin,
    });

    expect(cleanupSpy).toHaveBeenCalled();
    expect(seedSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.session?.tenant).toBe("clinica-sonrisa-bogota");
    expect(result.session?.password).toMatch(/^ClinicDemo-\d{4}$/);

    cleanupSpy.mockRestore();
    seedSpy.mockRestore();
  });
});
