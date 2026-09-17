import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { instanteDe, partesNoFuso } from "@/lib/agenda/fuso";
import { assertDemoProvisioningAllowed } from "./safety";
import type {
  DentalDemoTemplate,
  DemoAppointmentSpec,
  DemoProvisionSummary,
} from "./types";

const DEMO_EMAIL_DOMAIN = "demo.deskcomm.invalid";

const DEMO_PHONE_BY_COUNTRY: Record<DentalDemoTemplate["country"], string> = {
  CO: "+573009990001",
  MX: "+525599990001",
  ES: "+34699990001",
  PT: "+351919990001",
};

function instanceToken(): string {
  return crypto.randomBytes(4).toString("hex");
}

function demoPassword(): string {
  return `Demo-${crypto.randomBytes(12).toString("base64url")}`;
}

function demoEmail(source: string, token: string): string {
  const local = source.split("@")[0]!.replace(/[^a-z0-9._-]/gi, "").toLowerCase() || "user";
  return `${local}+${token}@${DEMO_EMAIL_DOMAIN}`;
}

function appointmentInstant(template: DentalDemoTemplate, appointment: DemoAppointmentSpec): Date {
  const localNow = partesNoFuso(new Date(), template.timezone);
  const calendar = new Date(Date.UTC(localNow.ano, localNow.mes - 1, localNow.dia));
  calendar.setUTCDate(calendar.getUTCDate() + appointment.daysOffset);
  return instanteDe(
    {
      ano: calendar.getUTCFullYear(),
      mes: calendar.getUTCMonth() + 1,
      dia: calendar.getUTCDate(),
      hora: appointment.localHour,
      minuto: appointment.localMinute,
    },
    template.timezone,
  );
}

function schedule(timezone: string) {
  return {
    timezone,
    windows: [
      ...[1, 2, 3, 4, 5].flatMap((dow) => [
        { dow, start: "08:00", end: "12:30" },
        { dow, start: "14:00", end: "18:00" },
      ]),
      { dow: 6, start: "09:00", end: "13:00" },
    ],
  };
}

function serviceCategory(slug: string): "consulta" | "procedimento" | "retorno" {
  if (slug.includes("control") || slug.includes("retorno")) return "retorno";
  if (slug.includes("consulta")) return "consulta";
  return "procedimento";
}

export async function provisionDentalDemo(
  template: DentalDemoTemplate,
  requestedCompany?: string,
): Promise<DemoProvisionSummary> {
  assertDemoProvisioningAllowed();
  const admin = createAdminClient();
  const token = instanceToken();
  const password = demoPassword();
  const slug = `${template.slug}-${token}`;
  const createdUserIds: string[] = [];
  let orgId: string | null = null;

  try {
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        slug,
        display_name: requestedCompany?.trim() || template.orgName,
        legal_name: template.legalName,
        timezone: template.timezone,
        locale: template.locale,
        settings: {
          demo: true,
          synthetic_data: true,
          vertical: "dental-clinic",
          country: template.country,
          currency: template.currency,
          scenario: template.scenario,
          demo_expires_at: expiresAt,
        },
        onboarded_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (orgError || !org) throw new Error(`Demo organization: ${orgError?.message || "create failed"}`);
    orgId = String(org.id);

    const users = new Map<string, { id: string; name: string }>();
    for (const spec of template.users) {
      const email = demoEmail(spec.email, token);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: spec.name,
          title: spec.title,
          locale: template.locale,
          timezone: template.timezone,
          demo: true,
        },
      });
      if (error || !data.user) throw new Error(`Demo user: ${error?.message || "create failed"}`);
      createdUserIds.push(data.user.id);
      const { error: membershipError } = await admin.from("user_organizations").insert({
        user_id: data.user.id,
        organization_id: orgId,
        role: spec.role,
        accepted_at: new Date().toISOString(),
      });
      if (membershipError) throw new Error(`Demo membership: ${membershipError.message}`);
      users.set(spec.key, { id: data.user.id, name: spec.name });
    }

    const providerIds = template.users
      .filter((spec) => spec.isProvider)
      .map((spec) => users.get(spec.key)?.id)
      .filter((id): id is string => Boolean(id));
    for (const userId of providerIds) {
      const { error } = await admin.from("attendant_availability").insert({
        organization_id: orgId,
        user_id: userId,
        is_available: true,
        capacity: 10,
        schedule: schedule(template.timezone),
      });
      if (error) throw new Error(`Demo availability: ${error.message}`);
    }

    const ownerId = users.get("owner")!.id;
    const operatorId = users.get("operator")?.id || ownerId;
    const { data: channel, error: channelError } = await admin
      .from("channel_sessions")
      .insert({
        organization_id: orgId,
        waha_session_name: `demo-${template.country.toLowerCase()}-${token}`,
        webhook_secret_encrypted: "\\x64656d6f",
        status: "WORKING",
        phone_number: DEMO_PHONE_BY_COUNTRY[template.country],
        display_name: "WhatsApp Demo",
        metadata: { demo: true, synthetic: true },
        created_by: ownerId,
      })
      .select("id")
      .single();
    if (channelError || !channel) throw new Error(`Demo channel: ${channelError?.message || "create failed"}`);
    const channelId = String(channel.id);

    const eventTypes = new Map<string, string>();
    for (const [index, spec] of template.services.entries()) {
      const { data, error } = await admin.from("calendar_event_types").insert({
        organization_id: orgId,
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        category: serviceCategory(spec.slug),
        duration_minutes: spec.durationMinutes,
        color: spec.color || "#0284c7",
        default_owner_user_id: ownerId,
        position: (index + 1) * 1000,
        reminder_enabled: false,
      }).select("id").single();
      if (error || !data) throw new Error(`Demo service: ${error?.message || "create failed"}`);
      eventTypes.set(spec.slug, String(data.id));
    }

    const { data: pipeline, error: pipelineError } = await admin.from("crm_pipelines").insert({
      organization_id: orgId,
      name: template.pipeline.name,
      slug: template.pipeline.slug,
      is_default: true,
      vocabulary: {
        lead: template.locale === "pt-PT" ? "Paciente" : "Paciente",
        lead_plural: template.locale === "pt-PT" ? "Pacientes" : "Pacientes",
        deal: template.locale === "pt-PT" ? "Tratamento" : "Tratamiento",
        deal_plural: template.locale === "pt-PT" ? "Tratamentos" : "Tratamientos",
        won: template.locale === "pt-PT" ? "Aceite" : "Vendido",
        lost: template.locale === "pt-PT" ? "Perdido" : "Perdido",
        stage: template.locale === "pt-PT" ? "Etapa" : "Etapa",
        stage_plural: template.locale === "pt-PT" ? "Etapas" : "Etapas",
      },
    }).select("id").single();
    if (pipelineError || !pipeline) throw new Error(`Demo pipeline: ${pipelineError?.message || "create failed"}`);
    const pipelineId = String(pipeline.id);

    const stages = new Map<string, string>();
    for (const stage of template.pipeline.stages) {
      const { data, error } = await admin.from("crm_stages").insert({
        organization_id: orgId,
        pipeline_id: pipelineId,
        name: stage.name,
        slug: stage.slug,
        position: stage.position * 1000,
        is_won: Boolean(stage.isWon),
        is_lost: Boolean(stage.isLost),
      }).select("id").single();
      if (error || !data) throw new Error(`Demo stage: ${error?.message || "create failed"}`);
      stages.set(stage.slug, String(data.id));
    }

    const contacts = new Map<string, { contactId: string; conversationId: string; leadId?: string }>();
    for (const [contactIndex, spec] of template.contacts.entries()) {
      const { data: contact, error: contactError } = await admin.from("contacts").insert({
        organization_id: orgId,
        name: spec.name,
        display_name: spec.name,
        phone_number: spec.phoneNumber,
        email: spec.email,
        tags: spec.tags,
        source: "manual",
        source_metadata: { demo: true, synthetic: true, interest: spec.interest },
      }).select("id").single();
      if (contactError || !contact) throw new Error(`Demo contact: ${contactError?.message || "create failed"}`);
      const contactId = String(contact.id);

      const stageId = stages.get(spec.stageSlug);
      let leadId: string | undefined;
      if (stageId) {
        const won = spec.status === "won";
        const { data: lead, error: leadError } = await admin.from("crm_leads").insert({
          organization_id: orgId,
          pipeline_id: pipelineId,
          stage_id: stageId,
          contact_id: contactId,
          title: `${spec.name} — ${spec.interest}`,
          status: won ? "won" : "open",
          closed_at: won ? new Date().toISOString() : null,
          currency: template.currency,
          owner_user_id: operatorId,
          source: "manual",
          source_metadata: { demo: true, synthetic: true },
          tags: spec.tags,
        }).select("id").single();
        if (leadError || !lead) throw new Error(`Demo lead: ${leadError?.message || "create failed"}`);
        leadId = String(lead.id);
      }

      const { data: conversation, error: conversationError } = await admin.from("conversations").insert({
        organization_id: orgId,
        contact_id: contactId,
        channel_session_id: channelId,
        channel: "whatsapp",
        status: "claimed",
        assigned_to_user_id: operatorId,
        assigned_at: new Date().toISOString(),
        metadata: { demo: true, synthetic: true },
      }).select("id").single();
      if (conversationError || !conversation) throw new Error(`Demo conversation: ${conversationError?.message || "create failed"}`);
      const conversationId = String(conversation.id);

      let lastMessageAt: string | null = null;
      let lastInboundAt: string | null = null;
      let lastOutboundAt: string | null = null;
      let lastPreview = "";
      for (const [messageIndex, message] of spec.conversationMessages.entries()) {
        const createdAt = new Date(Date.now() - message.hoursAgo * 3600_000).toISOString();
        const inbound = message.direction === "inbound";
        const { error } = await admin.from("messages").insert({
          organization_id: orgId,
          conversation_id: conversationId,
          channel_session_id: channelId,
          contact_id: contactId,
          external_id: `demo-${token}-${contactIndex}-${messageIndex}`,
          type: "text",
          direction: message.direction,
          status: inbound ? "received" : "sent",
          body: message.body,
          sent_via: inbound ? "external_device" : "user",
          sent_by_user_id: inbound ? null : operatorId,
          sent_at: createdAt,
          created_at: createdAt,
          metadata: { demo: true, synthetic: true },
        });
        if (error) throw new Error(`Demo message: ${error.message}`);
        lastMessageAt = !lastMessageAt || createdAt > lastMessageAt ? createdAt : lastMessageAt;
        if (inbound) lastInboundAt = !lastInboundAt || createdAt > lastInboundAt ? createdAt : lastInboundAt;
        else lastOutboundAt = !lastOutboundAt || createdAt > lastOutboundAt ? createdAt : lastOutboundAt;
        if (createdAt === lastMessageAt) lastPreview = message.body.slice(0, 160);
      }
      await admin.from("conversations").update({
        last_message_at: lastMessageAt,
        last_inbound_at: lastInboundAt,
        last_outbound_at: lastOutboundAt,
        last_message_preview: lastPreview,
        unread_count_for_assignee: 0,
      }).eq("id", conversationId).eq("organization_id", orgId);

      contacts.set(spec.name, { contactId, conversationId, leadId });
    }

    for (const appointment of template.appointments) {
      const contact = contacts.get(appointment.patientName);
      const eventTypeId = eventTypes.get(appointment.eventTypeSlug);
      const provider = users.get(appointment.providerKey);
      if (!contact || !eventTypeId || !provider) continue;
      const startsAt = appointmentInstant(template, appointment);
      const endsAt = new Date(startsAt.getTime() + appointment.durationMinutes * 60_000);
      const status = appointment.status === "scheduled" ? "pending" : appointment.status;
      const { data, error } = await admin.from("calendar_appointments").insert({
        organization_id: orgId,
        event_type_id: eventTypeId,
        title: `${appointment.patientName} — ${template.services.find((s) => s.slug === appointment.eventTypeSlug)?.name || "Consulta"}`,
        description: appointment.notes,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        time_zone: template.timezone,
        status,
        owner_user_id: provider.id,
        contact_id: contact.contactId,
        conversation_id: contact.conversationId,
        notes: appointment.notes,
        created_by_kind: "system",
        created_by_user_id: ownerId,
        source: "ui",
      }).select("id").single();
      if (error || !data) throw new Error(`Demo appointment: ${error?.message || "create failed"}`);
      if (contact.leadId) {
        await admin.from("crm_lead_links").insert({
          organization_id: orgId,
          lead_id: contact.leadId,
          target_kind: "appointment",
          target_id: String(data.id),
          link_kind: "related",
          metadata: { demo: true },
          created_by_user_id: ownerId,
        });
      }
    }

    return {
      tenantId: orgId,
      slug,
      clinicName: requestedCompany?.trim() || template.orgName,
      country: template.country,
      ownerEmail: demoEmail(template.users[0]!.email, token),
      password,
    };
  } catch (error) {
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    throw error;
  }
}
