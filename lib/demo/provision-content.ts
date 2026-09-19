import type { SupabaseClient } from "@supabase/supabase-js";
import { instanteDe, partesNoFuso } from "@/lib/agenda/fuso";
import type { DentalDemoTemplate, DemoAppointmentSpec } from "./types";

export interface SeededDemoContact {
  contactId: string;
  conversationId: string;
  leadId?: string;
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

export async function seedDemoContacts(
  admin: SupabaseClient,
  params: {
    orgId: string;
    template: DentalDemoTemplate;
    token: string;
    pipelineId: string;
    stages: Map<string, string>;
    channelId: string;
    operatorId: string;
  },
): Promise<Map<string, SeededDemoContact>> {
  const contacts = new Map<string, SeededDemoContact>();

  for (const [contactIndex, spec] of params.template.contacts.entries()) {
    const { data: contact, error: contactError } = await admin.from("contacts").insert({
      organization_id: params.orgId,
      name: spec.name,
      display_name: spec.name,
      phone_number: spec.phoneNumber,
      email: spec.email,
      tags: spec.tags,
      source: "manual",
      source_metadata: { demo: true, synthetic: true, interest: spec.interest },
    }).select("id").single();
    if (contactError || !contact) {
      throw new Error(`Demo contact: ${contactError?.message || "create failed"}`);
    }
    const contactId = String(contact.id);

    const stageId = params.stages.get(spec.stageSlug);
    let leadId: string | undefined;
    if (stageId) {
      const won = spec.status === "won";
      const { data: lead, error: leadError } = await admin.from("crm_leads").insert({
        organization_id: params.orgId,
        pipeline_id: params.pipelineId,
        stage_id: stageId,
        contact_id: contactId,
        title: `${spec.name} — ${spec.interest}`,
        status: won ? "won" : "open",
        closed_at: won ? new Date().toISOString() : null,
        currency: params.template.currency,
        owner_user_id: params.operatorId,
        source: "manual",
        source_metadata: { demo: true, synthetic: true },
        tags: spec.tags,
      }).select("id").single();
      if (leadError || !lead) {
        throw new Error(`Demo lead: ${leadError?.message || "create failed"}`);
      }
      leadId = String(lead.id);
    }

    const { data: conversation, error: conversationError } = await admin.from("conversations").insert({
      organization_id: params.orgId,
      contact_id: contactId,
      channel_session_id: params.channelId,
      channel: "whatsapp",
      status: "claimed",
      assigned_to_user_id: params.operatorId,
      assigned_at: new Date().toISOString(),
      metadata: { demo: true, synthetic: true },
    }).select("id").single();
    if (conversationError || !conversation) {
      throw new Error(`Demo conversation: ${conversationError?.message || "create failed"}`);
    }
    const conversationId = String(conversation.id);

    let lastMessageAt: string | null = null;
    let lastInboundAt: string | null = null;
    let lastOutboundAt: string | null = null;
    let lastPreview = "";

    for (const [messageIndex, message] of spec.conversationMessages.entries()) {
      const createdAt = new Date(Date.now() - message.hoursAgo * 3600_000).toISOString();
      const inbound = message.direction === "inbound";
      const { error } = await admin.from("messages").insert({
        organization_id: params.orgId,
        conversation_id: conversationId,
        channel_session_id: params.channelId,
        contact_id: contactId,
        external_id: `demo-${params.token}-${contactIndex}-${messageIndex}`,
        type: "text",
        direction: message.direction,
        status: inbound ? "received" : "sent",
        body: message.body,
        sent_via: inbound ? "external_device" : "user",
        sent_by_user_id: inbound ? null : params.operatorId,
        sent_at: createdAt,
        created_at: createdAt,
        metadata: { demo: true, synthetic: true },
      });
      if (error) throw new Error(`Demo message: ${error.message}`);

      if (!lastMessageAt || createdAt > lastMessageAt) {
        lastMessageAt = createdAt;
        lastPreview = message.body.slice(0, 160);
      }
      if (inbound && (!lastInboundAt || createdAt > lastInboundAt)) lastInboundAt = createdAt;
      if (!inbound && (!lastOutboundAt || createdAt > lastOutboundAt)) lastOutboundAt = createdAt;
    }

    await admin.from("conversations").update({
      last_message_at: lastMessageAt,
      last_inbound_at: lastInboundAt,
      last_outbound_at: lastOutboundAt,
      last_message_preview: lastPreview,
      unread_count_for_assignee: 0,
    }).eq("id", conversationId).eq("organization_id", params.orgId);

    contacts.set(spec.name, { contactId, conversationId, leadId });
  }

  return contacts;
}

export async function seedDemoAppointments(
  admin: SupabaseClient,
  params: {
    orgId: string;
    template: DentalDemoTemplate;
    contacts: Map<string, SeededDemoContact>;
    eventTypes: Map<string, string>;
    users: Map<string, { id: string; name: string }>;
    ownerId: string;
  },
): Promise<void> {
  for (const appointment of params.template.appointments) {
    const contact = params.contacts.get(appointment.patientName);
    const eventTypeId = params.eventTypes.get(appointment.eventTypeSlug);
    const provider = params.users.get(appointment.providerKey);
    if (!contact || !eventTypeId || !provider) continue;

    const startsAt = appointmentInstant(params.template, appointment);
    const endsAt = new Date(startsAt.getTime() + appointment.durationMinutes * 60_000);
    const status = appointment.status === "scheduled" ? "pending" : appointment.status;
    const serviceName =
      params.template.services.find((service) => service.slug === appointment.eventTypeSlug)?.name ||
      "Consulta";

    const { data, error } = await admin.from("calendar_appointments").insert({
      organization_id: params.orgId,
      event_type_id: eventTypeId,
      title: `${appointment.patientName} — ${serviceName}`,
      description: appointment.notes,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      time_zone: params.template.timezone,
      status,
      owner_user_id: provider.id,
      contact_id: contact.contactId,
      conversation_id: contact.conversationId,
      notes: appointment.notes,
      created_by_kind: "system",
      created_by_user_id: params.ownerId,
      source: "ui",
    }).select("id").single();
    if (error || !data) {
      throw new Error(`Demo appointment: ${error?.message || "create failed"}`);
    }

    if (contact.leadId) {
      const { error: linkError } = await admin.from("crm_lead_links").insert({
        organization_id: params.orgId,
        lead_id: contact.leadId,
        target_kind: "appointment",
        target_id: String(data.id),
        link_kind: "related",
        metadata: { demo: true },
        created_by_user_id: params.ownerId,
      });
      if (linkError) throw new Error(`Demo appointment link: ${linkError.message}`);
    }
  }
}
