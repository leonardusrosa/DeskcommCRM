/**
 * PMS external mapping stores.
 * Runtime defaults to Supabase durability; the in-memory repository remains test-only friendly.
 */

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PmsExternalMappingRecord,
  PmsProviderName,
  SyncConflictType,
  SyncLifecycleState,
} from "./types";

export interface PmsMappingUpsertParams {
  tenantId: string;
  provider: PmsProviderName;
  entityType: "contact" | "appointment";
  externalId: string;
  deskcommId: string;
  externalVersion: string;
  lastExternalUpdateAt: string;
  deskcommUpdatedAt?: string;
}

export interface PmsMappingUpsertResult {
  record: PmsExternalMappingRecord;
  isDuplicate: boolean;
  conflictDetected: boolean;
}

export interface PmsMappingStore {
  getByExternalId(
    tenantId: string,
    provider: PmsProviderName,
    entityType: "contact" | "appointment",
    externalId: string,
  ): PmsExternalMappingRecord | null | Promise<PmsExternalMappingRecord | null>;
  upsert(params: PmsMappingUpsertParams): PmsMappingUpsertResult | Promise<PmsMappingUpsertResult>;
}

function idempotencyKey(params: PmsMappingUpsertParams): string {
  const raw = `${params.tenantId}::${params.provider}::${params.entityType}::${params.externalId}::${params.externalVersion}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function toRecord(row: Record<string, unknown>): PmsExternalMappingRecord {
  return {
    id: String(row.id),
    tenantId: String(row.organization_id),
    provider: row.provider as PmsProviderName,
    entityType: row.entity_type as "contact" | "appointment",
    externalId: String(row.external_id),
    deskcommId: String(row.deskcomm_id),
    externalVersion: String(row.external_version),
    checksum: String(row.checksum),
    lastExternalUpdateAt: String(row.last_external_update_at),
    lastSyncedAt: String(row.last_synced_at),
    syncStatus: row.sync_status as SyncLifecycleState,
    conflictType: (row.conflict_type || undefined) as SyncConflictType | undefined,
  };
}

/** In-memory store for deterministic unit/integration tests only. */
export class PmsMappingRepository implements PmsMappingStore {
  private localStore = new Map<string, PmsExternalMappingRecord>();

  public static generateIdempotencyKey(
    tenantId: string,
    provider: PmsProviderName,
    entityType: "contact" | "appointment",
    externalId: string,
    externalVersion: string,
  ): string {
    return idempotencyKey({
      tenantId,
      provider,
      entityType,
      externalId,
      externalVersion,
      deskcommId: "",
      lastExternalUpdateAt: "",
    });
  }

  public upsert(params: PmsMappingUpsertParams): PmsMappingUpsertResult {
    const naturalKey = `${params.tenantId}::${params.provider}::${params.entityType}::${params.externalId}`;
    const checksum = idempotencyKey(params);
    const existing = this.localStore.get(naturalKey);
    const now = new Date().toISOString();

    if (existing) {
      if (existing.externalVersion === params.externalVersion && existing.syncStatus === "synced") {
        return { record: existing, isDuplicate: true, conflictDetected: false };
      }

      const concurrent =
        Boolean(params.deskcommUpdatedAt) &&
        params.deskcommUpdatedAt! > existing.lastSyncedAt &&
        params.lastExternalUpdateAt > existing.lastSyncedAt;
      const updated: PmsExternalMappingRecord = {
        ...existing,
        deskcommId: params.deskcommId,
        externalVersion: params.externalVersion,
        checksum,
        lastExternalUpdateAt: params.lastExternalUpdateAt,
        lastSyncedAt: now,
        syncStatus: concurrent ? "conflict" : "synced",
        conflictType: concurrent ? "ambiguous" : undefined,
      };
      this.localStore.set(naturalKey, updated);
      return { record: updated, isDuplicate: false, conflictDetected: concurrent };
    }

    const record: PmsExternalMappingRecord = {
      id: `map-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: params.tenantId,
      provider: params.provider,
      entityType: params.entityType,
      externalId: params.externalId,
      deskcommId: params.deskcommId,
      externalVersion: params.externalVersion,
      checksum,
      lastExternalUpdateAt: params.lastExternalUpdateAt,
      lastSyncedAt: now,
      syncStatus: "synced",
    };
    this.localStore.set(naturalKey, record);
    return { record, isDuplicate: false, conflictDetected: false };
  }

  public getByExternalId(
    tenantId: string,
    provider: PmsProviderName,
    entityType: "contact" | "appointment",
    externalId: string,
  ): PmsExternalMappingRecord | null {
    return this.localStore.get(`${tenantId}::${provider}::${entityType}::${externalId}`) || null;
  }

  public listByTenant(tenantId: string): PmsExternalMappingRecord[] {
    return Array.from(this.localStore.values()).filter((record) => record.tenantId === tenantId);
  }

  public resolveConflict(
    tenantId: string,
    naturalKey: string,
    _resolution: "accept_pms" | "accept_deskcomm",
  ): PmsExternalMappingRecord | null {
    const existing = this.localStore.get(naturalKey);
    if (!existing) return null;
    if (existing.tenantId !== tenantId) {
      throw new Error("[Security Alert] Cross-tenant conflict resolution blocked");
    }
    const updated = {
      ...existing,
      syncStatus: "synced" as SyncLifecycleState,
      conflictType: undefined,
      lastSyncedAt: new Date().toISOString(),
    };
    this.localStore.set(naturalKey, updated);
    return updated;
  }

  public clear(): void {
    this.localStore.clear();
  }
}

/** Runtime store. Service-role access is always explicitly scoped by organization_id. */
export class SupabasePmsMappingRepository implements PmsMappingStore {
  public async getByExternalId(
    tenantId: string,
    provider: PmsProviderName,
    entityType: "contact" | "appointment",
    externalId: string,
  ): Promise<PmsExternalMappingRecord | null> {
    const { data, error } = await createAdminClient()
      .from("pms_external_mappings")
      .select("*")
      .eq("organization_id", tenantId)
      .eq("provider", provider)
      .eq("entity_type", entityType)
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) throw new Error(`[PMS Mapping] Read failed: ${error.message}`);
    return data ? toRecord(data) : null;
  }

  public async upsert(params: PmsMappingUpsertParams): Promise<PmsMappingUpsertResult> {
    const client = createAdminClient();
    const existingRecord = await this.getByExternalId(
      params.tenantId,
      params.provider,
      params.entityType,
      params.externalId,
    );

    const checksum = idempotencyKey(params);
    const now = new Date().toISOString();
    if (
      existingRecord &&
      existingRecord.externalVersion === params.externalVersion &&
      existingRecord.syncStatus === "synced"
    ) {
      return { record: existingRecord, isDuplicate: true, conflictDetected: false };
    }

    const concurrent = Boolean(
      existingRecord &&
        params.deskcommUpdatedAt &&
        params.deskcommUpdatedAt > existingRecord.lastSyncedAt &&
        params.lastExternalUpdateAt > existingRecord.lastSyncedAt,
    );

    const row = {
      organization_id: params.tenantId,
      provider: params.provider,
      entity_type: params.entityType,
      external_id: params.externalId,
      deskcomm_id: params.deskcommId,
      external_version: params.externalVersion,
      checksum,
      last_external_update_at: params.lastExternalUpdateAt,
      last_synced_at: now,
      sync_status: concurrent ? "conflict" : "synced",
      conflict_type: concurrent ? "ambiguous" : null,
    };

    const { data, error } = await client
      .from("pms_external_mappings")
      .upsert(row, { onConflict: "organization_id,provider,entity_type,external_id" })
      .select("*")
      .single();

    if (error) throw new Error(`[PMS Mapping] Upsert failed: ${error.message}`);
    return { record: toRecord(data), isDuplicate: false, conflictDetected: concurrent };
  }
}

export const defaultMappingRepository: PmsMappingStore = new SupabasePmsMappingRepository();
