/**
 * scripts/demo/lib/provision-contacts-leads.ts
 *
 * Provision demo contacts, CRM leads, conversations, and messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoContactSpec } from "./types";

export const DEMO_CONTACTS_SPECS: DemoContactSpec[] = [
  {
    name: "Carlos Rodríguez",
    phoneNumber: "+573001234567",
    email: "carlos.rodriguez@example.co",
    status: "new",
    stageSlug: "nuevo_contacto",
    interest: "Blanqueamiento dental",
    tags: ["blanqueamiento", "lead-nuevo"],
    conversationMessages: [
      {
        direction: "inbound",
        body: "Hola, buenos días. Quisiera pedir información sobre el blanqueamiento dental en Bogotá, ¿cuántas sesiones son y qué cuidados requiere?",
        hoursAgo: 4,
      },
      {
        direction: "outbound",
        body: "¡Hola Carlos! Qué gusto saludarte. En Clínica Sonrisa Bogotá realizamos blanqueamiento LED profesional en 2 sesiones con excelentes resultados. ¿Te gustaría agendar una consulta inicial de valoración para revisar tu caso?",
        hoursAgo: 3.5,
      },
      {
        direction: "inbound",
        body: "Sí, perfecto. Me queda bien en horas de la mañana con la Dra. Laura Martínez.",
        hoursAgo: 3,
      },
    ],
  },
  {
    name: "Mariana López",
    phoneNumber: "+573009876543",
    email: "mariana.lopez@example.co",
    status: "lost",
    stageSlug: "interesado",
    interest: "Implante dental",
    tags: ["implante", "lead-recuperable"],
    lostReason: "Presupuesto pendiente de financiamiento",
    conversationMessages: [
      {
        direction: "inbound",
        body: "Buenas tardes, estoy cotizando un implante dental para una muela inferior que perdí hace un tiempo.",
        hoursAgo: 48,
      },
      {
        direction: "outbound",
        body: "Hola Mariana, bienvenida a Clínica Sonrisa Bogotá. El Dr. Andrés Gómez es nuestro implantólogo especialista y puede valorar tu tomografía y hueso para indicarte la mejor alternativa.",
        hoursAgo: 46,
      },
      {
        direction: "inbound",
        body: "Muchas gracias, por ahora el presupuesto se me sale un poco de lo previsto, así que voy a esperar un par de semanas.",
        hoursAgo: 24,
      },
      {
        direction: "outbound",
        body: "Entendemos perfectamente Mariana. Recuerda que contamos con planes de financiación directa sin intereses. Te dejamos la valoración abierta para cuando decidas iniciar.",
        hoursAgo: 22,
      },
    ],
  },
  {
    name: "Juan Pérez",
    phoneNumber: "+573105551234",
    email: "juan.perez@example.co",
    status: "won",
    stageSlug: "paciente_recurrente",
    interest: "Rehabilitación y control",
    tags: ["paciente-activo", "rehabilitacion"],
    conversationMessages: [
      {
        direction: "inbound",
        body: "Hola equipo de Clínica Sonrisa, ya pasaron dos semanas desde mi último procedimiento y todo va evolucionando muy bien.",
        hoursAgo: 360, // ~15 days ago
      },
      {
        direction: "outbound",
        body: "¡Excelente noticia Juan! La Dra. Sofía Torres nos indicó agendar tu cita de control post tratamiento para verificar la oclusión y adaptación final.",
        hoursAgo: 358,
      },
      {
        direction: "inbound",
        body: "Listo, quedo pendiente de la fecha de mi cita de control. ¡Muchas gracias!",
        hoursAgo: 356,
      },
    ],
  },
];

export async function ensureClinicContactsAndLeads(
  admin: SupabaseClient,
  orgId: string,
  pipelineId: string,
  stagesMap: Map<string, { id: string; name: string; slug: string }>,
  usersMap: Map<string, { id: string; email: string; name: string; role: string; isProvider: boolean }>,
): Promise<Map<string, { contactId: string; name: string; phone: string; stageName: string }>> {
  const result = new Map<string, { contactId: string; name: string; phone: string; stageName: string }>();
  const operator = usersMap.get("operator") || usersMap.get("owner");

  for (const spec of DEMO_CONTACTS_SPECS) {
    // 1. Ensure Contact
    const { data: existingContact } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("phone_number", spec.phoneNumber)
      .maybeSingle();

    let contactId: string;
    if (existingContact) {
      contactId = (existingContact as { id: string }).id;
      await admin
        .from("contacts")
        .update({
          name: spec.name,
          display_name: spec.name,
          email: spec.email,
          tags: spec.tags,
          locale: "es",
        } as never)
        .eq("id", contactId);
    } else {
      const { data: createdContact, error: cErr } = await admin
        .from("contacts")
        .insert({
          organization_id: orgId,
          name: spec.name,
          display_name: spec.name,
          phone_number: spec.phoneNumber,
          email: spec.email,
          locale: "es",
          source: "whatsapp",
          tags: spec.tags,
          created_by_user_id: operator?.id ?? null,
        } as never)
        .select("id")
        .single();

      if (cErr || !createdContact) {
        throw new Error(`Failed to create contact ${spec.name}: ${cErr?.message}`);
      }
      contactId = (createdContact as { id: string }).id;
    }

    // 2. Ensure CRM Lead
    const targetStage = stagesMap.get(spec.stageSlug);
    if (!targetStage) throw new Error(`Stage not found: ${spec.stageSlug}`);

    const { data: existingLead } = await admin
      .from("crm_leads")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", contactId)
      .maybeSingle();

    const leadPayload = {
      organization_id: orgId,
      pipeline_id: pipelineId,
      stage_id: targetStage.id,
      contact_id: contactId,
      title: `${spec.name} — ${spec.interest}`,
      status: spec.status,
      tags: spec.tags,
      lost_reason: spec.lostReason ?? null,
      owner_user_id: operator?.id ?? null,
      owner_kind: "user",
      source: "whatsapp",
    };

    if (existingLead) {
      await admin
        .from("crm_leads")
        .update(leadPayload as never)
        .eq("id", (existingLead as { id: string }).id);
    } else {
      const { error: lErr } = await admin
        .from("crm_leads")
        .insert({ ...leadPayload, position_in_stage: 1 } as never);
      if (lErr) throw new Error(`Failed to create lead for ${spec.name}: ${lErr.message}`);
    }

    // 3. Ensure Conversation and Messages
    await ensureConversationAndMessages(admin, orgId, contactId, spec, operator?.id);

    result.set(spec.name, {
      contactId,
      name: spec.name,
      phone: spec.phoneNumber,
      stageName: targetStage.name,
    });
  }

  return result;
}

async function ensureConversationAndMessages(
  admin: SupabaseClient,
  orgId: string,
  contactId: string,
  spec: DemoContactSpec,
  operatorId?: string,
): Promise<void> {
  const { data: existingConv } = await admin
    .from("conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .maybeSingle();

  let conversationId: string;

  if (existingConv) {
    conversationId = (existingConv as { id: string }).id;
  } else {
    const { data: createdConv, error: convErr } = await admin
      .from("conversations")
      .insert({
        organization_id: orgId,
        contact_id: contactId,
        channel: "whatsapp",
        channel_session_id: "default",
        status: spec.status === "lost" ? "closed" : "open",
        status_changed_at: new Date().toISOString(),
        assigned_to_user_id: operatorId ?? null,
        assignee_kind: "user",
        last_message_at: new Date().toISOString(),
        last_message_preview: spec.conversationMessages[spec.conversationMessages.length - 1]?.body || "",
        tags: spec.tags,
        unread_count_for_assignee: 0,
      } as never)
      .select("id")
      .single();

    if (convErr || !createdConv) {
      throw new Error(`Failed to create conversation for ${spec.name}: ${convErr?.message}`);
    }
    conversationId = (createdConv as { id: string }).id;
  }

  // Insert sample messages if not already present
  const { data: existingMsgs } = await admin
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .limit(1);

  if (!existingMsgs || existingMsgs.length === 0) {
    const now = Date.now();
    for (const msg of spec.conversationMessages) {
      const msgTime = new Date(now - msg.hoursAgo * 3600 * 1000).toISOString();
      await admin.from("messages").insert({
        organization_id: orgId,
        conversation_id: conversationId,
        contact_id: contactId,
        channel_session_id: "default",
        direction: msg.direction,
        body: msg.body,
        type: "text",
        status: "read",
        sent_at: msgTime,
        sent_by_user_id: msg.direction === "outbound" ? operatorId ?? null : null,
        sent_via: "whatsapp",
      } as never);
    }
  }
}
