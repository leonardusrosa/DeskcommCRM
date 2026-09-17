/**
 * scripts/demo/cleanup-expired.ts
 *
 * Cleanup command for expired demo tenants.
 * Safely finds and removes demo environments past demo_expires_at.
 * Strictly guarantees:
 *   - Only demo tenants (settings.demo=true)
 *   - Never runs in production (zywwwvrotgqouxillpvi / NODE_ENV=production)
 *   - Supports dry-run execution
 *
 * Usage:
 *   pnpm demo:cleanup:expired [--dry-run]
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertDemoEnvironmentSafety } from "./lib/guards";

export interface CleanupExpiredOptions {
  dryRun?: boolean;
  customEnv?: Record<string, string | undefined>;
  customAdmin?: SupabaseClient;
}

export interface CleanupExpiredResult {
  inspected: number;
  expiredCount: number;
  deletedCount: number;
  tenants: Array<{ id: string; slug: string; name: string; expiresAt?: string }>;
  dryRun: boolean;
}

export async function cleanupExpiredDemos(
  options: CleanupExpiredOptions = {},
): Promise<CleanupExpiredResult> {
  const isDryRun =
    Boolean(options.dryRun) ||
    process.argv.includes("--dry-run") ||
    process.argv.includes("--dry");

  console.info("\n╔══════════════════════════════════════╗");
  console.info("║     Deskcomm Demo Expired Cleanup    ║");
  console.info("╚══════════════════════════════════════╝\n");

  if (isDryRun) {
    console.info("🔍 MODO DRY-RUN ACTIVADO: Solo se identificarán los tenants expirados sin borrarlos.\n");
  }

  // 1. Safety verification: strictly blocks production
  const { supabaseUrl, serviceRoleKey } = assertDemoEnvironmentSafety(options.customEnv);
  const admin =
    options.customAdmin ??
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  // 2. Fetch potential demo organizations
  const { data: orgs, error: fetchErr } = await admin
    .from("organizations")
    .select("id, slug, display_name, settings, created_at");

  if (fetchErr) {
    throw new Error(`Failed to query organizations: ${fetchErr.message}`);
  }

  const allOrgs = (orgs || []) as Array<{
    id: string;
    slug: string;
    display_name: string;
    settings?: Record<string, unknown>;
    created_at?: string;
  }>;

  const now = new Date();
  const expiredDemos: Array<{ id: string; slug: string; name: string; expiresAt?: string }> = [];

  for (const org of allOrgs) {
    const settings = org.settings || {};
    const isDemo = Boolean(settings.demo || settings.is_demo);

    // Rule 1: ONLY demo tenants
    if (!isDemo) continue;

    // Rule 2: Check expiration
    const expiresAtRaw = settings.demo_expires_at as string | undefined;
    let isExpired = false;

    if (expiresAtRaw) {
      isExpired = new Date(expiresAtRaw) <= now;
    } else if (org.created_at) {
      // Fallback: 7 days after creation if demo_expires_at was not explicitly set
      const createdTime = new Date(org.created_at).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      isExpired = now.getTime() - createdTime > sevenDaysMs;
    }

    if (isExpired) {
      expiredDemos.push({
        id: org.id,
        slug: org.slug,
        name: org.display_name,
        expiresAt: expiresAtRaw,
      });
    }
  }

  console.info(`Organizaciones demo inspeccionadas: ${allOrgs.length}`);
  console.info(`Organizaciones demo expiradas encontradas: ${expiredDemos.length}\n`);

  if (expiredDemos.length === 0) {
    console.info("✓ No hay tenants demo expirados que requieran limpieza.\n");
    return {
      inspected: allOrgs.length,
      expiredCount: 0,
      deletedCount: 0,
      tenants: [],
      dryRun: isDryRun,
    };
  }

  for (const exp of expiredDemos) {
    console.info(` • [EXPIRADO] ${exp.name} (${exp.slug}) — ID: ${exp.id}`);
  }

  if (isDryRun) {
    console.info("\n[Dry Run] No se realizaron modificaciones en la base de datos.");
    return {
      inspected: allOrgs.length,
      expiredCount: expiredDemos.length,
      deletedCount: 0,
      tenants: expiredDemos,
      dryRun: true,
    };
  }

  // 3. Delete expired demo records in topological order
  console.info("\nEliminando datos en orden topológico...");
  let deletedCount = 0;

  for (const exp of expiredDemos) {
    const orgId = exp.id;
    await admin.from("calendar_appointments").delete().eq("organization_id", orgId);
    await admin.from("calendar_external_events").delete().eq("organization_id", orgId);
    await admin.from("calendar_connections").delete().eq("organization_id", orgId);
    await admin.from("calendar_event_types").delete().eq("organization_id", orgId);
    await admin.from("attendant_availability").delete().eq("organization_id", orgId);
    await admin.from("messages").delete().eq("organization_id", orgId);
    await admin.from("conversations").delete().eq("organization_id", orgId);
    await admin.from("crm_leads").delete().eq("organization_id", orgId);
    await admin.from("contacts").delete().eq("organization_id", orgId);
    await admin.from("crm_stages").delete().eq("organization_id", orgId);
    await admin.from("crm_pipelines").delete().eq("organization_id", orgId);
    await admin.from("user_organizations").delete().eq("organization_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);

    deletedCount++;
    console.info(`   ✓ Tenant demo eliminado: ${exp.name}`);
  }

  console.info(`\n✅ Limpieza completada: ${deletedCount} tenants demo expirados eliminados.\n`);

  return {
    inspected: allOrgs.length,
    expiredCount: expiredDemos.length,
    deletedCount,
    tenants: expiredDemos,
    dryRun: false,
  };
}

if (require.main === module) {
  cleanupExpiredDemos().catch((err) => {
    console.error(`\n❌ Error en cleanup:expired:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
