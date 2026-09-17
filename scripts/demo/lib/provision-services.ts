/**
 * scripts/demo/lib/provision-services.ts
 *
 * Provision appointment types / services for Clínica Sonrisa Bogotá.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoServiceSpec } from "./types";

export const DEMO_SERVICES_SPECS: DemoServiceSpec[] = [
  {
    name: "Consulta inicial",
    slug: "consulta-inicial",
    durationMinutes: 30,
    description: "Evaluación clínica general, diagnóstico odontológico inicial y plan de tratamiento.",
    color: "#2563EB",
  },
  {
    name: "Limpieza dental",
    slug: "limpieza-dental",
    durationMinutes: 60,
    description: "Profilaxis profunda con ultrasonido, pulido coronal y aplicación de flúor.",
    color: "#059669",
  },
  {
    name: "Blanqueamiento dental",
    slug: "blanqueamiento-dental",
    durationMinutes: 90,
    description: "Aclaramiento dental profesional en consultorio con tecnología láser LED.",
    color: "#D97706",
  },
  {
    name: "Implante dental",
    slug: "implante-dental",
    durationMinutes: 120,
    description: "Colocación quirúrgica de implante de titanio y evaluación de oseointegración.",
    color: "#7C3AED",
  },
  {
    name: "Control post tratamiento",
    slug: "control-post-tratamiento",
    durationMinutes: 30,
    description: "Revisión de evolución, ajustes oclusales y control postoperatorio.",
    color: "#4B5563",
  },
];

export async function ensureClinicEventTypes(
  admin: SupabaseClient,
  orgId: string,
  defaultOwnerId?: string,
): Promise<Map<string, { id: string; name: string; slug: string; durationMinutes: number }>> {
  const result = new Map<string, { id: string; name: string; slug: string; durationMinutes: number }>();

  for (const spec of DEMO_SERVICES_SPECS) {
    const { data: existing } = await admin
      .from("calendar_event_types")
      .select("id, name, slug, duration_minutes")
      .eq("organization_id", orgId)
      .eq("slug", spec.slug)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await admin
        .from("calendar_event_types")
        .update({
          name: spec.name,
          description: spec.description,
          duration_minutes: spec.durationMinutes,
          is_active: true,
          booking_window_days: 60,
          minimum_notice_minutes: 60,
          requires_confirmation: false,
          location_kind: "in_person",
          ...(defaultOwnerId ? { default_owner_user_id: defaultOwnerId } : {}),
        } as never)
        .eq("id", (existing as { id: string }).id)
        .select("id, name, slug, duration_minutes")
        .single();

      if (error || !updated) {
        throw new Error(`Failed to update service ${spec.name}: ${error?.message}`);
      }

      const row = updated as { id: string; name: string; slug: string; duration_minutes: number };
      result.set(spec.slug, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        durationMinutes: row.duration_minutes,
      });
    } else {
      const { data: created, error } = await admin
        .from("calendar_event_types")
        .insert({
          organization_id: orgId,
          name: spec.name,
          slug: spec.slug,
          description: spec.description,
          duration_minutes: spec.durationMinutes,
          booking_window_days: 60,
          minimum_notice_minutes: 60,
          requires_confirmation: false,
          location_kind: "in_person",
          is_active: true,
          ...(defaultOwnerId ? { default_owner_user_id: defaultOwnerId } : {}),
        } as never)
        .select("id, name, slug, duration_minutes")
        .single();

      if (error || !created) {
        throw new Error(`Failed to create service ${spec.name}: ${error?.message}`);
      }

      const row = created as { id: string; name: string; slug: string; duration_minutes: number };
      result.set(spec.slug, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        durationMinutes: row.duration_minutes,
      });
    }
  }

  return result;
}
