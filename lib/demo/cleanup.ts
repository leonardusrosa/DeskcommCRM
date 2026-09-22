import type { createAdminClient } from "@/lib/supabase/admin";

export interface DemoCleanupResult {
  organizationsDeleted: number;
  usersDeleted: number;
}

/**
 * Deletes exactly one synthetic demo organization and its auth users.
 *
 * The organization predicate includes settings.demo=true so a bad caller can
 * never turn this helper into an arbitrary tenant deletion primitive.
 */
export async function cleanupDemoOrganization(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<DemoCleanupResult> {
  const { data: memberships, error: membershipError } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", orgId);
  if (membershipError) throw new Error(`Demo cleanup memberships: ${membershipError.message}`);

  const userIds = [...new Set((memberships ?? []).map((m) => String(m.user_id)))];

  const { error: deleteOrgError } = await admin
    .from("organizations")
    .delete()
    .eq("id", orgId)
    .contains("settings", { demo: true });
  if (deleteOrgError) throw new Error(`Demo cleanup organization: ${deleteOrgError.message}`);

  let usersDeleted = 0;
  for (const userId of userIds) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (!deleteUserError) usersDeleted += 1;
  }

  return { organizationsDeleted: 1, usersDeleted };
}

export async function cleanupExpiredDemos(
  admin: ReturnType<typeof createAdminClient>,
  now: Date = new Date(),
): Promise<DemoCleanupResult> {
  const { data: expired, error } = await admin
    .from("organizations")
    .select("id")
    .contains("settings", { demo: true })
    .lte("settings->>demo_expires_at", now.toISOString());

  if (error) throw new Error(`Demo expiry lookup: ${error.message}`);

  let organizationsDeleted = 0;
  let usersDeleted = 0;

  for (const row of expired ?? []) {
    const result = await cleanupDemoOrganization(admin, String(row.id));
    organizationsDeleted += result.organizationsDeleted;
    usersDeleted += result.usersDeleted;
  }

  return { organizationsDeleted, usersDeleted };
}
