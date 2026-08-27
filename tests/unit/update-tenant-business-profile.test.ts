// @vitest-environment node
import { describe, expect, it } from "vitest";
import { tenantSchema } from "@/lib/schemas/settings";

describe("updateTenant — Semântica de omissão, null e string em business_profile_description", () => {
  const currentSettings = {
    branding: { app_name: "Deskcomm" },
    lost_reasons_extra: ["preço"],
    business_profile: {
      description: "Automações e landing pages",
      industry: "Tecnologia",
      website: "https://autocora.com.br",
    },
  };

  function applyUpdateLogic(
    settings: typeof currentSettings,
    parsedDescription: string | null | undefined,
  ) {
    const currentBusinessProfile = settings.business_profile ?? {};
    const nextBusinessProfile = { ...currentBusinessProfile };
    if (parsedDescription !== undefined) {
      nextBusinessProfile.description =
        parsedDescription !== null ? parsedDescription.trim() || null : null;
    }
    return {
      ...settings,
      business_profile: nextBusinessProfile,
    };
  }

  it("A. quando omite business_profile_description, preserva a descrição existente exatamente", () => {
    const parsed = tenantSchema.parse({
      display_name: "Autocora",
      legal_name: "Autocora LTDA",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      media_retention_days: 90,
      // business_profile_description omitido
    });

    expect(parsed.business_profile_description).toBeUndefined();

    const result = applyUpdateLogic(currentSettings, parsed.business_profile_description);
    expect(result.business_profile.description).toBe("Automações e landing pages");
    expect(result.business_profile.industry).toBe("Tecnologia");
    expect(result.business_profile.website).toBe("https://autocora.com.br");
  });

  it("B. quando envia null (ou string vazia), zera a descrição", () => {
    const parsedNull = tenantSchema.parse({
      display_name: "Autocora",
      legal_name: "Autocora LTDA",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      media_retention_days: 90,
      business_profile_description: null,
    });
    expect(parsedNull.business_profile_description).toBeNull();
    const resultNull = applyUpdateLogic(currentSettings, parsedNull.business_profile_description);
    expect(resultNull.business_profile.description).toBeNull();
    expect(resultNull.business_profile.industry).toBe("Tecnologia"); // preserva outras chaves

    const parsedEmpty = tenantSchema.parse({
      display_name: "Autocora",
      legal_name: "Autocora LTDA",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      media_retention_days: 90,
      business_profile_description: "",
    });
    expect(parsedEmpty.business_profile_description).toBeNull();
    const resultEmpty = applyUpdateLogic(currentSettings, parsedEmpty.business_profile_description);
    expect(resultEmpty.business_profile.description).toBeNull();
  });

  it("C. quando envia string, faz trim e salva o novo valor", () => {
    const parsed = tenantSchema.parse({
      display_name: "Autocora",
      legal_name: "Autocora LTDA",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      media_retention_days: 90,
      business_profile_description: "  Nova descrição de produtos e serviços  ",
    });

    expect(parsed.business_profile_description).toBe("Nova descrição de produtos e serviços");

    const result = applyUpdateLogic(currentSettings, parsed.business_profile_description);
    expect(result.business_profile.description).toBe("Nova descrição de produtos e serviços");
    expect(result.business_profile.industry).toBe("Tecnologia");
  });
});