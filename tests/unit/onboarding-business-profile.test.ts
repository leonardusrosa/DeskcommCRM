// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildAgentSystemContext } from "@/lib/ai/context/business-context";

describe("Onboarding Business Profile write & read contract", () => {
  it("extrai descrição do onboarding_state quando settings.business_profile está vazio", () => {
    const orgData = {
      display_name: "Autocora",
      timezone: "UTC",
      settings: {},
      onboarding_state: {
        welcome: {
          display_name: "Autocora",
          o_que_faz: "Automações e landing pages",
          timezone: "UTC",
        },
      },
    };

    const prompt = buildAgentSystemContext({
      displayName: orgData.display_name,
      timezone: orgData.timezone,
      businessProfile: (orgData.settings as { business_profile?: { description?: string } })?.business_profile,
      onboardingOQueFaz: orgData.onboarding_state.welcome.o_que_faz,
      agentInstructions: "Você atende os clientes de Autocora.",
    });

    expect(prompt).toContain("Empresa: Autocora");
    expect(prompt).toContain("O que faz: Automações e landing pages");
    expect(prompt).toContain("Fuso horário: UTC");
  });

  it("prioriza settings.business_profile.description sobre onboarding_state quando editado", () => {
    const orgData = {
      display_name: "Autocora",
      timezone: "America/Sao_Paulo",
      settings: {
        business_profile: {
          description: "Consultoria em IA e automações avançadas",
        },
      },
      onboarding_state: {
        welcome: {
          display_name: "Autocora",
          o_que_faz: "Automações e landing pages",
          timezone: "UTC",
        },
      },
    };

    const prompt = buildAgentSystemContext({
      displayName: orgData.display_name,
      timezone: orgData.timezone,
      businessProfile: orgData.settings.business_profile,
      onboardingOQueFaz: orgData.onboarding_state.welcome.o_que_faz,
      agentInstructions: "Você atende os clientes de Autocora.",
    });

    expect(prompt).toContain("O que faz: Consultoria em IA e automações avançadas");
    expect(prompt).not.toContain("Automações e landing pages");
  });
});