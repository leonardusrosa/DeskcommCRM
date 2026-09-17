/**
 * scripts/demo/fresh.ts
 *
 * Fast reset command for Deskcomm demo environments:
 * reset current demo → recreate → validate → open browser
 *
 * Usage:
 *   pnpm demo:fresh
 */

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
import { launchBrowser, DEFAULT_DEMO_URL } from "./lib/browser";

export interface FreshOptions {
  clinicId?: string;
  skipBrowser?: boolean;
  customEnv?: Record<string, string | undefined>;
  customAdmin?: SupabaseClient;
}

export async function runFresh(
  options: FreshOptions = {},
): Promise<{ success: boolean; session?: DemoSession; error?: string }> {
  console.info("\n╔══════════════════════════════════════╗");
  console.info("║       Deskcomm Fast Demo Reset       ║");
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

  // 1. Safety check
  const envCheck = await checkEnvironmentPreconditions(envSource, adminClient);
  if (!envCheck.ok) {
    console.error("\nDEMO FAILED\n\nReason:\n" + (envCheck.error || "Preconditions failed."));
    return { success: false, error: envCheck.error };
  }

  // 2. Identify target demo clinic
  const activeSession = loadDemoSession();
  let targetClinic: DemoClinicDefinition | undefined;

  if (options.clinicId) {
    targetClinic = AVAILABLE_CLINICS.find((c) => c.id === options.clinicId);
  } else if (activeSession?.tenant) {
    targetClinic = getClinicBySlug(activeSession.tenant);
  }

  if (!targetClinic) {
    targetClinic = AVAILABLE_CLINICS[0]!;
  }

  console.info(`Target Demo: ${targetClinic.name}\n`);

  const newPassword = generateDemoPassword();
  const executionEnv: Record<string, string | undefined> = {
    ...envSource,
    DEMO_SEED_ALLOWED: "true",
    DEMO_USER_PASSWORD: newPassword,
  };

  // 3. Reset existing demo tenant
  console.info("1. Limpiando ambiente demo actual...");
  try {
    await targetClinic.cleanup(executionEnv, adminClient);
    console.info("   ✓ Datos anteriores limpiados.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nDEMO FAILED\n\nReason:\nError durante la limpieza: ${msg}`);
    return { success: false, error: msg };
  }

  // 4. Recreate demo environment
  console.info("\n2. Recreando ambiente demo...");
  try {
    await targetClinic.seed(executionEnv, adminClient);
    console.info("   ✓ Organización, usuarios, pipeline, contactos y agenda creados.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nDEMO FAILED\n\nReason:\nError durante el aprovisionamiento: ${msg}`);
    return { success: false, error: msg };
  }

  // 5. Validate health checks
  console.info("\n3. Validando estado del ambiente demo...");
  const health = await runDemoHealthCheck(targetClinic.slug, adminClient, executionEnv);
  if (!health.passed) {
    console.error("\nDEMO FAILED\n\nReason:\n" + (health.reason || "Health check failed."));
    return { success: false, error: health.reason };
  }

  for (const check of health.checks) {
    console.info(`   ✓ ${check.label}`);
  }

  // 6. Update session
  const newSession: DemoSession = {
    tenant: targetClinic.slug,
    email: targetClinic.ownerEmail,
    password: newPassword,
    clinicName: targetClinic.name,
    country: targetClinic.country,
  };
  saveDemoSession(newSession);

  // 7. Output Completion
  console.info("\n===================================");
  console.info("\nREADY FOR DEMO 🚀\n");
  console.info("URL:");
  console.info(DEFAULT_DEMO_URL);
  console.info("\nUser:");
  console.info(targetClinic.ownerEmail);
  console.info("\nPassword:");
  console.info(newPassword);
  console.info("\n===================================\n");

  // 8. Open browser
  if (!options.skipBrowser) {
    console.info("Abriendo demo en el navegador...");
    await launchBrowser(DEFAULT_DEMO_URL);
  }

  return { success: true, session: newSession };
}

if (require.main === module) {
  runFresh().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error(`\n❌ Error en demo:fresh:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
