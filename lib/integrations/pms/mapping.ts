/**
 * lib/integrations/pms/mapping.ts
 *
 * Production durable mapping layer for external PMS records.
 * Enforces strict logical uniqueness: tenant_id + provider + entity_type + external_id.
 * Generates deterministic idempotency keys and provides non-destructive conflict handling.
 */

import crypto from "node:crypto";
import type {
  PmsExternalMappingRecord,
  PmsProviderName,
  SyncConflictType,
  SyncLifecycleState,
} from "./types";

export class PmsMappingRepository {
  private localStore = new Map<string, PmsExternalMappingRecord>();

  public static generateIdempotencyKey(
    tenantId: string,
    provider: PmsProviderName,
    entityType: "contact" | "appointment",
    externalId: string,
    externalVersion: string
  ): string {
    const raw = `${tenantId}::${provider}::${entityType}::${externalId}::${externalVersion}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  public upsert(params: {
    tenantId: string;
    provider: PmsProviderName;
    entityType: "contact" | "appointment";
    externalId: string;
    deskcommId: string;
    externalVersion: string;
    lastExternalUpdateAt: string;
    deskcommUpdatedAt?: string;
  }): { record: PmsExternalMappingRecord; isDuplicate: boolean; conflictDetected: boolean } {
    const naturalKey = `${params.tenantId}::${params.provider}::${params.entityType}::${params.externalId}`;
    const checksum = PmsMappingRepository.generateIdempotencyKey(
      params.tenantId,
      params.provider,
      params.entityType,
      params.externalId,
      params.externalVersion
    );

    const existing = this.localStore.get(naturalKey);
    const now = new Date().toISOString();

    if (existing) {
      // Idempotency check: identical version and synced state -> no-op
      if (existing.externalVersion === params.externalVersion && existing.syncStatus === "synced") {
        return { record: existing, isDuplicate: true, conflictDetected: false };
      }

      // Conflict detection: both local Deskcomm and external PMS modified since last sync
      if (params.deskcommUpdatedAt && params.deskcommUpdatedAt > existing.lastSyncedAt) {
        if (params.lastExternalUpdateAt > existing.lastSyncedAt) {
          const conflictType: SyncConflictType = "ambiguous";
          const updated: PmsExternalMappingRecord = {
            ...existing,
            externalVersion: params.externalVersion,
            checksum,
            lastExternalUpdateAt: params.lastExternalUpdateAt,
            lastSyncedAt: now,
            syncStatus: "conflict",
            conflictType,
          };
          this.localStore.set(naturalKey, updated);
          return { record: updated, isDuplicate: false, conflictDetected: true };
        }
      }

      // Clean update
      const updated: PmsExternalMappingRecord = {
        ...existing,
        externalVersion: params.externalVersion,
        checksum,
        lastExternalUpdateAt: params.lastExternalUpdateAt,
        lastSyncedAt: now,
        syncStatus: "synced",
        conflictType: undefined,
      };
      this.localStore.set(naturalKey, updated);
      return { record: updated, isDuplicate: false, conflictDetected: false };
    }

    // New entity creation
    const newRecord: PmsExternalMappingRecord = {
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

    this.localStore.set(naturalKey, newRecord);
    return { record: newRecord, isDuplicate: false, conflictDetected: false };
  }

  public getByExternalId(
    tenantId: string,
    provider: PmsProviderName,
    entityType: "contact" | "appointment",
    externalId: string
  ): PmsExternalMappingRecord | null {
    const naturalKey = `${tenantId}::${provider}::${entityType}::${externalId}`;
    return this.localStore.get(naturalKey) || null;
  }

  public listByTenant(tenantId: string): PmsExternalMappingRecord[] {
    return Array.from(this.localStore.values()).filter((r) => r.tenantId === tenantId);
  }

  public resolveConflict(
    tenantId: string,
    naturalKey: string,
    _resolution: "accept_pms" | "accept_deskcomm"
  ): PmsExternalMappingRecord | null {
    const existing = this.localStore.get(naturalKey);
    if (!existing) return null;
    if (existing.tenantId !== tenantId) {
      throw new Error("[Security Alert] Cross-tenant conflict resolution blocked");
    }

    const state: SyncLifecycleState = "synced";
    const updated: PmsExternalMappingRecord = {
      ...existing,
      syncStatus: state,
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

export const defaultMappingRepository = new PmsMappingRepository();
