/**
 * PMS cleanup that runs as part of contact anonymization.
 * It preserves the external contact mapping as a disabled tombstone so a later
 * PMS sync cannot recreate the person, and removes appointment mirrors linked
 * to that contact.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface PmsContactRedactionResult {
  available: boolean;
  contactMappingsDisabled: number;
  appointmentMirrorsDeleted: number;
  appointmentMappingsDeleted: number;
}

function tableUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /pms_appointment_mirrors|pms_external_mappings/i.test(error.message || "") &&
      /not found|schema cache|does not exist/i.test(error.message || "")
  );
}

export async function suppressPmsDataForAnonymizedContact(
  organizationId: string,
  contactId: string,
): Promise<PmsContactRedactionResult> {
  const client = createAdminClient();

  const { data: mirrors, error: mirrorReadError } = await client
    .from("pms_appointment_mirrors")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId);

  if (mirrorReadError) {
    if (tableUnavailable(mirrorReadError)) {
      return {
        available: false,
        contactMappingsDisabled: 0,
        appointmentMirrorsDeleted: 0,
        appointmentMappingsDeleted: 0,
      };
    }
    throw new Error(`[PMS Redaction] Mirror lookup failed: ${mirrorReadError.message}`);
  }

  const mirrorIds = (mirrors ?? []).map((row) => String(row.id));
  let appointmentMappingsDeleted = 0;
  if (mirrorIds.length > 0) {
    const { data: deletedMappings, error: mappingDeleteError } = await client
      .from("pms_external_mappings")
      .delete()
      .eq("organization_id", organizationId)
      .eq("entity_type", "appointment")
      .in("deskcomm_id", mirrorIds)
      .select("id");
    if (mappingDeleteError) {
      throw new Error(
        `[PMS Redaction] Appointment mapping cleanup failed: ${mappingDeleteError.message}`,
      );
    }
    appointmentMappingsDeleted = deletedMappings?.length ?? 0;
  }

  let appointmentMirrorsDeleted = 0;
  if (mirrorIds.length > 0) {
    const { data: deletedMirrors, error: mirrorDeleteError } = await client
      .from("pms_appointment_mirrors")
      .delete()
      .eq("organization_id", organizationId)
      .in("id", mirrorIds)
      .select("id");
    if (mirrorDeleteError) {
      throw new Error(
        `[PMS Redaction] Appointment mirror cleanup failed: ${mirrorDeleteError.message}`,
      );
    }
    appointmentMirrorsDeleted = deletedMirrors?.length ?? 0;
  }

  const { data: disabledMappings, error: mappingDisableError } = await client
    .from("pms_external_mappings")
    .update({ sync_status: "disabled", conflict_type: null })
    .eq("organization_id", organizationId)
    .eq("entity_type", "contact")
    .eq("deskcomm_id", contactId)
    .select("id");
  if (mappingDisableError) {
    if (tableUnavailable(mappingDisableError)) {
      return {
        available: false,
        contactMappingsDisabled: 0,
        appointmentMirrorsDeleted,
        appointmentMappingsDeleted,
      };
    }
    throw new Error(
      `[PMS Redaction] Contact mapping disable failed: ${mappingDisableError.message}`,
    );
  }

  return {
    available: true,
    contactMappingsDisabled: disabledMappings?.length ?? 0,
    appointmentMirrorsDeleted,
    appointmentMappingsDeleted,
  };
}
