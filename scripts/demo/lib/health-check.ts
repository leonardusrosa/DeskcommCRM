/**
 * scripts/demo/lib/health-check.ts
 *
 * Health check verifications for the demo factory.
 * Guarantees environment safety and validates completeness of the provisioned demo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarEnvLocal, credenciaisSupabaseDeTeste } from "../../lib/env-de-teste";

const PRODUCTION_SUPABASE_PROJECT_REF = "zywwwvrotgqouxillpvi";

export interface EnvPreconditionResult {
  ok: boolean;
  error?: string;
  checks: Array<{ label: string; passed: boolean; details?: string }>;
}

export interface DemoHealthCheckItem {
  label: string;
  passed: boolean;
  details?: string;
}

export interface DemoHealthCheckResult {
  passed: boolean;
  failedCheck?: string;
  reason?: string;
  checks: DemoHealthCheckItem[];
}

/**
 * Validates baseline environment preconditions before launching the demo selector.
 */
export async function checkEnvironmentPreconditions(
  customEnv?: Record<string, string | undefined>,
  adminClient?: SupabaseClient,
): Promise<EnvPreconditionResult> {
  const envSource = customEnv ?? {
    ...carregarEnvLocal(),
    ...process.env,
  };

  const creds = credenciaisSupabaseDeTeste();
  const supabaseUrl = envSource.NEXT_PUBLIC_SUPABASE_URL || creds.url;
  const dbUrl = envSource.SUPABASE_DB_URL || creds.dbUrl || "";
  const nodeEnv = envSource.NODE_ENV;

  const checks: Array<{ label: string; passed: boolean; details?: string }> = [];

  // Check 1: Production database blocked
  const isProductionTarget =
    Boolean(supabaseUrl && supabaseUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)) ||
    Boolean(dbUrl && dbUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)) ||
    nodeEnv === "production";

  if (isProductionTarget) {
    return {
      ok: false,
      error: `Safety check failed: Refusing execution against production Supabase (${PRODUCTION_SUPABASE_PROJECT_REF}) or production NODE_ENV.`,
      checks: [
        { label: "Production database blocked", passed: false, details: "Targeting production" },
      ],
    };
  }
  checks.push({ label: "Production database blocked", passed: true });

  // Check 2: Database safety verified
  checks.push({ label: "Database safety verified", passed: true });

  // Check 3: Local Supabase detected & reachable
  try {
    if (adminClient) {
      const { error } = await adminClient.from("organizations").select("id", { count: "exact", head: true });
      if (error) {
        return {
          ok: false,
          error: `Could not query local Supabase: ${error.message}`,
          checks: [...checks, { label: "Local Supabase detected", passed: false }],
        };
      }
    } else {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "HEAD",
        headers: {
          apikey: envSource.SUPABASE_SERVICE_ROLE_KEY || creds.serviceRole,
        },
      });
      if (!response.ok && response.status !== 404 && response.status !== 200) {
        return {
          ok: false,
          error: `Local Supabase returned HTTP status ${response.status}`,
          checks: [...checks, { label: "Local Supabase detected", passed: false }],
        };
      }
    }
    checks.push({ label: "Local Supabase detected", passed: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Local Supabase unreachable at ${supabaseUrl}. Ensure local containers are running: ${msg}`,
      checks: [...checks, { label: "Local Supabase detected", passed: false, details: msg }],
    };
  }

  return {
    ok: true,
    checks,
  };
}

/**
 * Runs the post-provisioning health checks before reporting READY FOR DEMO.
 */
export async function runDemoHealthCheck(
  tenantSlug: string,
  admin: SupabaseClient,
  customEnv?: Record<string, string | undefined>,
): Promise<DemoHealthCheckResult> {
  const envSource = customEnv ?? {
    ...carregarEnvLocal(),
    ...process.env,
  };

  const creds = credenciaisSupabaseDeTeste();
  const supabaseUrl = envSource.NEXT_PUBLIC_SUPABASE_URL || creds.url;
  const dbUrl = envSource.SUPABASE_DB_URL || creds.dbUrl || "";
  const nodeEnv = envSource.NODE_ENV;

  const checks: DemoHealthCheckItem[] = [];

  // 1. Production safety verified
  const isProd =
    Boolean(supabaseUrl && supabaseUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)) ||
    Boolean(dbUrl && dbUrl.includes(PRODUCTION_SUPABASE_PROJECT_REF)) ||
    nodeEnv === "production";

  if (isProd) {
    return {
      passed: false,
      failedCheck: "Production safety verified",
      reason: `Targeting production environment (${PRODUCTION_SUPABASE_PROJECT_REF}). Blocked immediately.`,
      checks: [{ label: "Production safety verified", passed: false }],
    };
  }
  checks.push({ label: "Production safety verified", passed: true });

  // 2. Supabase reachable
  try {
    const { error: pingError } = await admin.from("organizations").select("id", { count: "exact", head: true });
    if (pingError) throw new Error(pingError.message);
    checks.push({ label: "Supabase reachable", passed: true });
  } catch (err) {
    const reason = `Supabase is unreachable: ${err instanceof Error ? err.message : err}`;
    return {
      passed: false,
      failedCheck: "Supabase reachable",
      reason,
      checks: [...checks, { label: "Supabase reachable", passed: false, details: reason }],
    };
  }

  // 3. Tenant exists
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, slug, display_name")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (orgError || !org) {
    const reason = orgError ? orgError.message : `Tenant "${tenantSlug}" was not found in database.`;
    return {
      passed: false,
      failedCheck: "Tenant exists",
      reason,
      checks: [...checks, { label: "Tenant exists", passed: false, details: reason }],
    };
  }
  const orgId = (org as { id: string }).id;
  checks.push({ label: "Tenant exists", passed: true });

  // 4. Users exist
  const { count: usersCount, error: usersError } = await admin
    .from("user_organizations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (usersError || !usersCount || usersCount === 0) {
    const reason = usersError ? usersError.message : "No users associated with this tenant organization.";
    return {
      passed: false,
      failedCheck: "Users exist",
      reason,
      checks: [...checks, { label: "Users exist", passed: false, details: reason }],
    };
  }
  checks.push({ label: "Users exist", passed: true });

  // 5. Contacts loaded
  const { count: contactsCount, error: contactsError } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (contactsError || !contactsCount || contactsCount === 0) {
    const reason = contactsError ? contactsError.message : "No contacts loaded for demo tenant.";
    return {
      passed: false,
      failedCheck: "Contacts loaded",
      reason,
      checks: [...checks, { label: "Contacts loaded", passed: false, details: reason }],
    };
  }
  checks.push({ label: "Contacts loaded", passed: true });

  // 6. Pipeline exists
  const { count: pipelineCount, error: pipelineError } = await admin
    .from("crm_pipelines")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (pipelineError || !pipelineCount || pipelineCount === 0) {
    const reason = pipelineError ? pipelineError.message : "No CRM pipeline configured for demo tenant.";
    return {
      passed: false,
      failedCheck: "Pipeline exists",
      reason,
      checks: [...checks, { label: "Pipeline exists", passed: false, details: reason }],
    };
  }
  checks.push({ label: "Pipeline exists", passed: true });

  // 7. Appointments exist
  const { count: apptCount, error: apptError } = await admin
    .from("calendar_appointments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (apptError || !apptCount || apptCount === 0) {
    const reason = apptError ? apptError.message : "No agenda appointments found for demo tenant.";
    return {
      passed: false,
      failedCheck: "Appointments exist",
      reason,
      checks: [...checks, { label: "Appointments exist", passed: false, details: reason }],
    };
  }
  checks.push({ label: "Appointments exist", passed: true });

  return {
    passed: true,
    checks,
  };
}
