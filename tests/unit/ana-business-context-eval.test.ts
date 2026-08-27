// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildAgentSystemContext } from "@/lib/ai/context/business-context";

describe("Regressão da Agente Ana — Grounding Factual de Contexto de Negócio", () => {
  it("garante que o prompt final fornecido à Ana contém os fatos de negócio da Autocora sem alterar seu system_prompt original", () => {
    // Exact historical system_prompt of Ana from production ai_agent_versions
    const anaOriginalSystemPrompt =
      "Você é a Ana, assistente virtual da Autocora. Responda com simpatia, clareza e de forma objetiva.";

    // Organization data configured canonically
    const org = {
      display_name: "Autocora",
      timezone: "America/Sao_Paulo",
      settings: {
        business_profile: {
          description: "Automações e landing pages",
        },
      },
      onboarding_state: {
        welcome: {
          display_name: "Autocora",
          o_que_faz: "Automações e landing pages",
          timezone: "America/Sao_Paulo",
        },
      },
    };

    const assembledSystemPrompt = buildAgentSystemContext({
      displayName: org.display_name,
      timezone: org.timezone,
      businessProfile: org.settings.business_profile,
      onboardingOQueFaz: org.onboarding_state.welcome.o_que_faz,
      agentInstructions: anaOriginalSystemPrompt,
    });

    // 1. O system_prompt da Ana permanece inalterado dentro da seção de instruções
    expect(assembledSystemPrompt).toContain(anaOriginalSystemPrompt);

    // 2. O contexto factual da organização é injetado com alta visibilidade
    expect(assembledSystemPrompt).toContain("[CONTEXTO DO NEGÓCIO — DADOS DE REFERÊNCIA]");
    expect(assembledSystemPrompt).toContain("Empresa: Autocora");
    expect(assembledSystemPrompt).toContain("O que faz: Automações e landing pages");

    // 3. Fatos automotivos NÃO existem no prompt
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("veículos");
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("concessionária");
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("carros");

    // 4. Se o usuário perguntar "oi oq vcs fazem?", o prompt oferece a resposta factual sem necessidade de RAG
    expect(assembledSystemPrompt).toMatch(/O que faz:\s*Automações e landing pages/);
  });
});