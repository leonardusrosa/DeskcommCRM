// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * REGRESSÃO: O REDIRECT DE OAUTH DO GOOGLE NÃO PODE DEPENDER DE NEXT_PUBLIC_APP_URL ASSADO NO BUILD.
 *
 * Em imagens Docker genéricas, NEXT_PUBLIC_APP_URL é definido em tempo de build
 * como `https://placeholder.invalid`. Se LoginForm ou SignupForm acessarem
 * estaticamente `process.env.NEXT_PUBLIC_APP_URL`, o Next.js substitui em build-time
 * pelo placeholder, fazendo o navegador solicitar redirecionamento para
 * `https://placeholder.invalid/auth/confirm`.
 *
 * A correção obriga a derivação do redirect a partir da origem viva do navegador:
 * `typeof window !== "undefined" ? window.location.origin : ""`
 */

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const LOGIN_FONTE = stripComments(readFileSync("components/auth/LoginForm.tsx", "utf8"));
const SIGNUP_FONTE = stripComments(readFileSync("components/auth/SignupForm.tsx", "utf8"));

describe("LoginForm e SignupForm nunca assam NEXT_PUBLIC_* no redirect OAuth", () => {
  it("LoginForm não contém acesso estático a process.env.NEXT_PUBLIC_*", () => {
    const matches = [...LOGIN_FONTE.matchAll(/process\.env\.NEXT_PUBLIC_[A-Z_]+/g)].map((m) => m[0]);
    expect(matches, "LoginForm não pode conter acesso estático a process.env.NEXT_PUBLIC_*").toEqual([]);
  });

  it("SignupForm não contém acesso estático a process.env.NEXT_PUBLIC_*", () => {
    const matches = [...SIGNUP_FONTE.matchAll(/process\.env\.NEXT_PUBLIC_[A-Z_]+/g)].map((m) => m[0]);
    expect(matches, "SignupForm não pode conter acesso estático a process.env.NEXT_PUBLIC_*").toEqual([]);
  });

  it("LoginForm deriva origin a partir de window.location.origin", () => {
    expect(LOGIN_FONTE).toMatch(/window\.location\.origin/);
    expect(LOGIN_FONTE).toMatch(/redirectTo:\s*`\${origin}\/auth\/confirm`/);
  });

  it("SignupForm deriva origin a partir de window.location.origin", () => {
    expect(SIGNUP_FONTE).toMatch(/window\.location\.origin/);
    expect(SIGNUP_FONTE).toMatch(/redirectTo:\s*`\${origin}\/auth\/confirm`/);
  });
});
