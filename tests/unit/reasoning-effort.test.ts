// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  obterCapacidadesDeRaciocinio,
  validarEsforcoDeRaciocinio,
} from "@/lib/ai/raciocinio/catalogo";
import { montarOpcoesDeRaciocinio } from "@/lib/ai/raciocinio/adapter";
import { NIVEIS_DE_RACIOCINIO, ROTULOS_DE_RACIOCINIO } from "@/lib/ai/raciocinio/tipos";

describe("Reasoning Effort Support Suite", () => {
  it("1. reasoning models correctly expose their supported effort options", () => {
    // OpenAI o3-mini -> low, medium, high
    const o3 = obterCapacidadesDeRaciocinio("openai", "o3-mini");
    expect(o3.supports_reasoning).toBe(true);
    expect(o3.reasoning_efforts_supported).toEqual(["low", "medium", "high"]);

    // OpenAI gpt-5 -> minimal, low, medium, high, xhigh
    const gpt5 = obterCapacidadesDeRaciocinio("openai", "gpt-5.4-orion");
    expect(gpt5.supports_reasoning).toBe(true);
    expect(gpt5.reasoning_efforts_supported).toEqual(["minimal", "low", "medium", "high", "xhigh"]);

    // OpenCode Zen GPT-5 -> minimal, low, medium, high, xhigh
    const zenGpt5 = obterCapacidadesDeRaciocinio("opencode_zen", "gpt-5.4-orion");
    expect(zenGpt5.supports_reasoning).toBe(true);
    expect(zenGpt5.reasoning_efforts_supported).toEqual(["minimal", "low", "medium", "high", "xhigh"]);

    // Anthropic Claude 3.7 Sonnet -> low, medium, high
    const claude = obterCapacidadesDeRaciocinio("anthropic", "claude-3-7-sonnet");
    expect(claude.supports_reasoning).toBe(true);
    expect(claude.reasoning_efforts_supported).toEqual(["low", "medium", "high"]);

    // Google Gemini Thinking -> minimal, low, medium, high
    const gemini = obterCapacidadesDeRaciocinio("google", "gemini-2.0-flash-thinking");
    expect(gemini.supports_reasoning).toBe(true);
    expect(gemini.reasoning_efforts_supported).toEqual(["minimal", "low", "medium", "high"]);
  });

  it("2. normal non-reasoning models expose no effort control", () => {
    const gpt4o = obterCapacidadesDeRaciocinio("openai", "gpt-4o");
    expect(gpt4o.supports_reasoning).toBe(false);
    expect(gpt4o.reasoning_efforts_supported).toEqual([]);

    const deepseekFlash = obterCapacidadesDeRaciocinio("deepseek", "deepseek-v4-flash");
    expect(deepseekFlash.supports_reasoning).toBe(false);
    expect(deepseekFlash.reasoning_efforts_supported).toEqual([]);

    const mimo = obterCapacidadesDeRaciocinio("opencode_zen", "mimo-v2.5-free");
    expect(mimo.supports_reasoning).toBe(false);
    expect(mimo.reasoning_efforts_supported).toEqual([]);
  });

  it("3. invalid effort/model combinations are strictly rejected at validation time", () => {
    // Non-reasoning model attempting reasoning effort
    const res1 = validarEsforcoDeRaciocinio("openai", "gpt-4o", "high");
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.motivo).toContain("não suporta esforço de raciocínio");
    }

    // o3-mini attempting xhigh (not supported on o3-mini)
    const res2 = validarEsforcoDeRaciocinio("openai", "o3-mini", "xhigh");
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.motivo).toContain("suporta apenas os seguintes níveis");
    }

    // Completely unknown level
    const res3 = validarEsforcoDeRaciocinio("openai", "o3-mini", "ultra-hyper");
    expect(res3.ok).toBe(false);
    if (!res3.ok) {
      expect(res3.motivo).toContain("Nível de raciocínio inválido");
    }
  });

  it("4. Auto / null / empty persists cleanly as null", () => {
    const resNull = validarEsforcoDeRaciocinio("openai", "o3-mini", null);
    expect(resNull).toEqual({ ok: true, effort: null });

    const resAuto = validarEsforcoDeRaciocinio("openai", "o3-mini", "auto");
    expect(resAuto).toEqual({ ok: true, effort: null });

    const resEmpty = validarEsforcoDeRaciocinio("openai", "o3-mini", "");
    expect(resEmpty).toEqual({ ok: true, effort: null });
  });

  it("5. valid reasoning efforts are accepted and normalized", () => {
    const resHigh = validarEsforcoDeRaciocinio("opencode_zen", "gpt-5.4-orion", "high");
    expect(resHigh).toEqual({ ok: true, effort: "high" });

    const resMinimal = validarEsforcoDeRaciocinio("opencode_zen", "gpt-5.4-orion", "minimal");
    expect(resMinimal).toEqual({ ok: true, effort: "minimal" });
  });

  it("6. runtime adapter produces correct vendor wire formats", () => {
    // OpenAI o3-mini high -> openai providerOptions reasoningEffort: high
    const optOpenAi = montarOpcoesDeRaciocinio("openai", "o3-mini", "high");
    expect(optOpenAi.requestedEffort).toBe("high");
    expect(optOpenAi.effectiveEffort).toBe("high");
    expect(optOpenAi.providerOptions).toEqual({
      openai: { reasoningEffort: "high" },
    });

    // Anthropic Claude 3.7 high -> anthropic thinking budget: 16384
    const optAnthropic = montarOpcoesDeRaciocinio("anthropic", "claude-3-7-sonnet", "high");
    expect(optAnthropic.requestedEffort).toBe("high");
    expect(optAnthropic.effectiveEffort).toBe("high");
    expect(optAnthropic.providerOptions).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 16384 } },
    });

    // Google Gemini Thinking medium -> google thinkingBudget: 4096
    const optGoogle = montarOpcoesDeRaciocinio("google", "gemini-2.0-flash-thinking", "medium");
    expect(optGoogle.requestedEffort).toBe("medium");
    expect(optGoogle.effectiveEffort).toBe("medium");
    expect(optGoogle.providerOptions).toEqual({
      google: { thinkingConfig: { thinkingBudget: 4096 } },
    });

    // OpenCode Zen gpt-5.4-orion minimal
    const optZen = montarOpcoesDeRaciocinio("opencode_zen", "gpt-5.4-orion", "minimal");
    expect(optZen.requestedEffort).toBe("minimal");
    expect(optZen.effectiveEffort).toBe("minimal");
    expect(optZen.providerOptions).toEqual({
      openai: { reasoningEffort: "minimal" },
    });
    expect(optZen.extraBody).toEqual({
      reasoning_effort: "minimal",
    });

    // Auto / null sends no overrides
    const optAuto = montarOpcoesDeRaciocinio("openai", "o3-mini", null);
    expect(optAuto.requestedEffort).toBeNull();
    expect(optAuto.effectiveEffort).toBeNull();
    expect(optAuto.providerOptions).toBeUndefined();
    expect(optAuto.extraBody).toBeUndefined();
  });

  it("7. label dictionary and consumption flags are properly configured", () => {
    expect(NIVEIS_DE_RACIOCINIO).toEqual(["minimal", "low", "medium", "high", "xhigh"]);
    expect(ROTULOS_DE_RACIOCINIO.minimal.aumentaConsumo).toBe(false);
    expect(ROTULOS_DE_RACIOCINIO.low.aumentaConsumo).toBe(false);
    expect(ROTULOS_DE_RACIOCINIO.medium.aumentaConsumo).toBe(true);
    expect(ROTULOS_DE_RACIOCINIO.high.aumentaConsumo).toBe(true);
    expect(ROTULOS_DE_RACIOCINIO.xhigh.aumentaConsumo).toBe(true);
  });
});
