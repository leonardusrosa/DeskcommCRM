/** Materializes PMS administrative data into safe Deskcomm-owned projections. */

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AdministrativeAppointment,
  AdministrativeContact,
  PmsExternalMappingRecord,
  PmsProviderName,
} from "./types";

export interface PmsProjectionResult {
  deskcommId: string;
  /** Timestamp observed before a contact write; used to detect local edits safely. */
  deskcommUpdatedAt?: string;
  applied: boolean;
}

export interface PmsEntityProjector {
  projectContact(params: {
    tenantId: string;
    provider: PmsProviderName;
    contact: AdministrativeContact;
    existingMapping: PmsExternalMappingRecord | null;
  }): Promise<PmsProjectionResult>;

  projectAppointment(params: {
    tenantId: string;
    provider: PmsProviderName;
    appointment: AdministrativeAppointment;
    contactDeskcommId?: string;
    externalVersion: string;
    existingMapping: PmsExternalMappingRecord | null;
  }): Promise<PmsProjectionResult>;
}

export class PmsProjectionConflictError extends Error {
  constructor(message: string) {
    super(`[PMS Projection Conflict] ${message}`);
    this.name = "PmsProjectionConflictError";
  }
}

function normalizePhone(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!value.startsWith("+")) {
    throw new PmsProjectionConflictError("Administrative phone is not E.164 and cannot be stored safely.");
  }
  const normalized = `+${value.replace(/\D/g, "")}`;
  if (!/^\+\d{8,15}$/.test(normalized)) {
    throw new PmsProjectionConflictError("Administrative phone is not a valid E.164 number.");
  }
  return normalized;
}

function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw new PmsProjectionConflictError("Administrative email is invalid and cannot be stored safely.");
  }
  return value;
}

function pmsMarker(provider: PmsProviderName, externalId: string): Record<string, unknown> {
  return {
    pms: {
      provider,
      external_id: externalId,
      source_of_truth: "pms",
      managed_fields: ["name", "display_name", "phone_number", "email"],
    },
  };
}

function markerMatches(
  metadata: unknown,
  provider: PmsProviderName,
  externalId: string,
): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const pms = (metadata as { pms?: unknown }).pms;
  if (!pms || typeof pms !== "object") return false;
  const record = pms as Record<string, unknown>;
  return record.provider === provider && record.external_id === externalId;
}

interface ContactRow {
  id: string;
  updated_at: string;
  is_anonymized: boolean;
  source_metadata: Record<string, unknown> | null;
}

export class SupabasePmsEntityProjector implements PmsEntityProjector {
  public async projectContact(params: {
    tenantId: string;
    provider: PmsProviderName;
    contact: AdministrativeContact;
    existingMapping: PmsExternalMappingRecord | null;
  }): Promise<PmsProjectionResult> {
    const client = createAdminClient();
    const phone = normalizePhone(params.contact.phone);
    const email = normalizeEmail(params.contact.email);
    const marker = pmsMarker(params.provider, params.contact.externalId);

    if (params.existingMapping) {
      const { data: existing, error } = await client
        .from("contacts")
        .select("id,updated_at,is_anonymized,source_metadata")
        .eq("organization_id", params.tenantId)
        .eq("id", params.existingMapping.deskcommId)
        .maybeSingle();
      if (error) throw new Error(`[PMS Projection] Contact read failed: ${error.message}`);
      if (!existing) {
        throw new PmsProjectionConflictError(
          `Mapped Deskcomm contact "${params.existingMapping.deskcommId}" no longer exists.`,
        );
      }

      const row = existing as ContactRow;
      const locallyChanged =
        row.is_anonymized || row.updated_at > params.existingMapping.lastSyncedAt;
      if (locallyChanged) {
        return {
          deskcommId: row.id,
          deskcommUpdatedAt: row.updated_at,
          applied: false,
        };
      }

      const { error: updateError } = await client
        .from("contacts")
        .update({
          name: params.contact.name,
          display_name: params.contact.name,
          phone_number: phone,
          email,
          source: "pms",
          source_metadata: { ...(row.source_metadata || {}), ...marker },
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", params.tenantId)
        .eq("id", row.id);
      if (updateError) {
        if (updateError.code === "23505") {
          throw new PmsProjectionConflictError(
            "Updated PMS identity collides with another Deskcomm contact; automatic merge is forbidden.",
          );
        }
        throw new Error(`[PMS Projection] Contact update failed: ${updateError.message}`);
      }
      return { deskcommId: row.id, deskcommUpdatedAt: row.updated_at, applied: true };
    }

    const collisions = new Map<string, ContactRow>();
    const collect = async (column: "phone_number" | "email_normalized", value: string | null) => {
      if (!value) return;
      const { data, error } = await client
        .from("contacts")
        .select("id,updated_at,is_anonymized,source_metadata")
        .eq("organization_id", params.tenantId)
        .eq(column, value)
        .maybeSingle();
      if (error) throw new Error(`[PMS Projection] Identity lookup failed: ${error.message}`);
      if (data) collisions.set(String(data.id), data as ContactRow);
    };
    await collect("phone_number", phone);
    await collect("email_normalized", email);

    if (collisions.size > 0) {
      if (
        collisions.size === 1 &&
        markerMatches(
          Array.from(collisions.values())[0]!.source_metadata,
          params.provider,
          params.contact.externalId,
        )
      ) {
        const row = Array.from(collisions.values())[0]!;
        if (row.is_anonymized) {
          throw new PmsProjectionConflictError("An anonymized Deskcomm contact cannot be rehydrated from PMS.");
        }
        const { error: recoveryError } = await client
          .from("contacts")
          .update({
            name: params.contact.name,
            display_name: params.contact.name,
            phone_number: phone,
            email,
            source: "pms",
            source_metadata: { ...(row.source_metadata || {}), ...marker },
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", params.tenantId)
          .eq("id", row.id);
        if (recoveryError) {
          throw new Error(`[PMS Projection] Contact recovery update failed: ${recoveryError.message}`);
        }
        return { deskcommId: row.id, applied: true };
      }

      throw new PmsProjectionConflictError(
        "PMS identity matches an existing Deskcomm contact; automatic phone/email merge is forbidden.",
      );
    }

    const { data: created, error: createError } = await client
      .from("contacts")
      .insert({
        organization_id: params.tenantId,
        name: params.contact.name,
        display_name: params.contact.name,
        phone_number: phone,
        email,
        source: "pms",
        source_metadata: marker,
      })
      .select("id")
      .single();
    if (createError || !created) {
      if (createError?.code === "23505") {
        throw new PmsProjectionConflictError(
          "PMS identity raced with an existing Deskcomm contact; automatic merge is forbidden.",
        );
      }
      throw new Error(`[PMS Projection] Contact create failed: ${createError?.message || "unknown error"}`);
    }
    return { deskcommId: String(created.id), applied: true };
  }

  public async projectAppointment(params: {
    tenantId: string;
    provider: PmsProviderName;
    appointment: AdministrativeAppointment;
    contactDeskcommId?: string;
    externalVersion: string;
    existingMapping: PmsExternalMappingRecord | null;
  }): Promise<PmsProjectionResult> {
    const client = createAdminClient();
    const startsAt = new Date(params.appointment.start);
    const endsAt = params.appointment.end ? new Date(params.appointment.end) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      throw new PmsProjectionConflictError("Appointment timestamps are invalid.");
    }

    let mirrorId = params.existingMapping?.deskcommId;
    if (mirrorId) {
      const { data, error } = await client
        .from("pms_appointment_mirrors")
        .select("id")
        .eq("organization_id", params.tenantId)
        .eq("provider", params.provider)
        .eq("id", mirrorId)
        .maybeSingle();
      if (error) throw new Error(`[PMS Projection] Appointment mirror read failed: ${error.message}`);
      if (!data) mirrorId = undefined;
    }

    if (!mirrorId) {
      const { data, error } = await client
        .from("pms_appointment_mirrors")
        .select("id")
        .eq("organization_id", params.tenantId)
        .eq("provider", params.provider)
        .eq("external_id", params.appointment.externalId)
        .maybeSingle();
      if (error) throw new Error(`[PMS Projection] Appointment mirror lookup failed: ${error.message}`);
      if (data) mirrorId = String(data.id);
    }

    const row = {
      organization_id: params.tenantId,
      provider: params.provider,
      external_id: params.appointment.externalId,
      patient_external_id: params.appointment.patientExternalId || null,
      contact_id: params.contactDeskcommId || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() || null,
      provider_label: params.appointment.provider || null,
      status: params.appointment.status,
      appointment_label: params.appointment.appointmentLabel,
      external_version: params.externalVersion,
      updated_at: new Date().toISOString(),
    };

    if (mirrorId) {
      const { error } = await client
        .from("pms_appointment_mirrors")
        .update(row)
        .eq("organization_id", params.tenantId)
        .eq("provider", params.provider)
        .eq("id", mirrorId);
      if (error) throw new Error(`[PMS Projection] Appointment mirror update failed: ${error.message}`);
      return { deskcommId: mirrorId, applied: true };
    }

    const { data: created, error } = await client
      .from("pms_appointment_mirrors")
      .insert(row)
      .select("id")
      .single();
    if (error || !created) {
      throw new Error(`[PMS Projection] Appointment mirror create failed: ${error?.message || "unknown error"}`);
    }
    return { deskcommId: String(created.id), applied: true };
  }
}

/** Test-only projector: produces real UUID-shaped Deskcomm ids without touching Supabase. */
export class InMemoryPmsEntityProjector implements PmsEntityProjector {
  private readonly ids = new Map<string, string>();

  private idFor(key: string, existingMapping: PmsExternalMappingRecord | null): string {
    if (existingMapping?.deskcommId) return existingMapping.deskcommId;
    const current = this.ids.get(key);
    if (current) return current;
    const id = crypto.randomUUID();
    this.ids.set(key, id);
    return id;
  }

  public async projectContact(params: {
    tenantId: string;
    provider: PmsProviderName;
    contact: AdministrativeContact;
    existingMapping: PmsExternalMappingRecord | null;
  }): Promise<PmsProjectionResult> {
    return {
      deskcommId: this.idFor(
        `${params.tenantId}::${params.provider}::contact::${params.contact.externalId}`,
        params.existingMapping,
      ),
      applied: true,
    };
  }

  public async projectAppointment(params: {
    tenantId: string;
    provider: PmsProviderName;
    appointment: AdministrativeAppointment;
    existingMapping: PmsExternalMappingRecord | null;
  }): Promise<PmsProjectionResult> {
    return {
      deskcommId: this.idFor(
        `${params.tenantId}::${params.provider}::appointment::${params.appointment.externalId}`,
        params.existingMapping,
      ),
      applied: true,
    };
  }
}

export const defaultPmsEntityProjector: PmsEntityProjector = new SupabasePmsEntityProjector();
