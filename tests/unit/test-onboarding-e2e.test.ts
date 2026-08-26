// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerRetratoDaInstalacao } from "@/lib/instalacao/retrato";
import { PROVEDORES } from "@/lib/ai/pontos/provedores";

describe("Onboarding AI Provider & Model Switching E2E", () => {
  const admin = createAdminClient();

  it("1. verifies canonical providers list exposed to UI", () => {
    const ids = PROVEDORES.map((p) => p.id);
    expect(ids).toEqual([
      "anthropic",
      "openai",
      "google",
      "openrouter",
      "opencode_zen",
      "deepseek",
    ]);
  });

  it("2. verifies installation fallback precedence on organization portrait", async () => {
    // Buscar primeira organização existente
    const { data: org } = await admin
      .from("organizations")
      .select("id, settings")
      .limit(1)
      .single();

    if (!org) {
      console.log("Nenhuma organização encontrada para o teste, pulando checagem de banco.");
      return;
    }

    // 1. Quando settings.llm tem opencode_zen
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

    const retratoZen = await lerRetratoDaInstalacao({
      supabase: admin,
      orgId: org.id,
    });

    expect(retratoZen.inteligencia.provedor).toBe("opencode_zen");
    expect(retratoZen.inteligencia.modeloCurado).toBe("mimo-v2.5-free");
    expect(retratoZen.inteligencia.origemDaChave).toBe("instalacao");

    // 2. Quando a org muda para deepseek (com fallback de instalação ou sem chave)
    await admin
      .from("organizations")
      .update({
        settings: {
          llm: {
            provider: "deepseek",
            default_model: "deepseek-v4-flash",
          },
        },
      })
      .eq("id", org.id);

    const retratoDeepSeek = await lerRetratoDaInstalacao({
      supabase: admin,
      orgId: org.id,
    });

    expect(retratoDeepSeek.inteligencia.provedor).toBe("deepseek");
    expect(retratoDeepSeek.inteligencia.modeloCurado).toBe("deepseek-v4-flash");

    // 3. Restaurar para opencode_zen
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
});
