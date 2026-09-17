/**
 * scripts/demo/launcher.ts
 *
 * User-friendly interactive Demo Launcher for Deskcomm CRM.
 * Allows sales team members to provision a demo without touching environment
 * variables, SQL, or developer flags.
 *
 * Usage:
 *   pnpm demo
 */

import * as readline from "node:readline";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { carregarEnvLocal, credenciaisSupabaseDeTeste } from "../lib/env-de-teste";
import { AVAILABLE_CLINICS, type DemoClinicDefinition } from "./clinics";
import {
  generateDemoPassword,
  saveDemoSession,
  type DemoSession,
} from "./lib/demo-session";
import {
  checkEnvironmentPreconditions,
  runDemoHealthCheck,
} from "./lib/health-check";
import { promptBrowserLaunch, DEFAULT_DEMO_URL } from "./lib/browser";

export interface LauncherOptions {
  clinicId?: string;
  nonInteractive?: boolean;
  skipBrowser?: boolean;
  customEnv?: Record<string, string | undefined>;
  customAdmin?: SupabaseClient;
}

export async function runLauncher(
  options: LauncherOptions = {},
): Promise<{ success: boolean; session?: DemoSession; error?: string }> {
  console.info("\n╔══════════════════════════════════════╗");
  console.info("║       Deskcomm Demo Launcher         ║");
  console.info("╚══════════════════════════════════════╝\n");

  console.info("Checking environment...\n");

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

  // 1. Safety & Preconditions
  const envCheck = await checkEnvironmentPreconditions(envSource, adminClient);
  if (!envCheck.ok) {
    console.error("\nDEMO FAILED\n");
    console.error("Reason:");
    console.error(envCheck.error || "Environment preconditions failed.");
    return { success: false, error: envCheck.error };
  }

  for (const check of envCheck.checks) {
    console.info(`✓ ${check.label}`);
  }

  // 2. Select Clinic
  let selectedClinic: DemoClinicDefinition | undefined;

  if (options.clinicId) {
    selectedClinic = AVAILABLE_CLINICS.find((c) => c.id === options.clinicId);
    if (!selectedClinic) {
      const error = `Unknown clinic id "${options.clinicId}".`;
      console.error(`\nDEMO FAILED\n\nReason:\n${error}`);
      return { success: false, error };
    }
  } else if (options.nonInteractive) {
    selectedClinic = AVAILABLE_CLINICS[0]!;
  } else {
    selectedClinic = await promptClinicSelection();
  }

  // 3. Generate ephemeral credentials
  const demoPassword = generateDemoPassword();
  console.info("\nDemo password generated:\n");
  console.info(`${demoPassword}`);

  // Inject safety consent and generated password into the seed execution
  const executionEnv: Record<string, string | undefined> = {
    ...envSource,
    DEMO_SEED_ALLOWED: "true",
    DEMO_USER_PASSWORD: demoPassword,
  };

  // 4. Create Demo Environment
  console.info("\nCreating demo environment...\n");

  try {
    await selectedClinic.seed(executionEnv, adminClient);
    console.info("✓ Organization created");
    console.info("✓ Team created");
    console.info("✓ Services loaded");
    console.info("✓ Pipeline loaded");
    console.info("✓ Contacts loaded");
    console.info("✓ Agenda populated");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("\nDEMO FAILED\n");
    console.error("Reason:");
    console.error(reason);
    console.error("\nNo partial demo should be reported as ready.");
    return { success: false, error: reason };
  }

  // 5. Run Health Check before declaring READY
  const healthResult = await runDemoHealthCheck(selectedClinic.slug, adminClient, executionEnv);
  if (!healthResult.passed) {
    console.error("\nDEMO FAILED\n");
    console.error("Reason:");
    console.error(healthResult.reason || "Health check verification failed.");
    console.error("\nNo partial demo should be reported as ready.");
    return { success: false, error: healthResult.reason };
  }

  // 6. Save Session
  const session: DemoSession = {
    tenant: selectedClinic.slug,
    email: selectedClinic.ownerEmail,
    password: demoPassword,
    clinicName: selectedClinic.name,
    country: selectedClinic.country,
  };
  saveDemoSession(session);

  // 7. Demo Completion Output
  console.info("\n===================================");
  console.info("\nREADY FOR DEMO 🚀\n");
  console.info("URL:");
  console.info(DEFAULT_DEMO_URL);
  console.info("\nUser:");
  console.info(selectedClinic.ownerEmail);
  console.info("\nPassword:");
  console.info(demoPassword);
  console.info("\n===================================\n");

  // 8. Interactive Browser Launch
  if (!options.skipBrowser && !options.nonInteractive) {
    await promptBrowserLaunch(DEFAULT_DEMO_URL);
  }

  return { success: true, session };
}

function promptClinicSelection(): Promise<DemoClinicDefinition> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.info("\nChoose demo:\n");
    AVAILABLE_CLINICS.forEach((clinic, index) => {
      console.info(`${index + 1}) ${clinic.name}`);
    });

    const ask = () => {
      rl.question("\nSelect:\n> ", (answer) => {
        const choice = parseInt(answer.trim(), 10);
        if (!isNaN(choice) && choice >= 1 && choice <= AVAILABLE_CLINICS.length) {
          rl.close();
          resolve(AVAILABLE_CLINICS[choice - 1]!);
        } else {
          console.info(`Por favor seleccione un número entre 1 y ${AVAILABLE_CLINICS.length}.`);
          ask();
        }
      });
    };

    ask();
  });
}

if (require.main === module) {
  runLauncher().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error(`\n❌ Error:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
