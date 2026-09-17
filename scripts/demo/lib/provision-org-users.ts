/**
 * scripts/demo/lib/provision-org-users.ts
 *
 * Provision organization and demo users for Clínica Sonrisa Bogotá.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_CLINIC_NAME,
  DEMO_CLINIC_SLUG,
  DEMO_CLINIC_LOCALE,
  DEMO_CLINIC_TIMEZONE,
  type DemoUserSpec,
} from "./types";

export const DEMO_USERS_SPECS: DemoUserSpec[] = [
  {
    key: "owner",
    name: "Dra. Laura Martínez",
    email: process.env.DEMO_CLINIC_OWNER_EMAIL || "laura@sonrisabogota.demo",
    role: "admin",
    isProvider: true,
    title: "Directora Médica & Odontóloga",
  },
  {
    key: "operator",
    name: "Carolina Pérez",
    email: process.env.DEMO_CLINIC_OPERATOR_EMAIL || "carolina@sonrisabogota.demo",
    role: "agent",
    isProvider: false,
    title: "Operadora & Recepción",
  },
  {
    key: "dentist1",
    name: "Dr. Andrés Gómez",
    email: process.env.DEMO_CLINIC_DENTIST1_EMAIL || "andres@sonrisabogota.demo",
    role: "agent",
    isProvider: true,
    title: "Especialista en Implantología",
  },
  {
    key: "dentist2",
    name: "Dra. Sofía Torres",
    email: process.env.DEMO_CLINIC_DENTIST2_EMAIL || "sofia@sonrisabogota.demo",
    role: "agent",
    isProvider: true,
    title: "Especialista en Odontología Estética",
  },
];

export async function ensureDemoOrg(admin: SupabaseClient): Promise<string> {
  const { data: existing, error: findError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", DEMO_CLINIC_SLUG)
    .maybeSingle();

  if (findError) throw new Error(`Failed to check existing org: ${findError.message}`);

  const orgPayload = {
    slug: DEMO_CLINIC_SLUG,
    display_name: DEMO_CLINIC_NAME,
    legal_name: `${DEMO_CLINIC_NAME} S.A.S.`,
    timezone: DEMO_CLINIC_TIMEZONE,
    locale: DEMO_CLINIC_LOCALE,
    onboarded_at: new Date().toISOString(),
    settings: {
      demo: true,
      is_demo: true,
      country: "CO",
      industry: "Dental Clinic",
      business_profile_description:
        "Clínica odontológica de alta gama en Bogotá, Colombia. Especialistas en estética, implantes y rehabilitación oral.",
    },
  };

  if (existing) {
    const { error: updateError } = await admin
      .from("organizations")
      .update(orgPayload as never)
      .eq("id", (existing as { id: string }).id);
    if (updateError) throw new Error(`Failed to update org: ${updateError.message}`);
    return (existing as { id: string }).id;
  }

  const { data: created, error: insertError } = await admin
    .from("organizations")
    .insert(orgPayload as never)
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to create org: ${insertError?.message}`);
  }

  return (created as { id: string }).id;
}

export async function ensureDemoUsers(
  admin: SupabaseClient,
  orgId: string,
  password: string,
): Promise<Map<string, { id: string; email: string; name: string; role: string; isProvider: boolean }>> {
  const { data: userList, error: listError } = await admin.auth.admin.listUsers({ perPage: 500 });
  if (listError) throw new Error(`Failed to list auth users: ${listError.message}`);

  const result = new Map<
    string,
    { id: string; email: string; name: string; role: string; isProvider: boolean }
  >();

  for (const spec of DEMO_USERS_SPECS) {
    const existing = userList.users.find(
      (u: { email?: string; id: string }) => u.email?.toLowerCase() === spec.email.toLowerCase(),
    );

    let userId: string;

    if (existing) {
      userId = existing.id;
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          full_name: spec.name,
          locale: DEMO_CLINIC_LOCALE,
          timezone: DEMO_CLINIC_TIMEZONE,
          title: spec.title,
        },
      });
      if (updErr) throw new Error(`Failed to update user ${spec.email}: ${updErr.message}`);
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: spec.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: spec.name,
          locale: DEMO_CLINIC_LOCALE,
          timezone: DEMO_CLINIC_TIMEZONE,
          title: spec.title,
        },
      });
      if (createErr || !created.user) {
        throw new Error(`Failed to create user ${spec.email}: ${createErr?.message}`);
      }
      userId = created.user.id;
    }

    // Ensure user_organizations membership
    const { data: membership } = await admin
      .from("user_organizations")
      .select("id, role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (membership) {
      await admin
        .from("user_organizations")
        .update({ role: spec.role, revoked_at: null } as never)
        .eq("id", (membership as { id: string }).id);
    } else {
      const { error: memErr } = await admin.from("user_organizations").insert({
        user_id: userId,
        organization_id: orgId,
        role: spec.role,
        accepted_at: new Date().toISOString(),
      } as never);
      if (memErr) throw new Error(`Failed to create membership for ${spec.email}: ${memErr.message}`);
    }

    if (spec.key === "owner") {
      await admin.from("organizations").update({ created_by: userId } as never).eq("id", orgId);
    }

    result.set(spec.key, {
      id: userId,
      email: spec.email,
      name: spec.name,
      role: spec.role,
      isProvider: spec.isProvider,
    });
  }

  return result;
}
