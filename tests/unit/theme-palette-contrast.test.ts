import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { razaoDeContraste } from "@/lib/branding/contraste";

const CSS = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

function bloco(seletor: string): string {
  const escaped = seletor.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}\\s*\\{([\\s\\S]*?)^\\}`, "m").exec(CSS);
  if (!match?.[1]) throw new Error(`bloco ${seletor} ausente em app/globals.css`);
  return match[1];
}

function token(css: string, nome: string): string {
  const escaped = nome.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^\\s*${escaped}:\\s*(#[0-9a-f]{6})\\s*;`, "mi").exec(css);
  if (!match?.[1]) throw new Error(`token ${nome} ausente ou não-hex`);
  return match[1].toLowerCase();
}

describe("paleta dos temas", () => {
  it("o tema claro mantém a aparência clássica e nítida", () => {
    const light = bloco(":root");
    expect(token(light, "--color-bg")).toBe("#ffffff");
    expect(token(light, "--color-surface")).toBe("#ffffff");
    expect(token(light, "--color-surface-elevated")).toBe("#f5f5f5");
    expect(token(light, "--color-text")).toBe("#171717");
    expect(token(light, "--color-text-muted")).toBe("#525252");
    expect(token(light, "--color-border")).toBe("#e5e5e5");
  });

  it("texto secundário do tema escuro passa AA nas três superfícies", () => {
    const dark = bloco('[data-theme="dark"]');
    const backgrounds = [
      token(dark, "--color-bg"),
      token(dark, "--color-surface"),
      token(dark, "--color-surface-elevated"),
    ];

    for (const textToken of ["--color-text-muted", "--color-text-subtle"]) {
      const foreground = token(dark, textToken);
      for (const background of backgrounds) {
        expect(
          razaoDeContraste(foreground, background),
          `${textToken} ${foreground} sobre ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("borda forte do tema escuro continua distinguível em qualquer superfície", () => {
    const dark = bloco('[data-theme="dark"]');
    const strong = token(dark, "--color-border-strong");
    for (const background of [
      token(dark, "--color-bg"),
      token(dark, "--color-surface"),
      token(dark, "--color-surface-elevated"),
    ]) {
      expect(
        razaoDeContraste(strong, background),
        `--color-border-strong ${strong} sobre ${background}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
