/**
 * scripts/demo/lib/guards.ts
 *
 * Safety validation to strictly prevent demo seed execution in production
 * or without explicit operator consent.
 */

import { carregarEnvLocal, credenciaisSupabaseDeTeste } from "../../lib/env-de-teste";

export interface VerifiedSafetyContext {
  supabaseUrl: string;
  serviceRoleKey: string;
  userPassword: string;
}

const PRODUCTION_SUPABASE_PROJECT_REF = "zywwwvrotgqouxillpvi";

function parseCliArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--allow" || arg === "--yes" || arg === "--demo-seed-allowed") {
      result.DEMO_SEED_ALLOWED = "true";
    } else if (arg.startsWith("--password=")) {
      result.DEMO_USER_PASSWORD = arg.slice("--password=".length);
    } else if (arg === "--password" && i + 1 < args.length) {
      result.DEMO_USER_PASSWORD = args[++i]!;
    }
  }
  return result;
}

export function assertSafetyGuards(
  customEnv?: Record<string, string | undefined>,
): VerifiedSafetyContext {
  const cliArgs = parseCliArgs();
  const envSource = customEnv ?? {
    ...carregarEnvLocal(),
    ...process.env,
    ...cliArgs,
  };

  // 1. Explicit gate flag
  const demoSeedAllowed = envSource.DEMO_SEED_ALLOWED;
  if (demoSeedAllowed !== "true") {
    throw new Error(
      "Safety check failed: DEMO_SEED_ALLOWED must be explicitly set to 'true'.\n" +
        "Run with:\n" +
        "  pnpm demo:seed:colombia --allow --password \"sua-senha-segura\"\n" +
        "or in PowerShell:\n" +
        "  $env:DEMO_SEED_ALLOWED=\"true\"; $env:DEMO_USER_PASSWORD=\"sua-senha\"; pnpm demo:seed:colombia",
    );
  }

  // 2. Reject NODE_ENV=production
  const nodeEnv = envSource.NODE_ENV;
  if (nodeEnv === "production") {
    throw new Error("Safety check failed: Demo provisioning is strictly prohibited when NODE_ENV=production.");
  }

  // 3. Resolve credentials
  const creds = credenciaisSupabaseDeTeste();
  const supabaseUrl = envSource.NEXT_PUBLIC_SUPABASE_URL || creds.url;
  const serviceRoleKey = envSource.SUPABASE_SERVICE_ROLE_KEY || creds.serviceRole;
  const dbUrl = envSource.SUPABASE_DB_URL || creds.dbUrl || "";

  // 4. Reject production Supabase instance
  if (
    supabaseUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF) ||
    dbUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)
  ) {
    throw new Error(
      `Safety check failed: Refusing execution against production Supabase (${PRODUCTION_SUPABASE_PROJECT_REF}).`,
    );
  }

  // 5. Password requirement: Never hardcode passwords in source code.
  const userPassword =
    envSource.DEMO_USER_PASSWORD || envSource.DEMO_PASSWORD || envSource.E2E_PASSWORD;
  if (!userPassword || userPassword.length < 8) {
    throw new Error(
      "Safety check failed: Environment variable DEMO_USER_PASSWORD (min 8 characters) is required. " +
        "Never hardcode passwords in source code.",
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    userPassword,
  };
}

/**
 * Validates that the target environment is not production.
 * Does not require password entry, making it suitable for status checks and expired cleanup.
 */
export function assertDemoEnvironmentSafety(
  customEnv?: Record<string, string | undefined>,
): { supabaseUrl: string; serviceRoleKey: string } {
  const envSource = customEnv ?? {
    ...carregarEnvLocal(),
    ...process.env,
  };

  const nodeEnv = envSource.NODE_ENV;
  if (nodeEnv === "production") {
    throw new Error("Safety check failed: Demo operations are strictly prohibited when NODE_ENV=production.");
  }

  const creds = credenciaisSupabaseDeTeste();
  const supabaseUrl = envSource.NEXT_PUBLIC_SUPABASE_URL || creds.url;
  const serviceRoleKey = envSource.SUPABASE_SERVICE_ROLE_KEY || creds.serviceRole;
  const dbUrl = envSource.SUPABASE_DB_URL || creds.dbUrl || "";

  if (
    supabaseUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF) ||
    dbUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)
  ) {
    throw new Error(
      `Safety check failed: Refusing execution against production Supabase (${PRODUCTION_SUPABASE_PROJECT_REF}).`,
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}
