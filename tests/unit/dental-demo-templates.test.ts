import { afterEach, describe, expect, it, vi } from "vitest";
import { DENTAL_DEMO_CATALOG } from "@/lib/demo/catalog";
import { assertDemoProvisioningAllowed } from "@/lib/demo/safety";
import { DENTAL_DEMO_TEMPLATES, getDentalDemoTemplate } from "@/lib/demo/templates";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";
import { FUSOS_OFERECIDOS } from "@/lib/tempo/fusos";
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

  it("offers target-market timezones and the pt-PT profile option", () => {
    const zones = FUSOS_OFERECIDOS.map((item) => item.codigo);
    expect(zones).toEqual(expect.arrayContaining([
      "America/Bogota",
      "America/Mexico_City",
      "Europe/Madrid",
      "Europe/Lisbon",
    ]));

    const profileForm = readFileSync("app/app/settings/profile/_form.tsx", "utf8");
    expect(profileForm).toContain('value="pt-PT"');
    expect(profileForm).toContain("FUSOS_OFERECIDOS");
  });

  it("normalizes regional locales and exposes pt-PT high-visibility vocabulary", () => {
    expect(normalizarIdioma("es-CO")).toBe("es");
    expect(normalizarIdioma("es-MX")).toBe("es");
    expect(normalizarIdioma("es-ES")).toBe("es");
    expect(normalizarIdioma("pt")).toBe("pt-PT");
    expect(normalizarIdioma("pt-PT")).toBe("pt-PT");
    expect(traduzir("Contatos", "pt-PT")).toBe("Contactos");
    expect(traduzir("Equipe", "pt-PT")).toBe("Equipa");
    expect(traduzir("Configurações", "pt-PT")).toBe("Definições");
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
