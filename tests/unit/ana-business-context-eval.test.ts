// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildAgentSystemContext } from "@/lib/ai/context/business-context";

describe("Regressão da Agente Ana — Grounding Factual de Contexto de Negócio", () => {
  it("garante que o prompt final fornecido à Ana contém os fatos de negócio da Autocora sem alterar seu system_prompt original", () => {
    // Exact measured production values from incident investigation
    const anaMeasuredSystemPrompt =
      "Você atende os clientes de Autocora. Fale de forma objetiva, cordial e profissional. Vá direto ao ponto, sem parecer frio, e sempre termine indicando o próximo passo.";

    // Organization data configured canonically
    const org = {
      display_name: "Autocora",
      timezone: "UTC",
      settings: {
        business_profile: {
          description: "Automações e landing pages",
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

    const assembledSystemPrompt = buildAgentSystemContext({
      displayName: org.display_name,
      timezone: org.timezone,
      businessProfile: org.settings.business_profile,
      onboardingOQueFaz: org.onboarding_state.welcome.o_que_faz,
      agentInstructions: anaMeasuredSystemPrompt,
    });

    // 1. O system_prompt original da Ana permanece exatamente presente e inalterado dentro da seção de instruções
    expect(assembledSystemPrompt).toContain(anaMeasuredSystemPrompt);
    expect(assembledSystemPrompt.endsWith(`[INSTRUÇÕES DO AGENTE]\n${anaMeasuredSystemPrompt}`)).toBe(true);

    // 2. O contexto factual da organização é injetado com alta visibilidade e dados exatos
    expect(assembledSystemPrompt).toContain("[CONTEXTO DO NEGÓCIO — DADOS DE REFERÊNCIA]");
    expect(assembledSystemPrompt).toContain("Empresa: Autocora");
    expect(assembledSystemPrompt).toContain("O que faz: Automações e landing pages");
    expect(assembledSystemPrompt).toContain("Fuso horário: UTC");

    // 3. Fatos automotivos NÃO existem no prompt
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("veículos");
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("veiculo");
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("concessionária");
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("concessionaria");
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("carros");
    expect(assembledSystemPrompt.toLowerCase()).not.toContain("automotivo");

    // 4. Se o usuário perguntar "oi oq vcs fazem?", o prompt oferece a resposta factual diretamente sem necessidade de RAG
    expect(assembledSystemPrompt).toMatch(/O que faz:\s*Automações e landing pages/);
  });
});