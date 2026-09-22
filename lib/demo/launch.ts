import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoProvisionSummary } from "./types";

/**
 * Establishes the browser session for a freshly provisioned synthetic demo.
 *
 * The one-time magic-link token never leaves the server: the admin client
 * generates it and the request-scoped SSR client consumes it immediately,
 * writing the normal httpOnly auth cookies into the response.
 */
export async function establishDemoSession(
  admin: SupabaseClient,
  sessionClient: SupabaseClient,
  demo: Pick<DemoProvisionSummary, "ownerEmail" | "ownerUserId">,
): Promise<void> {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: demo.ownerEmail,
  });

  const tokenHash = (link?.properties as { hashed_token?: string } | undefined)?.hashed_token;
  if (linkError || !tokenHash) {
    throw new Error(`Demo login handoff: ${linkError?.message || "token generation failed"}`);
  }

  const { data: verified, error: verifyError } = await sessionClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyError || !verified.user) {
    throw new Error(`Demo login handoff: ${verifyError?.message || "verification failed"}`);
  }

  if (verified.user.id !== demo.ownerUserId) {
    throw new Error("Demo login handoff: verified user does not match provisioned owner");
  }
}
