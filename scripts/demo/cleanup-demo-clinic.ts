/**
 * scripts/demo/cleanup-demo-clinic.ts
 *
 * Cleanup script to remove the demo tenant and associated data.
 * Safe, idempotent, and protected by safety guards.
 *
 * Usage:
 *   pnpm demo:cleanup:colombia
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSafetyGuards } from "./lib/guards";
import { DEMO_CLINIC_NAME, DEMO_CLINIC_SLUG } from "./lib/types";
import { DEMO_USERS_SPECS } from "./lib/provision-org-users";

export async function runClinicCleanup(
  customEnv?: Record<string, string | undefined>,
  customAdmin?: SupabaseClient,
): Promise<{ deleted: boolean; tenantId?: string }> {
  // 1. Safety verification
  const { supabaseUrl, serviceRoleKey } = assertSafetyGuards(customEnv);

  const admin =
    customAdmin ??
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  console.info(`\n🧹 [demo:cleanup:colombia] Iniciando limpieza de ${DEMO_CLINIC_NAME}...`);

  const { data: org, error: findError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", DEMO_CLINIC_SLUG)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to check demo org: ${findError.message}`);
  }

  if (!org) {
    console.info(`   ℹ Organización demo "${DEMO_CLINIC_SLUG}" no existe en la base. Nada que limpiar.`);
    return { deleted: false };
  }

  const orgId = (org as { id: string }).id;

  // Delete child records in topological order
  console.info(`   • Eliminando citas de agenda...`);
  await admin.from("calendar_appointments").delete().eq("organization_id", orgId);
  await admin.from("calendar_external_events").delete().eq("organization_id", orgId);
  await admin.from("calendar_connections").delete().eq("organization_id", orgId);
  await admin.from("calendar_event_types").delete().eq("organization_id", orgId);
  await admin.from("attendant_availability").delete().eq("organization_id", orgId);

  console.info(`   • Eliminando conversaciones y mensajes...`);
  await admin.from("messages").delete().eq("organization_id", orgId);
  await admin.from("conversations").delete().eq("organization_id", orgId);

  console.info(`   • Eliminando leads y contactos...`);
  await admin.from("crm_leads").delete().eq("organization_id", orgId);
  await admin.from("contacts").delete().eq("organization_id", orgId);

  console.info(`   • Eliminando pipeline y etapas...`);
  await admin.from("crm_stages").delete().eq("organization_id", orgId);
  await admin.from("crm_pipelines").delete().eq("organization_id", orgId);

  console.info(`   • Eliminando membresías de usuarios...`);
  await admin.from("user_organizations").delete().eq("organization_id", orgId);

  console.info(`   • Eliminando organización demo...`);
  const { error: orgDelErr } = await admin.from("organizations").delete().eq("id", orgId);
  if (orgDelErr) {
    throw new Error(`Failed to delete organization: ${orgDelErr.message}`);
  }

  // Clean up demo auth users
  console.info(`   • Limpiando usuarios de autenticación demo...`);
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 500 });
  if (userList) {
    for (const spec of DEMO_USERS_SPECS) {
      const match = userList.users.find(
        (u: { email?: string; id: string }) => u.email?.toLowerCase() === spec.email.toLowerCase(),
      );
      if (match) {
        await admin.auth.admin.deleteUser(match.id);
      }
    }
  }

  console.info(`\n✅ Limpieza completada con éxito para la organización ${orgId}.`);
  return { deleted: true, tenantId: orgId };
}

if (require.main === module) {
  runClinicCleanup().catch((err) => {
    console.error(`\n❌ Error durante la limpieza de demo:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
