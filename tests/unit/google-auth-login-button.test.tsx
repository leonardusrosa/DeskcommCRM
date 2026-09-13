/**
 * Prova que as telas de Login e Signup oferecem o botão canônico do Google
 * e que a invocação chama signInWithOAuth({ provider: 'google', options: { redirectTo: ... } })
 * apontando para /auth/confirm, mantendo isolamento estrito com a Agenda.
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSignInWithOAuth = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/actions/auth/signInWithPassword", () => ({
  signInWithPassword: vi.fn(),
}));

vi.mock("@/app/actions/auth/signUp", () => ({
  signUp: vi.fn(),
}));

import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Google Auth em Login e Signup", () => {
  it("LoginForm renderiza 'Continuar com Google' e aciona OAuth apontando para /auth/confirm", async () => {
    render(<LoginForm />);
    const btn = screen.getByRole("button", { name: /continuar com google/i });
    expect(btn).toBeTruthy();

    fireEvent.click(btn);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringMatching(/\/auth\/confirm$/),
      },
    });
  });

  it("SignupForm renderiza 'Continuar com Google' e aciona OAuth apontando para /auth/confirm", async () => {
    render(<SignupForm />);
    const btn = screen.getByRole("button", { name: /continuar com google/i });
    expect(btn).toBeTruthy();

    fireEvent.click(btn);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: expect.stringMatching(/\/auth\/confirm$/),
      },
    });
  });
});
