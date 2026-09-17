/**
 * scripts/demo/reset.ts
 *
 * Reset command for demo environments.
 * Idempotently tears down the current demo tenant, re-seeds fresh demo data,
 * generates new credentials, and validates health checks.
 *
 * Usage:
 *   pnpm demo:reset
 */

import * as readline from "node:readline";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { carregarEnvLocal, credenciaisSupabaseDeTeste } from "../lib/env-de-teste";
import { AVAILABLE_CLINICS, getClinicBySlug, type DemoClinicDefinition } from "./clinics";
import {
  loadDemoSession,
  saveDemoSession,
  generateDemoPassword,
  type DemoSession,
} from "./lib/demo-session";
import {
  checkEnvironmentPreconditions,
  runDemoHealthCheck,
} from "./lib/health-check";
import { promptBrowserLaunch, DEFAULT_DEMO_URL } from "./lib/browser";

export interface ResetOptions {
  confirmed?: boolean;
  clinicId?: string;
  skipBrowser?: boolean;
  customEnv?: Record<string, string | undefined>;
  customAdmin?: SupabaseClient;
}

export async function runReset(
  options: ResetOptions = {},
): Promise<{ success: boolean; session?: DemoSession; cancelled?: boolean; error?: string }> {
  console.info("\n╔══════════════════════════════════════╗");
  console.info("║        Deskcomm Demo Reset           ║");
  console.info("╚══════════════════════════════════════╝\n");

  const envSource = {
    ...carregarEnvLocal(),
    ...process.env,
    ...(options.customEnv || {}),
  };

  const creds = credenciaisSupabaseDeTeste();
  const supabaseUrl = envSource.NEXT_PUBLIC_SUPABASE_URL || creds.url;
  const serviceRoleKey = envSource.SUPABASE_SERVICE_ROLE_KEY || creds.serviceRole;

  const adminClient =
    options.customAdmin ||
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  // 1. Verify safety preconditions
  const envCheck = await checkEnvironmentPreconditions(envSource, adminClient);
  if (!envCheck.ok) {
    console.error("\nDEMO FAILED\n");
    console.error("Reason:");
    console.error(envCheck.error || "Environment preconditions failed.");
    return { success: false, error: envCheck.error };
  }

  // 2. Identify active clinic
  const existingSession = loadDemoSession();
  let targetClinic: DemoClinicDefinition | undefined;

  if (options.clinicId) {
    targetClinic = AVAILABLE_CLINICS.find((c) => c.id === options.clinicId);
  } else if (existingSession?.tenant) {
    targetClinic = getClinicBySlug(existingSession.tenant);
  }

  if (!targetClinic) {
    targetClinic = AVAILABLE_CLINICS[0]!;
  }

  console.info("Current demo found:\n");
  console.info(`${targetClinic.name}\n`);

  // 3. Confirm deletion & recreation
  let proceed = options.confirmed;
  if (proceed === undefined) {
    proceed = await promptConfirmation();
  }

  if (!proceed) {
    console.info("\nOperación cancelada por el usuario. No se realizaron cambios.");
    return { success: true, cancelled: true };
  }

  // 4. Generate new credentials
  const newPassword = generateDemoPassword();
  const executionEnv: Record<string, string | undefined> = {
    ...envSource,
    DEMO_SEED_ALLOWED: "true",
    DEMO_USER_PASSWORD: newPassword,
  };

  // 5. Cleanup existing tenant
  console.info("\n1. Limpiando datos anteriores del tenant demo...");
  try {
    await targetClinic.cleanup(executionEnv, adminClient);
    console.info("   ✓ Tenant anterior removido exitosamente.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nDEMO FAILED\n\nReason:\nError durante la limpieza: ${msg}`);
    return { success: false, error: msg };
  }

  // 6. Run seed
  console.info("\n2. Recreando ambiente demo...");
  try {
    await targetClinic.seed(executionEnv, adminClient);
    console.info("   ✓ Organización y equipo recreados.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nDEMO FAILED\n\nReason:\nError durante el aprovisionamiento: ${msg}`);
    return { success: false, error: msg };
  }

  // 7. Run health checks
  console.info("\n3. Ejecutando verificaciones de salud...");
  const health = await runDemoHealthCheck(targetClinic.slug, adminClient, executionEnv);
  if (!health.passed) {
    console.error("\nDEMO FAILED\n");
    console.error("Reason:");
    console.error(health.reason || "Health check validation failed.");
    return { success: false, error: health.reason };
  }

  // 8. Save updated session
  const newSession: DemoSession = {
    tenant: targetClinic.slug,
    email: targetClinic.ownerEmail,
    password: newPassword,
    clinicName: targetClinic.name,
    country: targetClinic.country,
  };
  saveDemoSession(newSession);

  // 9. Completion Output
  console.info("\n===================================");
  console.info("\nREADY FOR DEMO 🚀\n");
  console.info("URL:");
  console.info(DEFAULT_DEMO_URL);
  console.info("\nUser:");
  console.info(targetClinic.ownerEmail);
  console.info("\nPassword:");
  console.info(newPassword);
  console.info("\n===================================\n");

  if (!options.skipBrowser) {
    await promptBrowserLaunch(DEFAULT_DEMO_URL);
  }

  return { success: true, session: newSession };
}

function promptConfirmation(): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.info("Delete and recreate?\n");
    console.info("[Y] Yes");
    console.info("[N] Cancel\n");

    rl.question("> ", (answer) => {
      rl.close();
      const val = answer.trim().toLowerCase();
      resolve(val === "y" || val === "yes" || val === "s" || val === "sim" || val === "");
    });
  });
}

if (require.main === module) {
  runReset().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error(`\n❌ Error en reset:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
