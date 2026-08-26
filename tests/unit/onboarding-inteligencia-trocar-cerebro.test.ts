// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PROVEDORES, IDS_DE_PROVEDOR } from "@/lib/ai/pontos/provedores";
import { provedorPadraoDaInstalacao, provedorDaOrg } from "@/lib/instalacao/retrato";
import { lerAmbiente } from "@/lib/instalacao/ambiente";

describe("Onboarding Inteligência / Trocar Cérebro", () => {
  it("1. PROVEDORES registry contains all 6 canonical providers", () => {
    const ids = PROVEDORES.map((p) => p.id);
    expect(ids).toContain("anthropic");
    expect(ids).toContain("openai");
    expect(ids).toContain("google");
    expect(ids).toContain("openrouter");
    expect(ids).toContain("opencode_zen");
    expect(ids).toContain("deepseek");
    expect(ids.length).toBe(6);
  });

  it("2. provedorPadraoDaInstalacao prioritizes available env keys", () => {
    // When OpenCode Zen key exists in env
    const envZen = { OPENCODE_ZEN_API_KEY: "sk-zen-123" };
    expect(provedorPadraoDaInstalacao(envZen)).toBe("opencode_zen");

    // When only DeepSeek exists
    const envDeepSeek = { DEEPSEEK_API_KEY: "sk-ds-123" };
    expect(provedorPadraoDaInstalacao(envDeepSeek)).toBe("deepseek");

    // When only OpenAI exists
    const envOpenAi = { OPENAI_API_KEY: "sk-openai-123" };
    expect(provedorPadraoDaInstalacao(envOpenAi)).toBe("openai");

    // Fallback when nothing exists
    expect(provedorPadraoDaInstalacao({})).toBe("anthropic");
  });

  it("3. provedorDaOrg respects org settings override over installation default", () => {
    const envZen = { OPENCODE_ZEN_API_KEY: "sk-zen-123" };
    
    // Org explicitly chose deepseek
    const orgSettingsDeepSeek = { llm: { provider: "deepseek", default_model: "deepseek-v4-flash" } };
    expect(provedorDaOrg(orgSettingsDeepSeek, envZen)).toBe("deepseek");

    // Org with empty settings falls back to installation default (Zen)
    const orgSettingsEmpty = {};
    expect(provedorDaOrg(orgSettingsEmpty, envZen)).toBe("opencode_zen");
  });

  it("4. lerAmbiente correctly detects all provider keys from environment source", () => {
    const amb = lerAmbiente({
      OPENCODE_ZEN_API_KEY: "sk-zen-key",
      DEEPSEEK_API_KEY: "sk-ds-key",
    });

    expect(amb.chavesDeProvedor["opencode_zen"]).toBe(true);
    expect(amb.chavesDeProvedor["deepseek"]).toBe(true);
    expect(amb.chavesDeProvedor["anthropic"]).toBe(false);
    expect(amb.chavesDeProvedor["openai"]).toBe(false);
    expect(amb.chavesDeProvedor["openrouter"]).toBe(false);
    expect(amb.chavesDeProvedor["google"]).toBe(false);
  });
});
