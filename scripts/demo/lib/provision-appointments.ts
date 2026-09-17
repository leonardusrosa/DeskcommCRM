/**
 * scripts/demo/lib/provision-appointments.ts
 *
 * Provision demo appointments in calendar_appointments for Clínica Sonrisa Bogotá.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_CLINIC_TIMEZONE } from "./types";

export interface AppointmentSeedResult {
  id: string;
  title: string;
  patient: string;
  provider: string;
  startsAt: string;
  status: string;
}

/**
 * Calculates a UTC ISO string for a given date offset and local hour/minute in America/Bogota (UTC-5).
 */
function getBogotaIsoTime(daysOffset: number, localHour: number, localMinute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(localHour).padStart(2, "0");
  const minute = String(localMinute).padStart(2, "0");

  // America/Bogota is UTC-5 (no daylight saving time)
  return `${year}-${month}-${day}T${hour}:${minute}:00-05:00`;
}

export async function ensureClinicAppointments(
  admin: SupabaseClient,
  orgId: string,
  eventTypesMap: Map<string, { id: string; name: string; slug: string; durationMinutes: number }>,
  usersMap: Map<string, { id: string; email: string; name: string; role: string; isProvider: boolean }>,
  contactsMap: Map<string, { contactId: string; name: string; phone: string }>,
): Promise<AppointmentSeedResult[]> {
  const draLaura = usersMap.get("owner");
  const drAndres = usersMap.get("dentist1");
  const draSofia = usersMap.get("dentist2");

  const carlos = contactsMap.get("Carlos Rodríguez");
  const mariana = contactsMap.get("Mariana López");
  const juan = contactsMap.get("Juan Pérez");

  const consultaInicial = eventTypesMap.get("consulta-inicial");
  const implante = eventTypesMap.get("implante-dental");
  const control = eventTypesMap.get("control-post-tratamiento");
  const limpieza = eventTypesMap.get("limpieza-dental");

  if (!draLaura || !drAndres || !draSofia) {
    throw new Error("Required providers not found in usersMap");
  }
  if (!carlos || !mariana || !juan) {
    throw new Error("Required contacts not found in contactsMap");
  }
  if (!consultaInicial || !implante || !control || !limpieza) {
    throw new Error("Required services not found in eventTypesMap");
  }

  const appointmentsData = [
    // 1. Carlos Rodríguez: Consulta inicial com Dra. Laura Martínez
    {
      title: "Consulta inicial — Carlos Rodríguez",
      eventTypeId: consultaInicial.id,
      contactId: carlos.contactId,
      ownerUserId: draLaura.id,
      startsAt: getBogotaIsoTime(1, 10, 0), // Tomorrow 10:00 Bogota
      durationMinutes: 30,
      status: "confirmed" as const,
      patientName: carlos.name,
      providerName: draLaura.name,
      notes: "Paciente interesado en valoración para blanqueamiento dental.",
    },
    // 2. Mariana López: Evaluación implante com Dr. Andrés Gómez
    {
      title: "Evaluación implante — Mariana López",
      eventTypeId: implante.id,
      contactId: mariana.contactId,
      ownerUserId: drAndres.id,
      startsAt: getBogotaIsoTime(2, 15, 0), // In 2 days 15:00 Bogota
      durationMinutes: 120,
      status: "confirmed" as const,
      patientName: mariana.name,
      providerName: drAndres.name,
      notes: "Evaluación tomográfica para implante molar inferior.",
    },
    // 3. Juan Pérez: Control post tratamiento com Dra. Sofía Torres
    {
      title: "Control post tratamiento — Juan Pérez",
      eventTypeId: control.id,
      contactId: juan.contactId,
      ownerUserId: draSofia.id,
      startsAt: getBogotaIsoTime(3, 11, 0), // In 3 days 11:00 Bogota
      durationMinutes: 30,
      status: "confirmed" as const,
      patientName: juan.name,
      providerName: draSofia.name,
      notes: "Control postoperatorio y verificación de adaptación oclusal.",
    },
    // 4. Juan Pérez (Histórico / 15 days ago): Limpieza e intervención
    {
      title: "Limpieza y profilaxis — Juan Pérez",
      eventTypeId: limpieza.id,
      contactId: juan.contactId,
      ownerUserId: draSofia.id,
      startsAt: getBogotaIsoTime(-15, 10, 0), // 15 days ago 10:00 Bogota
      durationMinutes: 60,
      status: "completed" as const,
      patientName: juan.name,
      providerName: draSofia.name,
      notes: "Procedimiento realizado satisfactoriamente.",
    },
  ];

  const results: AppointmentSeedResult[] = [];

  for (const item of appointmentsData) {
    const startDate = new Date(item.startsAt);
    const endDate = new Date(startDate.getTime() + item.durationMinutes * 60 * 1000);

    const { data: existing } = await admin
      .from("calendar_appointments")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", item.contactId)
      .eq("starts_at", startDate.toISOString())
      .maybeSingle();

    const appointmentPayload = {
      organization_id: orgId,
      event_type_id: item.eventTypeId,
      contact_id: item.contactId,
      owner_user_id: item.ownerUserId,
      title: item.title,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      time_zone: DEMO_CLINIC_TIMEZONE,
      status: item.status,
      location_kind: "in_person",
      source: "ui",
      notes: item.notes,
      created_by_kind: "user",
      created_by_user_id: item.ownerUserId,
    };

    let appointmentId: string;

    if (existing) {
      appointmentId = (existing as { id: string }).id;
      await admin
        .from("calendar_appointments")
        .update(appointmentPayload as never)
        .eq("id", appointmentId);
    } else {
      const { data: created, error: apptErr } = await admin
        .from("calendar_appointments")
        .insert(appointmentPayload as never)
        .select("id")
        .single();

      if (apptErr || !created) {
        throw new Error(`Failed to create appointment for ${item.patientName}: ${apptErr?.message}`);
      }
      appointmentId = (created as { id: string }).id;
    }

    results.push({
      id: appointmentId,
      title: item.title,
      patient: item.patientName,
      provider: item.providerName,
      startsAt: startDate.toISOString(),
      status: item.status,
    });
  }

  return results;
}
