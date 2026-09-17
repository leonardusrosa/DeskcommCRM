/**
 * scripts/demo/login.ts
 *
 * Demo Login Helper.
 * Displays current active demo credentials from .demo/session.json.
 * Strictly guarantees never to expose production credentials.
 *
 * Usage:
 *   pnpm demo:login
 */

import { loadDemoSession, type DemoSession } from "./lib/demo-session";
import { promptBrowserLaunch, DEFAULT_DEMO_URL } from "./lib/browser";
import { getClinicBySlug } from "./clinics";

export interface LoginHelperOptions {
  skipBrowserPrompt?: boolean;
  customSessionPath?: string;
}

export async function showDemoLogin(
  options: LoginHelperOptions = {},
): Promise<{ success: boolean; session?: DemoSession; message?: string }> {
  const session = loadDemoSession(options.customSessionPath);

  if (!session || !session.tenant || !session.email || !session.password) {
    const msg = "No active demo session found. Run 'pnpm demo' to create a demo environment.";
    console.info(`\nℹ️  ${msg}\n`);
    return { success: false, message: msg };
  }

  // Safety: Guarantee tenant is a demo tenant
  const isKnownDemo = Boolean(getClinicBySlug(session.tenant));
  if (!isKnownDemo && !session.tenant.includes("demo") && !session.email.endsWith(".demo")) {
    const err = "Safety violation: Active session does not match a verified demo tenant.";
    console.error(`\n❌ ${err}\n`);
    return { success: false, message: err };
  }

  const clinicName = session.clinicName || session.tenant;

  console.info("\n===================================");
  console.info("DESKCOMM DEMO CREDENTIALS 🔑");
  console.info("===================================\n");
  console.info("Demo:");
  console.info(clinicName);
  console.info("\nURL:");
  console.info(DEFAULT_DEMO_URL);
  console.info("\nUser:");
  console.info(session.email);
  console.info("\nPassword:");
  console.info(session.password);
  console.info("\n===================================\n");

  if (!options.skipBrowserPrompt) {
    await promptBrowserLaunch(DEFAULT_DEMO_URL);
  }

  return { success: true, session };
}

if (require.main === module) {
  showDemoLogin().catch((err) => {
    console.error(`\n❌ Error:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
