import { describe, expect, it } from "vitest";
import { tenantSchema } from "@/lib/schemas/settings";

describe("updateTenant — Semântica de omissão, null e string em business_profile_description", () => {
  const currentSettings: {
    business_profile?: {
      industry?: string;
      description?: string | null;
      website?: string;
    };
  } = {
    business_profile: {
      industry: "Tecnologia",
      description: "Descrição antiga",
      website: "https://example.com",
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
    const parsed = tenantSchema.partial().parse({
      display_name: "Autocora",
      legal_name: "Autocora LTDA",
    });

    expect(parsed.business_profile_description).toBeUndefined();
    const resultOmit = applyUpdateLogic(currentSettings, parsed.business_profile_description);
    expect(resultOmit.business_profile.description).toBe("Descrição antiga");
    expect(resultOmit.business_profile.website).toBe("https://example.com");
  });

  it("B. quando envia null (ou string vazia), zera a descrição", () => {
    const parsedNull = tenantSchema.partial().parse({
      display_name: "Autocora",
      legal_name: "Autocora LTDA",
      business_profile_description: null,
    });

    expect(parsedNull.business_profile_description).toBeNull();
    const resultNull = applyUpdateLogic(currentSettings, parsedNull.business_profile_description);
    expect(resultNull.business_profile.description).toBeNull();
    expect(resultNull.business_profile.industry).toBe("Tecnologia");
  });

  it("C. quando envia string, faz trim e salva o novo valor", () => {
    const parsedString = tenantSchema.partial().parse({
      display_name: "Autocora",
      legal_name: "Autocora LTDA",
      business_profile_description: "   Nova descrição da empresa   ",
    });

    expect(parsedString.business_profile_description).toBe("Nova descrição da empresa");
    const resultString = applyUpdateLogic(
      currentSettings,
      parsedString.business_profile_description,
    );
    expect(resultString.business_profile.description).toBe("Nova descrição da empresa");
  });
});
