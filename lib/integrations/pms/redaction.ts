/**
 * PMS cleanup that runs as part of contact anonymization.
 * It preserves the external contact mapping as a disabled tombstone so a later
 * PMS sync cannot recreate the person, and removes appointment mirrors linked
 * to that contact or to its PMS patient identity.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { PmsProviderName } from "./types";

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
    (/pms_appointment_mirrors|pms_external_mappings/i.test(error.message || "") &&
      /not found|schema cache|does not exist/i.test(error.message || ""))
  );
}

interface ContactMappingIdentity {
  id: string;
  provider: PmsProviderName;
  external_id: string;
}

export async function suppressPmsDataForAnonymizedContact(
  organizationId: string,
  contactId: string,
): Promise<PmsContactRedactionResult> {
  const client = createAdminClient();

  const { data: contactMappings, error: contactMappingReadError } = await client
    .from("pms_external_mappings")
    .select("id,provider,external_id")
    .eq("organization_id", organizationId)
    .eq("entity_type", "contact")
    .eq("deskcomm_id", contactId);
  if (contactMappingReadError) {
    if (tableUnavailable(contactMappingReadError)) {
      return {
        available: false,
        contactMappingsDisabled: 0,
        appointmentMirrorsDeleted: 0,
        appointmentMappingsDeleted: 0,
      };
    }
    throw new Error(
      `[PMS Redaction] Contact mapping lookup failed: ${contactMappingReadError.message}`,
    );
  }

  const identities = (contactMappings ?? []) as ContactMappingIdentity[];
  const mirrorIds = new Set<string>();

  const { data: linkedMirrors, error: mirrorReadError } = await client
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
  for (const row of linkedMirrors ?? []) mirrorIds.add(String(row.id));

  // Some mirrors may have been imported before their patient contact was mapped.
  // Match those by the server-only external patient identity as well.
  for (const identity of identities) {
    const { data: externalMirrors, error } = await client
      .from("pms_appointment_mirrors")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("provider", identity.provider)
      .eq("patient_external_id", identity.external_id);
    if (error) {
      throw new Error(
        `[PMS Redaction] External patient mirror lookup failed: ${error.message}`,
      );
    }
    for (const row of externalMirrors ?? []) mirrorIds.add(String(row.id));
  }

  const mirrorIdList = Array.from(mirrorIds);
  let appointmentMappingsDeleted = 0;
  if (mirrorIdList.length > 0) {
    const { data: deletedMappings, error: mappingDeleteError } = await client
      .from("pms_external_mappings")
      .delete()
      .eq("organization_id", organizationId)
      .eq("entity_type", "appointment")
      .in("deskcomm_id", mirrorIdList)
      .select("id");
    if (mappingDeleteError) {
      throw new Error(
        `[PMS Redaction] Appointment mapping cleanup failed: ${mappingDeleteError.message}`,
      );
    }
    appointmentMappingsDeleted = deletedMappings?.length ?? 0;
  }

  let appointmentMirrorsDeleted = 0;
  if (mirrorIdList.length > 0) {
    const { data: deletedMirrors, error: mirrorDeleteError } = await client
      .from("pms_appointment_mirrors")
      .delete()
      .eq("organization_id", organizationId)
      .in("id", mirrorIdList)
      .select("id");
    if (mirrorDeleteError) {
      throw new Error(
        `[PMS Redaction] Appointment mirror cleanup failed: ${mirrorDeleteError.message}`,
      );
    }
    appointmentMirrorsDeleted = deletedMirrors?.length ?? 0;
  }

  let contactMappingsDisabled = 0;
  const contactMappingIds = identities.map((mapping) => mapping.id);
  if (contactMappingIds.length > 0) {
    const { data: disabledMappings, error: mappingDisableError } = await client
      .from("pms_external_mappings")
      .update({ sync_status: "disabled", conflict_type: null })
      .eq("organization_id", organizationId)
      .in("id", contactMappingIds)
      .select("id");
    if (mappingDisableError) {
      throw new Error(
        `[PMS Redaction] Contact mapping disable failed: ${mappingDisableError.message}`,
      );
    }
    contactMappingsDisabled = disabledMappings?.length ?? 0;
  }

  return {
    available: true,
    contactMappingsDisabled,
    appointmentMirrorsDeleted,
    appointmentMappingsDeleted,
  };
}
