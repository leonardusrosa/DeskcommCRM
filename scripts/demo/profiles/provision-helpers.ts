/**
 * scripts/demo/profiles/provision-helpers.ts
 *
 * Provisioning helper functions for Demo Profiles.
 * Keeps engine.ts concise, modular, and focused.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoProfile } from "./types";
import type { DemoSeedSummary, DemoUserSpec } from "../lib/types";

export async function ensureOrg(admin: SupabaseClient, profile: DemoProfile): Promise<string> {
  const { data: existing } = await admin.from("organizations").select("id").eq("slug", profile.slug).maybeSingle();
  
  // Default expiration: 7 days from now
  const demoExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    slug: profile.slug,
    display_name: profile.orgName,
    legal_name: profile.legalName,
    timezone: profile.timezone,
    locale: profile.language,
    settings: {
      demo: true,
      country: profile.country,
      industry: profile.industry,
      scenario: profile.scenario,
      demo_expires_at: demoExpiresAt,
    },
  };

  if (existing) {
    const orgId = (existing as { id: string }).id;
    await admin.from("organizations").update(payload).eq("id", orgId);
    return orgId;
  }
  const { data: created, error } = await admin.from("organizations").insert(payload).select("id").single();
  if (error) throw new Error(`Failed to create org: ${error.message}`);
  return (created as { id: string }).id;
}

export async function ensureUsers(admin: SupabaseClient, orgId: string, specs: DemoUserSpec[], password: string) {
  const map = new Map<string, { id: string; email: string; name: string; role: "admin" | "agent"; isProvider: boolean }>();
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 500 });
  const existingUsers = userList?.users || [];

  for (const spec of specs) {
    let authUser = existingUsers.find((u: { email?: string }) => u.email?.toLowerCase() === spec.email.toLowerCase());
    if (!authUser) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: spec.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: spec.name, title: spec.title, demo: true },
      });
      if (error) throw new Error(`Failed to create user ${spec.email}: ${error.message}`);
      authUser = created.user;
    } else {
      await admin.auth.admin.updateUserById(authUser.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: spec.name, title: spec.title, demo: true },
      });
    }

    await admin.from("user_organizations").upsert(
      { user_id: authUser.id, organization_id: orgId, role: spec.role },
      { onConflict: "user_id,organization_id" },
    );
    map.set(spec.key, { id: authUser.id, email: spec.email, name: spec.name, role: spec.role, isProvider: spec.isProvider });
  }
  return map;
}

export async function ensureServices(admin: SupabaseClient, orgId: string, profile: DemoProfile, ownerId?: string) {
  const map = new Map<string, { id: string; name: string; slug: string; durationMinutes: number }>();
  for (const srv of profile.services) {
    const { data: existing } = await admin.from("calendar_event_types").select("id").eq("organization_id", orgId).eq("slug", srv.slug).maybeSingle();
    const payload = {
      organization_id: orgId,
      user_id: ownerId,
      name: srv.name,
      slug: srv.slug,
      duration_minutes: srv.durationMinutes,
      description: srv.description,
      is_active: true,
      color: srv.color || "#0284c7",
    };
    if (existing) {
      const id = (existing as { id: string }).id;
      await admin.from("calendar_event_types").update(payload).eq("id", id);
      map.set(srv.slug, { id, name: srv.name, slug: srv.slug, durationMinutes: srv.durationMinutes });
    } else {
      const { data: created, error } = await admin.from("calendar_event_types").insert(payload).select("id").single();
      if (error) throw new Error(`Failed service ${srv.slug}: ${error.message}`);
      const id = (created as { id: string }).id;
      map.set(srv.slug, { id, name: srv.name, slug: srv.slug, durationMinutes: srv.durationMinutes });
    }
  }
  return map;
}

export async function ensurePipeline(admin: SupabaseClient, orgId: string, profile: DemoProfile) {
  const { data: existingPipe } = await admin.from("crm_pipelines").select("id").eq("organization_id", orgId).eq("slug", profile.pipeline.slug).maybeSingle();
  let pipelineId = "";
  if (existingPipe) {
    pipelineId = (existingPipe as { id: string }).id;
  } else {
    const { data: created, error } = await admin.from("crm_pipelines").insert({
      organization_id: orgId,
      name: profile.pipeline.name,
      slug: profile.pipeline.slug,
      is_default: true,
    }).select("id").single();
    if (error) throw new Error(`Failed pipeline: ${error.message}`);
    pipelineId = (created as { id: string }).id;
  }

  const stagesMap = new Map<string, { id: string; name: string; slug: string }>();
  for (const st of profile.pipeline.stages) {
    const { data: existingSt } = await admin.from("crm_stages").select("id").eq("pipeline_id", pipelineId).eq("slug", st.slug).maybeSingle();
    const payload = {
      pipeline_id: pipelineId,
      organization_id: orgId,
      name: st.name,
      slug: st.slug,
      position: st.position,
      is_won: Boolean(st.isWon),
      is_lost: Boolean(st.isLost),
    };
    if (existingSt) {
      const id = (existingSt as { id: string }).id;
      await admin.from("crm_stages").update(payload).eq("id", id);
      stagesMap.set(st.slug, { id, name: st.name, slug: st.slug });
    } else {
      const { data: created, error } = await admin.from("crm_stages").insert(payload).select("id").single();
      if (error) throw new Error(`Failed stage ${st.slug}: ${error.message}`);
      stagesMap.set(st.slug, { id: (created as { id: string }).id, name: st.name, slug: st.slug });
    }
  }
  return { pipelineId, stagesMap };
}

export async function ensureContacts(
  admin: SupabaseClient,
  orgId: string,
  pipelineId: string,
  stagesMap: Map<string, { id: string; name: string; slug: string }>,
  profile: DemoProfile,
  usersMap: Map<string, { id: string; name: string }>,
) {
  const map = new Map<string, { contactId: string; name: string; phone: string; stageName: string }>();
  const operator = usersMap.get("operator") || usersMap.get("owner");

  for (const spec of profile.contacts) {
    const { data: existingContact } = await admin.from("contacts").select("id").eq("organization_id", orgId).eq("phone_number", spec.phoneNumber).maybeSingle();
    let contactId = "";
    if (existingContact) {
      contactId = (existingContact as { id: string }).id;
      await admin.from("contacts").update({ name: spec.name, email: spec.email }).eq("id", contactId);
    } else {
      const { data: created, error } = await admin.from("contacts").insert({
        organization_id: orgId,
        name: spec.name,
        phone_number: spec.phoneNumber,
        email: spec.email,
        source: "whatsapp",
      }).select("id").single();
      if (error) throw new Error(`Failed contact ${spec.name}: ${error.message}`);
      contactId = (created as { id: string }).id;
    }

    const stage = stagesMap.get(spec.stageSlug);
    if (stage) {
      const { data: existingLead } = await admin.from("crm_leads").select("id").eq("organization_id", orgId).eq("contact_id", contactId).maybeSingle();
      const leadPayload = {
        organization_id: orgId,
        contact_id: contactId,
        pipeline_id: pipelineId,
        stage_id: stage.id,
        title: `${spec.name} - ${spec.interest}`,
        status: spec.status,
        owner_id: operator?.id,
      };
      if (existingLead) {
        await admin.from("crm_leads").update(leadPayload).eq("id", (existingLead as { id: string }).id);
      } else {
        await admin.from("crm_leads").insert(leadPayload);
      }
    }

    const { data: existingConv } = await admin.from("conversations").select("id").eq("organization_id", orgId).eq("contact_id", contactId).maybeSingle();
    let convId = "";
    if (existingConv) {
      convId = (existingConv as { id: string }).id;
    } else {
      const { data: createdConv, error } = await admin.from("conversations").insert({
        organization_id: orgId,
        contact_id: contactId,
        channel: "whatsapp",
        status: "open",
      }).select("id").single();
      if (error) throw new Error(`Failed conversation: ${error.message}`);
      convId = (createdConv as { id: string }).id;
    }

    for (const msg of spec.conversationMessages) {
      const createdAt = new Date(Date.now() - msg.hoursAgo * 3600 * 1000).toISOString();
      await admin.from("messages").insert({
        organization_id: orgId,
        conversation_id: convId,
        contact_id: contactId,
        direction: msg.direction,
        body: msg.body,
        created_at: createdAt,
      });
    }

    map.set(spec.name, { contactId, name: spec.name, phone: spec.phoneNumber, stageName: stage?.name || spec.stageSlug });
  }
  return map;
}

export async function ensureAppointments(
  admin: SupabaseClient,
  orgId: string,
  profile: DemoProfile,
  eventTypesMap: Map<string, { id: string; name: string; durationMinutes: number }>,
  usersMap: Map<string, { id: string; name: string }>,
  contactsMap: Map<string, { contactId: string; name: string }>,
) {
  const appointments: DemoSeedSummary["appointments"] = [];
  for (const appt of profile.appointments) {
    const eventType = eventTypesMap.get(appt.eventTypeSlug);
    const provider = usersMap.get(appt.providerKey);
    const contact = contactsMap.get(appt.patientName);
    if (!eventType || !provider || !contact) continue;

    const d = new Date();
    d.setDate(d.getDate() + appt.daysOffset);
    d.setHours(appt.localHour, appt.localMinute, 0, 0);
    const startsAt = d.toISOString();
    const endsAt = new Date(d.getTime() + appt.durationMinutes * 60000).toISOString();

    const { data: created } = await admin.from("calendar_appointments").insert({
      organization_id: orgId,
      event_type_id: eventType.id,
      user_id: provider.id,
      contact_id: contact.contactId,
      title: `${eventType.name} — ${contact.name}`,
      description: appt.notes,
      starts_at: startsAt,
      ends_at: endsAt,
      status: appt.status,
      timezone: profile.timezone,
    }).select("id, title, starts_at, status").single();

    if (created) {
      appointments.push({
        id: (created as { id: string }).id,
        title: (created as { title: string }).title,
        patient: contact.name,
        provider: provider.name,
        startsAt: (created as { starts_at: string }).starts_at,
        status: (created as { status: string }).status,
      });
    }
  }
  return appointments;
}
