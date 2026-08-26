// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerRetratoDaInstalacao } from "@/lib/instalacao/retrato";
import { montarOpcoesDeRaciocinio } from "@/lib/ai/raciocinio/adapter";

describe("Reasoning Effort Integration & Persistence", () => {
  const admin = createAdminClient();

  it("1. verifies persistence and portrait resolution with reasoning effort override", async () => {
    const { data: org } = await admin
      .from("organizations")
      .select("id, settings")
      .limit(1)
      .single();

    if (!org) return;

    // 1. Configura GPT-5 com reasoning_effort = high
    await admin
      .from("organizations")
      .update({
        settings: {
          llm: {
            provider: "opencode_zen",
            default_model: "gpt-5.4-orion",
            reasoning_effort: "high",
            params: {
              reasoning_effort: "high",
            },
          },
        },
      })
      .eq("id", org.id);

    const retratoHigh = await lerRetratoDaInstalacao({
      supabase: admin,
      orgId: org.id,
    });

    expect(retratoHigh.inteligencia.provedor).toBe("opencode_zen");
    expect(retratoHigh.inteligencia.modeloCurado).toBe("gpt-5.4-orion");
    expect(retratoHigh.inteligencia.suportaRaciocinio).toBe(true);
    expect(retratoHigh.inteligencia.raciocinio).toBe("high");

    // 2. Troca para modelo não-raciocínio (mimo-v2.5-free) -> suportaRaciocinio vira false, raciocinio vira null
    await admin
      .from("organizations")
      .update({
        settings: {
          llm: {
            provider: "opencode_zen",
            default_model: "mimo-v2.5-free",
          },
        },
      })
      .eq("id", org.id);

    const retratoMimo = await lerRetratoDaInstalacao({
      supabase: admin,
      orgId: org.id,
    });

    expect(retratoMimo.inteligencia.provedor).toBe("opencode_zen");
    expect(retratoMimo.inteligencia.modeloCurado).toBe("mimo-v2.5-free");
    expect(retratoMimo.inteligencia.suportaRaciocinio).toBe(false);
    expect(retratoMimo.inteligencia.raciocinio).toBeNull();

    // 3. Restaura configuração padrão
    await admin
      .from("organizations")
      .update({
        settings: {
          llm: {
            provider: "opencode_zen",
            default_model: "mimo-v2.5-free",
          },
        },
      })
      .eq("id", org.id);
  });

  it("2. verifies wire option mounting for different providers and models", () => {
    // OpenAI o1
    const o1Low = montarOpcoesDeRaciocinio("openai", "o1", "low");
    expect(o1Low.providerOptions).toEqual({ openai: { reasoningEffort: "low" } });

    // OpenCode Zen DeepSeek R1
    const zenR1 = montarOpcoesDeRaciocinio("opencode_zen", "deepseek-r1", "medium");
    expect(zenR1.providerOptions).toEqual({ openai: { reasoningEffort: "medium" } });

    // Anthropic Claude 3.7
    const claudeMedium = montarOpcoesDeRaciocinio("anthropic", "claude-3-7-sonnet", "medium");
    expect(claudeMedium.providerOptions).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 4096 } },
    });
  });
});
