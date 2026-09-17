/**
 * PMS cleanup that runs as part of contact anonymization.
 * It preserves the external contact identity as a disabled tombstone so a later
 * PMS sync cannot recreate the person, and removes appointment mirrors linked
 * to that contact or to its PMS patient identity.
 */

import { createHash } from "node:crypto";
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
  id?: string;
  provider: PmsProviderName;
  external_id: string;
}

const PMS_PROVIDERS = new Set<PmsProviderName>(["newsoft_ds", "gesden", "infomed_dentool"]);

function identityFromMetadata(
  source: unknown,
  metadata: unknown,
): Omit<ContactMappingIdentity, "id"> | null {
  if (source !== "pms" || !metadata || typeof metadata !== "object") return null;
  const pms = (metadata as { pms?: unknown }).pms;
  if (!pms || typeof pms !== "object") return null;
  const record = pms as Record<string, unknown>;
  const provider = String(record.provider || "") as PmsProviderName;
  const externalId = String(record.external_id || "").trim();
  if (!PMS_PROVIDERS.has(provider) || !externalId) return null;
  return { provider, external_id: externalId };
}

function tombstoneChecksum(
  organizationId: string,
  provider: PmsProviderName,
  externalId: string,
): string {
  return createHash("sha256")
    .update(`${organizationId}::${provider}::contact::${externalId}::redacted`)
    .digest("hex");
}

export async function suppressPmsDataForAnonymizedContact(
  organizationId: string,
  contactId: string,
): Promise<PmsContactRedactionResult> {
  const client = createAdminClient();

  const { data: contact, error: contactReadError } = await client
    .from("contacts")
    .select("source,source_metadata")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle();
  if (contactReadError) {
    throw new Error(`[PMS Redaction] Contact lookup failed: ${contactReadError.message}`);
  }

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

  const identities = new Map<string, ContactMappingIdentity>();
  for (const mapping of (contactMappings ?? []) as ContactMappingIdentity[]) {
    identities.set(`${mapping.provider}::${mapping.external_id}`, mapping);
  }

  // If the mapping row was lost but the contact still has its PMS origin marker,
  // preserve that identity as a durable disabled tombstone before source_metadata
  // is cleared by the LGPD flow.
  const markerIdentity = identityFromMetadata(contact?.source, contact?.source_metadata);
  if (markerIdentity) {
    const key = `${markerIdentity.provider}::${markerIdentity.external_id}`;
    if (!identities.has(key)) identities.set(key, markerIdentity);
  }

  const identityList = Array.from(identities.values());
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
  for (const identity of identityList) {
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
  const now = new Date().toISOString();
  for (const identity of identityList) {
    const { data: tombstone, error: tombstoneError } = await client
      .from("pms_external_mappings")
      .upsert(
        {
          organization_id: organizationId,
          provider: identity.provider,
          entity_type: "contact",
          external_id: identity.external_id,
          deskcomm_id: contactId,
          external_version: "redacted",
          checksum: tombstoneChecksum(organizationId, identity.provider, identity.external_id),
          last_external_update_at: now,
          last_synced_at: now,
          sync_status: "disabled",
          conflict_type: null,
        },
        { onConflict: "organization_id,provider,entity_type,external_id" },
      )
      .select("id")
      .single();
    if (tombstoneError || !tombstone) {
      throw new Error(
        `[PMS Redaction] Contact tombstone save failed: ${tombstoneError?.message || "unknown error"}`,
      );
    }
    contactMappingsDisabled += 1;
  }

  return {
    available: true,
    contactMappingsDisabled,
    appointmentMirrorsDeleted,
    appointmentMappingsDeleted,
  };
}
