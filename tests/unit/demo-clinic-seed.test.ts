/**
 * tests/unit/demo-clinic-seed.test.ts
 *
 * Unit tests for Demo Tenant Factory (Clínica Sonrisa Bogotá 🇨🇴).
 * Validates:
 *  - Production guard & safety requirements
 *  - Idempotency & no duplicate tenants
 *  - Team availability & break specifications
 *  - Pipeline stages and appointment types
 *  - Cleanup workflow
 */

import { describe, expect, it, vi } from "vitest";
import { assertSafetyGuards } from "../../scripts/demo/lib/guards";
import { buildClinicScheduleWindows } from "../../scripts/demo/lib/provision-availability";
import { DEMO_SERVICES_SPECS } from "../../scripts/demo/lib/provision-services";
import { DEMO_STAGES_SPECS } from "../../scripts/demo/lib/provision-pipeline";
import { ensureDemoOrg } from "../../scripts/demo/lib/provision-org-users";
import { runClinicCleanup } from "../../scripts/demo/cleanup-demo-clinic";
import {
  DEMO_CLINIC_SLUG,
  DEMO_CLINIC_NAME,
  DEMO_CLINIC_COUNTRY,
  DEMO_CLINIC_LOCALE,
  DEMO_CLINIC_TIMEZONE,
} from "../../scripts/demo/lib/types";

describe("Demo Clinic Factory — Safety Guards", () => {
  const baseValidEnv: Record<string, string> = {
    DEMO_SEED_ALLOWED: "true",
    NODE_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "dummy-service-role-key-test-only",
    SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    DEMO_USER_PASSWORD: "SuperSecretPassword123!",
  };

  it("throws if DEMO_SEED_ALLOWED is not true", () => {
    expect(() => assertSafetyGuards({ ...baseValidEnv, DEMO_SEED_ALLOWED: "false" })).toThrowError(
      /DEMO_SEED_ALLOWED must be explicitly set to 'true'/,
    );
    expect(() => assertSafetyGuards({ ...baseValidEnv, DEMO_SEED_ALLOWED: undefined })).toThrowError(
      /DEMO_SEED_ALLOWED must be explicitly set to 'true'/,
    );
  });

  it("throws if NODE_ENV is production", () => {
    expect(() => assertSafetyGuards({ ...baseValidEnv, NODE_ENV: "production" })).toThrowError(
      /strictly prohibited when NODE_ENV=production/,
    );
  });

  it("throws if Supabase URL targets production (zywwwvrotgqouxillpvi)", () => {
    expect(() =>
      assertSafetyGuards({
        ...baseValidEnv,
        NEXT_PUBLIC_SUPABASE_URL: "https://zywwwvrotgqouxillpvi.supabase.co",
      }),
    ).toThrowError(/Refusing execution against production Supabase/);
  });

  it("throws if Supabase DB URL targets production (zywwwvrotgqouxillpvi)", () => {
    expect(() =>
      assertSafetyGuards({
        ...baseValidEnv,
        SUPABASE_DB_URL: "postgresql://postgres.zywwwvrotgqouxillpvi:secret@pooler.supabase.com:5432/postgres",
      }),
    ).toThrowError(/Refusing execution against production Supabase/);
  });

  it("throws if DEMO_USER_PASSWORD is missing or too short", () => {
    expect(() =>
      assertSafetyGuards({
        ...baseValidEnv,
        DEMO_USER_PASSWORD: "",
      }),
    ).toThrowError(/DEMO_USER_PASSWORD .* is required/);

    expect(() =>
      assertSafetyGuards({
        ...baseValidEnv,
        DEMO_USER_PASSWORD: "123",
      }),
    ).toThrowError(/DEMO_USER_PASSWORD .* is required/);
  });

  it("returns verified context when all safety checks pass", () => {
    const ctx = assertSafetyGuards(baseValidEnv);
    expect(ctx.supabaseUrl).toBe("http://127.0.0.1:54321");
    expect(ctx.userPassword).toBe("SuperSecretPassword123!");
    expect(ctx.serviceRoleKey).toBe("dummy-service-role-key-test-only");
  });
});

describe("Demo Clinic Factory — Domain Specifications", () => {
  it("defines correct tenant metadata", () => {
    expect(DEMO_CLINIC_SLUG).toBe("clinica-sonrisa-bogota");
    expect(DEMO_CLINIC_NAME).toBe("Clínica Sonrisa Bogotá");
    expect(DEMO_CLINIC_COUNTRY).toBe("CO");
    expect(DEMO_CLINIC_LOCALE).toBe("es");
    expect(DEMO_CLINIC_TIMEZONE).toBe("America/Bogota");
  });

  it("builds correct availability windows with lunch break and saturday hours", () => {
    const windows = buildClinicScheduleWindows();

    // Monday (1) to Friday (5) should have 2 windows each: 08:00-12:30 and 14:00-18:00
    for (let dow = 1; dow <= 5; dow++) {
      const morning = windows.find((w) => w.dow === dow && w.start === "08:00");
      const afternoon = windows.find((w) => w.dow === dow && w.start === "14:00");

      expect(morning).toBeDefined();
      expect(morning?.end).toBe("12:30");

      expect(afternoon).toBeDefined();
      expect(afternoon?.end).toBe("18:00");
    }

    // Saturday (6) should be 09:00-13:00
    const saturday = windows.find((w) => w.dow === 6);
    expect(saturday).toBeDefined();
    expect(saturday?.start).toBe("09:00");
    expect(saturday?.end).toBe("13:00");

    // Sunday (0) should have NO windows (closed)
    const sunday = windows.find((w) => w.dow === 0);
    expect(sunday).toBeUndefined();

    // Total windows: 5 days * 2 + 1 saturday = 11 windows
    expect(windows).toHaveLength(11);
  });

  it("includes all 5 required dental services with exact durations", () => {
    expect(DEMO_SERVICES_SPECS).toHaveLength(5);

    const expected = [
      { name: "Consulta inicial", duration: 30 },
      { name: "Limpieza dental", duration: 60 },
      { name: "Blanqueamiento dental", duration: 90 },
      { name: "Implante dental", duration: 120 },
      { name: "Control post tratamiento", duration: 30 },
    ];

    for (const exp of expected) {
      const found = DEMO_SERVICES_SPECS.find((s) => s.name === exp.name);
      expect(found).toBeDefined();
      expect(found?.durationMinutes).toBe(exp.duration);
    }
  });

  it("includes all 6 required pipeline stages in strict sequential order", () => {
    expect(DEMO_STAGES_SPECS).toHaveLength(6);

    const stageNames = DEMO_STAGES_SPECS.map((s) => s.name);
    expect(stageNames).toEqual([
      "Nuevo contacto",
      "Primera conversación",
      "Interesado",
      "Consulta agendada",
      "Tratamiento vendido",
      "Paciente recurrente",
    ]);

    const wonStage = DEMO_STAGES_SPECS.find((s) => s.slug === "tratamiento_vendido");
    expect(wonStage?.isWon).toBe(true);
  });
});

describe("Demo Clinic Factory — Idempotency and Cleanup", () => {
  it("ensureDemoOrg updates existing tenant without creating duplicates", async () => {
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const mockInsert = vi.fn();
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "org-existing-uuid" }, error: null }),
      }),
    });

    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
        insert: mockInsert,
      }),
    } as unknown as Parameters<typeof ensureDemoOrg>[0];

    const orgId = await ensureDemoOrg(mockAdmin);

    expect(orgId).toBe("org-existing-uuid");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("runClinicCleanup handles non-existent tenant gracefully", async () => {
    const validEnv = {
      DEMO_SEED_ALLOWED: "true",
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "dummy-key",
      DEMO_USER_PASSWORD: "Password123!",
    };

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as unknown as Parameters<typeof runClinicCleanup>[1];

    const result = await runClinicCleanup(validEnv, mockAdmin);
    expect(result.deleted).toBe(false);
  });

  it("runClinicCleanup deletes child records and tenant when tenant exists", async () => {
    const validEnv = {
      DEMO_SEED_ALLOWED: "true",
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "dummy-key",
      DEMO_USER_PASSWORD: "Password123!",
    };

    const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "org-to-delete-uuid" }, error: null }),
      }),
    });

    const mockAdmin = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        delete: mockDelete,
      }),
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
          deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
        },
      },
    } as unknown as Parameters<typeof runClinicCleanup>[1];

    const result = await runClinicCleanup(validEnv, mockAdmin);
    expect(result.deleted).toBe(true);
    expect(result.tenantId).toBe("org-to-delete-uuid");
    expect(mockDelete).toHaveBeenCalled();
  });
});
