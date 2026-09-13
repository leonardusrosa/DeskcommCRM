/**
 * INVARIANTE: O COOKIE PKCE DO BROWSER PRECISA SOBREVIVER AO RETORNO DO GOOGLE OAUTH.
 *
 * ─── Causa raiz medida em staging ─────────────────────────────────────────────
 *
 * Durante o fluxo de login/cadastro com Google, o navegador inicia em /login ou
 * /signup gerando um PKCE code_challenge e gravando o code_verifier nos cookies do
 * cliente via @supabase/ssr createBrowserClient.
 *
 * Se o cookie do browser for `sameSite: "strict"`, os navegadores modernos retêm o
 * cookie na navegação top-level vinda de outro domínio (accounts.google.com →
 * localhost:3000/auth/confirm). O manipulador de rota /auth/confirm no servidor
 * então não recebe o code_verifier no header Cookie e `exchangeCodeForSession`
 * falha com: "PKCE code verifier not found in storage".
 *
 * Configurar `sameSite: "lax"` no cliente browser permite que o cookie viaje na
 * navegação cross-site de retorno do OAuth, enquanto os cookies de sessão emitidos
 * pelo servidor (lib/supabase/server.ts e proxy.ts) permanecem HttpOnly + Strict.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import type * as SupabaseSsr from "@supabase/ssr";
const createBrowserClientSpy = vi.fn();

vi.mock("@supabase/ssr", async (importOriginal) => {
  const actual = await importOriginal<typeof SupabaseSsr>();
  return {
    ...actual,
    createBrowserClient: (...args: Parameters<typeof actual.createBrowserClient>) => {
      createBrowserClientSpy(...args);
      return actual.createBrowserClient(...args);
    },
  };
});

import { createClient as createBrowserClientInstance } from "@/lib/supabase/browser";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { audit } from "@/lib/audit";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { ensureTenantForUser } from "@/lib/auth/provision";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/provision", () => ({ ensureTenantForUser: vi.fn(async () => undefined) }));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/auth/signInWithPassword", () => ({
  signInWithPassword: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/app/actions/auth/signUp", () => ({
  signUp: vi.fn().mockResolvedValue({ ok: true }),
}));

import { GET } from "@/app/auth/confirm/route";
import { signInWithPassword } from "@/app/actions/auth/signInWithPassword";
import { signUp } from "@/app/actions/auth/signUp";

describe("Google Auth PKCE & SameSite=Lax", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("o client browser configura SameSite=Lax e o cookie canônico sb-deskcomm-auth", () => {
    const client = createBrowserClientInstance();
    expect(client).toBeDefined();

    expect(createBrowserClientSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        cookieOptions: {
          name: "sb-deskcomm-auth",
          sameSite: "lax",
          path: "/",
        },
      }),
    );
  });

  it("LoginForm dispara signInWithOAuth para o Google com redirectTo apontando para /auth/confirm", async () => {
    const client = createBrowserClientInstance();
    const signInWithOAuthSpy = vi.spyOn(client.auth, "signInWithOAuth").mockResolvedValue({
      data: { provider: "google", url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });

    render(<LoginForm />);
    const googleBtn = screen.getByRole("button", { name: /continuar com google/i });
    expect(googleBtn).toBeInTheDocument();

    fireEvent.click(googleBtn);

    expect(signInWithOAuthSpy).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/confirm",
      },
    });
  });

  it("SignupForm dispara signInWithOAuth para o Google com redirectTo apontando para /auth/confirm", async () => {
    const client = createBrowserClientInstance();
    const signInWithOAuthSpy = vi.spyOn(client.auth, "signInWithOAuth").mockResolvedValue({
      data: { provider: "google", url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });

    render(<SignupForm />);
    const googleBtn = screen.getByRole("button", { name: /continuar com google/i });
    expect(googleBtn).toBeInTheDocument();

    fireEvent.click(googleBtn);

    expect(signInWithOAuthSpy).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/confirm",
      },
    });
  });

  it("/auth/confirm troca o code PKCE com sucesso e provisiona tenant do usuário", async () => {
    const mockExchange = vi.fn(async () => ({
      data: { user: { id: "user-123", email: "teste@exemplo.com" } },
      error: null,
    }));
    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        verifyOtp: vi.fn(),
        exchangeCodeForSession: mockExchange,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const request = new NextRequest("http://localhost:3000/auth/confirm?code=pkce_code_123");
    const response = await GET(request);

    expect(mockExchange).toHaveBeenCalledWith("pkce_code_123");
    expect(ensureTenantForUser).toHaveBeenCalledWith({ id: "user-123", email: "teste@exemplo.com" });
    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding/welcome");

    // Fluxo de recovery redireciona para redefinição de senha
    const reqRecovery = new NextRequest("http://localhost:3000/auth/confirm?code=pkce_code_123&type=recovery");
    const resRecovery = await GET(reqRecovery);
    expect(resRecovery.headers.get("location")).toBe("http://localhost:3000/login/reset");
  });

  it("/auth/confirm rejeita code quando o verificador PKCE não for encontrado", async () => {
    const mockExchange = vi.fn(async () => ({
      data: { user: null },
      error: { message: "PKCE code verifier not found in storage" },
    }));
    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        verifyOtp: vi.fn(),
        exchangeCodeForSession: mockExchange,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const request = new NextRequest("http://localhost:3000/auth/confirm?code=pkce_sem_cookie");
    const response = await GET(request);

    expect(mockExchange).toHaveBeenCalledWith("pkce_sem_cookie");
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.email_link_rejected",
        metadata: expect.objectContaining({
          formato: "code",
          reason: "PKCE code verifier not found in storage",
        }),
      }),
    );
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=template_padrao");
  });

  it("a autenticação por email e senha permanece funcional", async () => {
    render(<LoginForm />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "operador@empresa.com" } });
      fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "senhaSegura123" } });
      fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));
    });

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith(
        { email: "operador@empresa.com", password: "senhaSegura123" },
        undefined,
      );
    });

    cleanup();

    render(<SignupForm />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/nome da empresa/i), { target: { value: "Empresa Nova" } });
      fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "admin@empresa.com" } });
      fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: "senhaSegura123" } });
      fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: "senhaSegura123" } });
      fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    });

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith(
        {
          org_name: "Empresa Nova",
          email: "admin@empresa.com",
          password: "senhaSegura123",
          password_confirm: "senhaSegura123",
        },
        undefined,
      );
    });
  });
});
