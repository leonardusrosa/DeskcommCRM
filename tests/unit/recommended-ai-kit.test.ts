// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  bindingsDoKitRecomendado,
  ehKitPadrao,
  KIT_RECOMENDADO_V1,
  MODELOS_PADRAO_DO_KIT,
  modelosDoKitSalvo,
  modelosObrigatoriosDoKit,
  modelosOpenRouterDoKit,
  settingsComKitSalvo,
  SETTINGS_KEY_KIT_RECOMENDADO,
  type ModelosDoKitRecomendado,
} from "@/lib/ai/pontos/recommended-kit";
import { PONTOS_DE_IA } from "@/lib/ai/pontos/registro";
import { PONTOS_DO_AGENTE_PUBLICADO } from "@/lib/ai/pontos/resolver";

describe("KIT_RECOMENDADO_V1", () => {
  it("é versionado e usa OpenRouter sem amarrar credencial de organização", () => {
    expect(KIT_RECOMENDADO_V1.id).toBe("standard-v1");
    expect(KIT_RECOMENDADO_V1.versao).toBe(1);
    expect(KIT_RECOMENDADO_V1.provider).toBe("openrouter");
    expect(JSON.stringify(KIT_RECOMENDADO_V1)).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
  });

  it("mantém agente publicado e todos os pontos fixos fora da aplicação automática", () => {
    const ids = new Set(bindingsDoKitRecomendado().map((binding) => binding.purpose));

    for (const ponto of PONTOS_DE_IA) {
      if (ponto.fixo !== undefined || PONTOS_DO_AGENTE_PUBLICADO.has(ponto.id)) {
        expect(ids.has(ponto.id), ponto.id).toBe(false);
      }
    }

    expect(ids.has("agent_turn")).toBe(false);
    expect(ids.has("operator_turn")).toBe(false);
    expect(ids.has("transcricao_de_audio")).toBe(false);
    expect(ids.has("embedding_indexar")).toBe(false);
    expect(ids.has("embedding_consultar")).toBe(false);
    expect(ids.has("teste_de_agente")).toBe(false);
    expect(ids.has("contagem_de_tokens")).toBe(false);
  });

  it("aplica Nex-N2-Mini somente à visão e DeepSeek aos demais pontos configuráveis", () => {
    const plano = bindingsDoKitRecomendado();
    const visao = plano.find((binding) => binding.purpose === "visao_de_imagem");
    expect(visao).toEqual({
      purpose: "visao_de_imagem",
      provider: "openrouter",
      modelId: "nex-agi/nex-n2-mini",
    });

    const auxiliares = plano.filter((binding) => binding.purpose !== "visao_de_imagem");
    expect(auxiliares.length).toBeGreaterThan(0);
    expect(
      auxiliares.every((binding) => binding.modelId === "deepseek/deepseek-v4-flash-0731"),
    ).toBe(true);
  });

  it("cobre todo ponto configurável que não pertence à versão publicada", () => {
    const esperado = PONTOS_DE_IA.filter(
      (ponto) => ponto.fixo === undefined && !PONTOS_DO_AGENTE_PUBLICADO.has(ponto.id),
    )
      .map((ponto) => ponto.id)
      .sort();
    const atual = bindingsDoKitRecomendado()
      .map((binding) => binding.purpose)
      .sort();

    expect(atual).toEqual(esperado);
  });

  it("declara Whisper como recomendação do transcritor separado, sem fingir que é modelo OpenRouter", () => {
    expect(KIT_RECOMENDADO_V1.audio).toMatchObject({
      purpose: "transcricao_de_audio",
      modelId: "whisper-large-v3-turbo",
      aplicacao: "transcritor_separado",
    });
    expect(KIT_RECOMENDADO_V1.audio.modelId).not.toContain("/");
    expect(bindingsDoKitRecomendado().some((b) => b.purpose === "transcricao_de_audio")).toBe(false);
  });

  it("exige do catálogo apenas os modelos realmente gravados pelo botão", () => {
    expect(modelosObrigatoriosDoKit().sort()).toEqual(
      ["deepseek/deepseek-v4-flash-0731", "nex-agi/nex-n2-mini"].sort(),
    );
  });
});

describe("customização do kit por organização", () => {
  const personalizado: ModelosDoKitRecomendado = {
    agente: "openai/gpt-4o-mini",
    auxiliares: "google/gemini-2.5-flash-lite",
    imagem: "qwen/qwen3-vl-8b-instruct",
    audio: "qwen3-asr-0.6b",
  };

  it("lê um override completo salvo em organizations.settings", () => {
    const settings = {
      llm: { provider: "openrouter" },
      [SETTINGS_KEY_KIT_RECOMENDADO]: {
        base_id: "standard-v1",
        base_version: 1,
        models: personalizado,
      },
    };

    expect(modelosDoKitSalvo(settings)).toEqual({
      modelos: personalizado,
      customizado: true,
    });
  });

  it("não mistura override parcial/corrompido com o default", () => {
    const settings = {
      [SETTINGS_KEY_KIT_RECOMENDADO]: {
        models: { agente: "openai/gpt-4o-mini" },
      },
    };

    expect(modelosDoKitSalvo(settings)).toEqual({
      modelos: MODELOS_PADRAO_DO_KIT,
      customizado: false,
    });
  });

  it("preserva settings paralelos ao salvar um preset personalizado", () => {
    const antes = {
      llm: { provider: "openrouter", default_model: "foo" },
      branding: { logo_path: "logo.png" },
      business_profile: { description: "Automações e landing pages" },
    };
    const depois = settingsComKitSalvo(antes, personalizado);

    expect(depois.llm).toEqual(antes.llm);
    expect(depois.branding).toEqual(antes.branding);
    expect(depois.business_profile).toEqual(antes.business_profile);
    expect(depois[SETTINGS_KEY_KIT_RECOMENDADO]).toEqual({
      base_id: "standard-v1",
      base_version: 1,
      models: personalizado,
    });
  });

  it("salvar exatamente os valores padrão remove o override e deixa o tenant seguir futuras versões globais", () => {
    const antes = settingsComKitSalvo({ branding: { logo_path: "logo.png" } }, personalizado);
    const depois = settingsComKitSalvo(antes, MODELOS_PADRAO_DO_KIT);

    expect(depois.branding).toEqual({ logo_path: "logo.png" });
    expect(depois).not.toHaveProperty(SETTINGS_KEY_KIT_RECOMENDADO);
    expect(ehKitPadrao(MODELOS_PADRAO_DO_KIT)).toBe(true);
  });

  it("bindings automáticos passam a usar a variante salva sem tocar agente ou áudio", () => {
    const plano = bindingsDoKitRecomendado(personalizado);
    const visao = plano.find((binding) => binding.purpose === "visao_de_imagem");
    expect(visao?.modelId).toBe(personalizado.imagem);
    expect(
      plano
        .filter((binding) => binding.purpose !== "visao_de_imagem")
        .every((binding) => binding.modelId === personalizado.auxiliares),
    ).toBe(true);
    expect(plano.some((binding) => binding.purpose === "agent_turn")).toBe(false);
    expect(plano.some((binding) => binding.purpose === "transcricao_de_audio")).toBe(false);
  });

  it("distingue modelos OpenRouter do preset completo dos modelos efetivamente aplicados", () => {
    expect(modelosOpenRouterDoKit(personalizado).sort()).toEqual(
      [personalizado.agente, personalizado.auxiliares, personalizado.imagem].sort(),
    );
    expect(modelosObrigatoriosDoKit(personalizado).sort()).toEqual(
      [personalizado.auxiliares, personalizado.imagem].sort(),
    );
  });
});
