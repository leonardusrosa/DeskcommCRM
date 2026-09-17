/**
 * tests/unit/demo-experience.test.ts
 *
 * Unit tests for Demo Experience layer:
 *   1. Dental Clinic Profiles integrity (CO, MX, ES, PT)
 *   2. Scenario data contracts (inbox, 6-stage pipeline, appointments)
 *   3. Demo Login Helper (safe credential display)
 *   4. Fast Reset (demo:fresh) workflow
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DENTAL_CLINIC_PROFILES,
} from "../../scripts/demo/profiles";
import { showDemoLogin } from "../../scripts/demo/login";
import { runFresh } from "../../scripts/demo/fresh";
import { saveDemoSession } from "../../scripts/demo/lib/demo-session";
import { AVAILABLE_CLINICS } from "../../scripts/demo/clinics";

describe("Demo Profiles — Dental Clinic Catalog", () => {
  it("includes all 4 required countries (Colombia, Mexico, Spain, Portugal)", () => {
    expect(DENTAL_CLINIC_PROFILES).toHaveLength(4);
    const ids = DENTAL_CLINIC_PROFILES.map((p) => p.country);
    expect(ids).toEqual(["CO", "MX", "ES", "PT"]);
  });

  it("each profile defines organization name, language, timezone, and scenario", () => {
    for (const profile of DENTAL_CLINIC_PROFILES) {
      expect(profile.orgName).toBeTruthy();
      expect(profile.slug).toBeTruthy();
      expect(profile.language).toMatch(/^(es|pt)$/);
      expect(profile.timezone).toMatch(/^(America|Europe)\//);
      expect(profile.scenario.title).toBeTruthy();
      expect(profile.scenario.keyHighlights.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("each dental clinic has the required 6 pipeline stages", () => {
    for (const profile of DENTAL_CLINIC_PROFILES) {
      expect(profile.pipeline.stages).toHaveLength(6);
      const stageSlugs = profile.pipeline.stages.map((s) => s.slug);
      expect(stageSlugs).toEqual([
        "nuevo_contacto",
        "primera_conversacion",
        "interesado",
        "consulta_agendada",
        "tratamiento_vendido",
        "paciente_recurrente",
      ]);
    }
  });

  it("each profile has 3 contacts matching required inbox scenarios", () => {
    for (const profile of DENTAL_CLINIC_PROFILES) {
      expect(profile.contacts).toHaveLength(3);

      const [c1, c2, c3] = profile.contacts;
      // 1. New inquiry
      expect(c1!.stageSlug).toBe("nuevo_contacto");
      expect(c1!.conversationMessages.length).toBeGreaterThanOrEqual(2);

      // 2. Active negotiation
      expect(c2!.stageSlug).toBe("interesado");
      expect(c2!.conversationMessages.length).toBeGreaterThanOrEqual(2);

      // 3. Existing patient
      expect(c3!.stageSlug).toBe("paciente_recurrente");
      expect(c3!.conversationMessages.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("each profile has at least 3 future appointments and 1 completed appointment across different providers", () => {
    for (const profile of DENTAL_CLINIC_PROFILES) {
      const appts = profile.appointments;
      expect(appts.length).toBeGreaterThanOrEqual(4);

      const futureAppts = appts.filter((a) => a.daysOffset > 0);
      const completedAppts = appts.filter((a) => a.status === "completed");
      expect(futureAppts.length).toBeGreaterThanOrEqual(3);
      expect(completedAppts.length).toBeGreaterThanOrEqual(1);

      const providers = new Set(appts.map((a) => a.providerKey));
      expect(providers.size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("Demo Login Helper (pnpm demo:login)", () => {
  const TEST_SESSION_FILE = path.resolve(process.cwd(), ".demo", "test_experience_session.json");

  beforeEach(() => {
    if (fs.existsSync(TEST_SESSION_FILE)) {
      fs.unlinkSync(TEST_SESSION_FILE);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_SESSION_FILE)) {
      fs.unlinkSync(TEST_SESSION_FILE);
    }
  });

  it("handles missing session gracefully without crashing", async () => {
    const result = await showDemoLogin({ skipBrowserPrompt: true, customSessionPath: TEST_SESSION_FILE });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No active demo session found/);
  });

  it("displays credentials when active demo session exists", async () => {
    saveDemoSession({
      tenant: "clinica-sonrisa-bogota",
      email: "laura@sonrisabogota.demo",
      password: "ClinicDemo-8472",
      clinicName: "🇨🇴 Clínica Sonrisa Bogotá",
    }, TEST_SESSION_FILE);

    const result = await showDemoLogin({ skipBrowserPrompt: true, customSessionPath: TEST_SESSION_FILE });
    expect(result.success).toBe(true);
    expect(result.session?.email).toBe("laura@sonrisabogota.demo");
    expect(result.session?.password).toBe("ClinicDemo-8472");
  });

  it("strictly blocks exposing non-demo or production sessions", async () => {
    saveDemoSession({
      tenant: "real-prod-organization",
      email: "owner@company.com",
      password: "SuperSecretProductionPassword!",
    }, TEST_SESSION_FILE);

    const result = await showDemoLogin({ skipBrowserPrompt: true, customSessionPath: TEST_SESSION_FILE });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Safety violation/);
  });
});

describe("Fast Reset (pnpm demo:fresh)", () => {
  it("runs fresh reset workflow and updates credentials without interactive prompts", async () => {
    const targetClinic = AVAILABLE_CLINICS[0]!;
    const cleanupSpy = vi.spyOn(targetClinic, "cleanup").mockResolvedValue({ deleted: true });
    const seedSpy = vi.spyOn(targetClinic, "seed").mockResolvedValue({
      tenantId: "fresh-tenant-id",
      tenantName: targetClinic.name,
      slug: targetClinic.slug,
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
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "fresh-tenant-id" }, error: null }),
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

    const result = await runFresh({
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
    expect(result.session?.password).toMatch(/^ClinicDemo-\d{4}$/);

    cleanupSpy.mockRestore();
    seedSpy.mockRestore();
  });
});
