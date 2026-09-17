/**
 * scripts/demo/profiles/engine.ts
 *
 * Core execution engine for Demo Profiles.
 * Safely provisions and tears down demo environments using any compliant DemoProfile.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSafetyGuards } from "../lib/guards";
import { ensureClinicAvailability } from "../lib/provision-availability";
import {
  ensureOrg,
  ensureUsers,
  ensureServices,
  ensurePipeline,
  ensureContacts,
  ensureAppointments,
} from "./provision-helpers";
import { trackDemoEvent } from "../lib/demo-events";
import type { DemoProfile } from "./types";
import type { DemoSeedSummary } from "../lib/types";

export async function seedDemoProfile(
  profile: DemoProfile,
  customEnv?: Record<string, string | undefined>,
  customAdmin?: SupabaseClient,
): Promise<DemoSeedSummary> {
  const { supabaseUrl, serviceRoleKey, userPassword } = assertSafetyGuards(customEnv);
  const admin =
    customAdmin ??
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  // 1. Organization
  const orgId = await ensureOrg(admin, profile);

  // 2. Users & Memberships
  const usersMap = await ensureUsers(admin, orgId, profile.users, userPassword);

  // 3. Availability for providers
  const providerIds = Array.from(usersMap.values())
    .filter((u) => u.isProvider)
    .map((u) => u.id);
  await ensureClinicAvailability(admin, orgId, providerIds);

  // 4. Services (Event Types)
  const ownerId = usersMap.get("owner")?.id;
  const eventTypesMap = await ensureServices(admin, orgId, profile, ownerId);

  // 5. Pipeline & Stages
  const { pipelineId, stagesMap } = await ensurePipeline(admin, orgId, profile);

  // 6. Contacts, Leads & Conversations
  const contactsMap = await ensureContacts(admin, orgId, pipelineId, stagesMap, profile, usersMap);

  // 7. Appointments
  const appointments = await ensureAppointments(admin, orgId, profile, eventTypesMap, usersMap, contactsMap);

  // 8. Track demo creation event
  await trackDemoEvent(orgId, "demo_created", {
    slug: profile.slug,
    country: profile.country,
    orgName: profile.orgName,
  }, { adminClient: admin, profile: profile.id, country: profile.country });

  return {
    tenantId: orgId,
    tenantName: profile.orgName,
    slug: profile.slug,
    locale: profile.language,
    timezone: profile.timezone,
    users: Array.from(usersMap.values()).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    })),
    services: Array.from(eventTypesMap.values()).map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
    })),
    contacts: Array.from(contactsMap.values()).map((c) => ({
      id: c.contactId,
      name: c.name,
      phone: c.phone,
      stage: c.stageName,
    })),
    appointments,
  };
}

export async function cleanupDemoProfile(
  profile: DemoProfile,
  customEnv?: Record<string, string | undefined>,
  customAdmin?: SupabaseClient,
): Promise<{ deleted: boolean; tenantId?: string }> {
  const { supabaseUrl, serviceRoleKey } = assertSafetyGuards(customEnv);
  const admin =
    customAdmin ??
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", profile.slug)
    .maybeSingle();

  if (!org) return { deleted: false };
  const orgId = (org as { id: string }).id;

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

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 500 });
  if (userList) {
    for (const spec of profile.users) {
      const match = userList.users.find(
        (u: { email?: string; id: string }) => u.email?.toLowerCase() === spec.email.toLowerCase(),
      );
      if (match) await admin.auth.admin.deleteUser(match.id);
    }
  }

  return { deleted: true, tenantId: orgId };
}
