/**
 * Supabase client para Client Components (browser).
 *
 * Use este em qualquer arquivo com "use client". NUNCA em Server Components,
 * Route Handlers, ou middleware — eles devem usar `lib/supabase/server.ts`.
 *
 * Sessão real vive no cookie do server; cliente browser usa SameSite=Lax para PKCE.
 */

import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // Singleton no browser pra reaproveitar canais Realtime e auth state.
  if (_client) return _client;

  // Self-host (imagem genérica): valores injetados em runtime pelo
  // <PublicEnvScript/>. Vercel/dev: fallback pro process.env.NEXT_PUBLIC_*
  // (baked em build). Ler a URL do Supabase daqui é o que permite uma única
  // imagem servir qualquer projeto Supabase sem rebuild.
  const runtime =
    typeof window !== "undefined" ? window.__PUBLIC_ENV__ : undefined;
  const url = runtime?.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    runtime?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[supabase/browser] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes.",
    );
  }

  _client = createBrowserClient(url, key, {
    // D-01.01: cookie name canônico alinhado ao middleware/server.
    // SameSite=Lax (padrão do @supabase/ssr) permite que o verifier PKCE
    // sobreviva ao hop cross-site do OAuth do Google (accounts.google.com →
    // localhost:3000/auth/confirm). O cookie de sessão real (HttpOnly+Strict)
    // vive no server client (lib/supabase/server.ts) e não é afetado aqui.
    cookieOptions: {
      name: "sb-deskcomm-auth",
      sameSite: "lax",
      path: "/",
    },
  });
  return _client;
}
