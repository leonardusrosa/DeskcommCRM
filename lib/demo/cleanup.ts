import type { SupabaseClient } from "@supabase/supabase-js";

export interface DemoCleanupResult {
  organizationsDeleted: number;
  usersDeleted: number;
}

export async function cleanupExpiredDemos(
  admin: SupabaseClient,
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
    const orgId = String(row.id);
    const { data: memberships, error: membershipError } = await admin
      .from("user_organizations")
      .select("user_id")
      .eq("organization_id", orgId);
    if (membershipError) throw new Error(`Demo expiry memberships: ${membershipError.message}`);

    const userIds = [...new Set((memberships ?? []).map((m) => String(m.user_id)))];

    const { error: deleteOrgError } = await admin
      .from("organizations")
      .delete()
      .eq("id", orgId)
      .contains("settings", { demo: true });
    if (deleteOrgError) throw new Error(`Demo expiry organization: ${deleteOrgError.message}`);
    organizationsDeleted += 1;

    // The organization cascade removes memberships/business rows. Auth users live
    // outside public schema and therefore must be removed explicitly afterwards.
    for (const userId of userIds) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
      if (!deleteUserError) usersDeleted += 1;
    }
  }

  return { organizationsDeleted, usersDeleted };
}
