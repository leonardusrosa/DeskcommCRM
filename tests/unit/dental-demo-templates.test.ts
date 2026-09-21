import { afterEach, describe, expect, it, vi } from "vitest";
import { DENTAL_DEMO_CATALOG } from "@/lib/demo/catalog";
import { assertDemoProvisioningAllowed } from "@/lib/demo/safety";
import { isExpiredDemoSettings } from "@/lib/demo/expiry";
import { createDemoUsers } from "@/lib/demo/provision-core";
import { DENTAL_DEMO_TEMPLATES, getDentalDemoTemplate } from "@/lib/demo/templates";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";
import { FUSOS_OFERECIDOS } from "@/lib/tempo/fusos";
import { localeDeData, tagDeIdioma } from "@/lib/i18n/datas";
import { readFileSync } from "node:fs";

describe("dental demo templates — lead readiness", () => {
  it("ships exactly the four target-market dental templates", () => {
    expect(DENTAL_DEMO_TEMPLATES.map((template) => template.country).sort()).toEqual([
      "CO",
      "ES",
      "MX",
      "PT",
    ]);
    expect(DENTAL_DEMO_CATALOG.map((profile) => profile.country).sort()).toEqual([
      "CO",
      "ES",
      "MX",
      "PT",
    ]);
  });

  it.each(DENTAL_DEMO_TEMPLATES)(
    "$country has enough synthetic content to demonstrate Inbox, CRM and Agenda",
    (template) => {
      expect(template.users.length).toBeGreaterThanOrEqual(3);
      expect(template.users.some((user) => user.role === "admin")).toBe(true);
      expect(template.users.some((user) => user.key === "operator")).toBe(true);
      expect(template.services.length).toBeGreaterThanOrEqual(4);
      expect(template.pipeline.stages.length).toBeGreaterThanOrEqual(5);
      expect(template.contacts.length).toBeGreaterThanOrEqual(3);
      expect(template.contacts.every((contact) => contact.conversationMessages.length > 0)).toBe(true);
      expect(template.appointments.length).toBeGreaterThanOrEqual(3);
      expect(template.contacts.every((contact) => /^\+\d{8,15}$/.test(contact.phoneNumber))).toBe(true);
    },
  );

  it("catalog copy does not advertise clinical/PMS/Google capabilities as included", () => {
    const publicCopy = JSON.stringify(DENTAL_DEMO_CATALOG).toLowerCase();
    const forbiddenClaims = [
      "historia clínica",
      "ficha clínica",
      "odontograma",
      "radiología integrada",
      "google calendar sincronizado",
      "pms integrado",
      "newsoft",
      "gesden",
      "datos clínicos reales",
    ];
    for (const claim of forbiddenClaims) expect(publicCopy).not.toContain(claim);
    expect(publicCopy).toContain("sintét");
  });

  it("country profiles carry the expected locale, timezone and currency", () => {
    expect(getDentalDemoTemplate("CO")).toMatchObject({
      locale: "es",
      timezone: "America/Bogota",
      currency: "COP",
    });
    expect(getDentalDemoTemplate("MX")).toMatchObject({
      locale: "es",
      timezone: "America/Mexico_City",
      currency: "MXN",
    });
    expect(getDentalDemoTemplate("ES")).toMatchObject({
      locale: "es",
      timezone: "Europe/Madrid",
      currency: "EUR",
    });
    expect(getDentalDemoTemplate("PT")).toMatchObject({
      locale: "pt-PT",
      timezone: "Europe/Lisbon",
      currency: "EUR",
    });
  });

  it("offers target-market timezones", () => {
    const zones = FUSOS_OFERECIDOS.map((item) => item.codigo);
    expect(zones).toEqual(expect.arrayContaining([
      "America/Bogota",
      "America/Mexico_City",
      "Europe/Madrid",
      "Europe/Lisbon",
    ]));

    const profileForm = readFileSync("app/app/settings/profile/_form.tsx", "utf8");
    expect(profileForm).toContain("FUSOS_OFERECIDOS");
  });

  it("normalizes regional locales and exposes pt-PT high-visibility vocabulary", () => {
    expect(normalizarIdioma("es-CO")).toBe("es");
    expect(normalizarIdioma("es-MX")).toBe("es");
    expect(normalizarIdioma("es-ES")).toBe("es");
    expect(normalizarIdioma("pt")).toBe("pt-BR");
    expect(normalizarIdioma("pt-PT")).toBe("pt-PT");
    expect(traduzir("Contatos", "pt-PT")).toBe("Contactos");
    expect(traduzir("Equipe", "pt-PT")).toBe("Equipa");
    expect(traduzir("Configurações", "pt-PT")).toBe("Definições");
    expect(tagDeIdioma("pt-PT")).toBe("pt-PT");
    expect(localeDeData("pt-PT").code).toBe("pt");
  });
  it("expires synthetic memberships at the advertised instant", () => {
    const now = Date.parse("2026-09-18T17:00:00.000Z");
    expect(isExpiredDemoSettings({ demo: true, demo_expires_at: "2026-09-18T16:59:59.000Z" }, now)).toBe(true);
    expect(isExpiredDemoSettings({ demo: true, demo_expires_at: "2026-09-18T17:00:01.000Z" }, now)).toBe(false);
    expect(isExpiredDemoSettings({ demo: false, demo_expires_at: "2020-01-01T00:00:00.000Z" }, now)).toBe(false);
  });

  it("keeps the capacity gate transactional in Postgres", () => {
    const migration = readFileSync(
      "supabase/migrations/20260921120000_0374_demo_capacity_atomica.sql",
      "utf8",
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("v_active >= 25");
    expect(migration).toContain("grant execute");
    expect(migration).toContain("to service_role");
  });

  it("channel health skips synthetic demo sessions before transport", () => {
    const route = readFileSync("app/api/v1/cron/channel-health/route.ts", "utf8");
    expect(route).toContain("metadata");
    expect(route).toContain("isSyntheticDemoChannelMetadata(s.metadata)");
  });

});

describe("dental demo partial-failure cleanup", () => {
  it("deletes auth users created before a membership failure", async () => {
    const deleted: string[] = [];
    let membershipInsert = 0;
    let created = 0;
    const admin = {
      auth: {
        admin: {
          createUser: vi.fn(async () => {
            created += 1;
            return { data: { user: { id: `demo-user-${created}` } }, error: null };
          }),
          deleteUser: vi.fn(async (id: string) => {
            deleted.push(id);
            return { data: null, error: null };
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table !== "user_organizations") throw new Error(`unexpected table ${table}`);
        return {
          insert: vi.fn(async () => {
            membershipInsert += 1;
            return membershipInsert === 2
              ? { error: { message: "membership failed" } }
              : { error: null };
          }),
        };
      }),
    };

    const template = getDentalDemoTemplate("CO")!;
    await expect(
      createDemoUsers(admin as never, "org-demo", template, "token", "password"),
    ).rejects.toThrow(/membership failed/i);

    expect(deleted).toEqual(["demo-user-1", "demo-user-2"]);
  });
});

describe("dental demo provisioning safety", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off by default", () => {
    vi.stubEnv("DEMO_PROVISIONING_ENABLED", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo-project.supabase.co");
    expect(() => assertDemoProvisioningAllowed()).toThrow(/disabled/i);
  });

  it("refuses the production Supabase even when explicitly enabled", () => {
    vi.stubEnv("DEMO_PROVISIONING_ENABLED", "true");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://zywwwvrotgqouxillpvi.supabase.co",
    );
    expect(() => assertDemoProvisioningAllowed()).toThrow(/production Supabase/i);
  });

  it("allows an explicitly enabled isolated demo project", () => {
    vi.stubEnv("DEMO_PROVISIONING_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isolated-demo.supabase.co");
    vi.stubEnv("SUPABASE_DB_URL", "");
    expect(() => assertDemoProvisioningAllowed()).not.toThrow();
  });
});
