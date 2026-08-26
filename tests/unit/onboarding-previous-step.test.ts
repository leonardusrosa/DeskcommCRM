// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hrefAnteriorOnboarding } from "@/lib/onboarding/anterior";
import { passosVisiveis } from "@/lib/onboarding/passos";

describe("navegação anterior do onboarding", () => {
  it("não oferece Voltar no primeiro passo", () => {
    const passos = passosVisiveis({ lojaLigada: false });
    expect(hrefAnteriorOnboarding("/onboarding/welcome", passos)).toBeNull();
  });

  it("volta pela ordem lógica, não pelo histórico do browser", () => {
    const passos = passosVisiveis({ lojaLigada: false });
    expect(hrefAnteriorOnboarding("/onboarding/connect-whatsapp", passos)).toBe(
      "/onboarding/welcome",
    );
    expect(hrefAnteriorOnboarding("/onboarding/setup-ai", passos)).toBe(
      "/onboarding/connect-whatsapp",
    );
  });

  it("respeita passos opcionais que existem nesta instalação", () => {
    const semLoja = passosVisiveis({ lojaLigada: false });
    const comLoja = passosVisiveis({ lojaLigada: true });

    expect(hrefAnteriorOnboarding("/onboarding/setup-ai", semLoja)).toBe(
      "/onboarding/connect-whatsapp",
    );
    expect(hrefAnteriorOnboarding("/onboarding/setup-ai", comLoja)).toBe(
      "/onboarding/connect-nuvemshop",
    );
  });

  it("funciona também em subrotas do passo atual", () => {
    const passos = passosVisiveis({ lojaLigada: false });
    expect(hrefAnteriorOnboarding("/onboarding/setup-ai/advanced", passos)).toBe(
      "/onboarding/connect-whatsapp",
    );
  });
});
