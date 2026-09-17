/**
 * scripts/demo/lib/demo-pms-mapping.ts
 *
 * Durable mapping layer (pms_external_mappings) with idempotency,
 * deduplication, and conflict resolution state machine.
 */

import crypto from "node:crypto";
import type {
  PmsExternalMapping,
  PmsProviderName,
  SyncConflictType,
  SyncLifecycleState,
} from "@/types/demo-pilot-11";

export class PmsMappingStore {
  private mappings = new Map<string, PmsExternalMapping>();
  private auditLogs: Array<{ timestamp: string; tenantId: string; action: string; metadata: string }> = [];

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

  public upsertMapping(params: {
    tenantId: string;
    provider: PmsProviderName;
    entityType: "contact" | "appointment";
    externalId: string;
    deskcommId: string;
    externalVersion: string;
    lastExternalUpdateAt: string;
    deskcommUpdatedAt?: string;
  }): { mapping: PmsExternalMapping; isDuplicate: boolean; conflictDetected: boolean } {
    const naturalKey = `${params.tenantId}::${params.provider}::${params.entityType}::${params.externalId}`;
    const checksum = PmsMappingStore.generateIdempotencyKey(
      params.tenantId,
      params.provider,
      params.entityType,
      params.externalId,
      params.externalVersion
    );

    const existing = this.mappings.get(naturalKey);
    const now = new Date().toISOString();

    if (existing) {
      // Check idempotency: identical version means idempotent no-op (0 duplicate created)
      if (existing.externalVersion === params.externalVersion && existing.syncStatus === "synced") {
        return { mapping: existing, isDuplicate: true, conflictDetected: false };
      }

      // Check conflict: both Deskcomm and External modified concurrently
      let syncStatus: SyncLifecycleState = "synced";
      let conflictType: SyncConflictType | undefined;

      if (params.deskcommUpdatedAt && params.deskcommUpdatedAt > existing.lastSyncedAt) {
        if (params.lastExternalUpdateAt > existing.lastSyncedAt) {
          syncStatus = "conflict";
          conflictType = "ambiguous";
          this.logAudit(params.tenantId, "conflict_detected", { naturalKey, conflictType });
          const updatedMapping: PmsExternalMapping = {
            ...existing,
            externalVersion: params.externalVersion,
            checksum,
            lastExternalUpdateAt: params.lastExternalUpdateAt,
            lastSyncedAt: now,
            syncStatus,
            conflictType,
          };
          this.mappings.set(naturalKey, updatedMapping);
          return { mapping: updatedMapping, isDuplicate: false, conflictDetected: true };
        }
      }

      const updatedMapping: PmsExternalMapping = {
        ...existing,
        externalVersion: params.externalVersion,
        checksum,
        lastExternalUpdateAt: params.lastExternalUpdateAt,
        lastSyncedAt: now,
        syncStatus: "synced",
        conflictType: undefined,
      };
      this.mappings.set(naturalKey, updatedMapping);
      return { mapping: updatedMapping, isDuplicate: false, conflictDetected: false };
    }

    // New mapping creation
    const newMapping: PmsExternalMapping = {
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

    this.mappings.set(naturalKey, newMapping);
    this.logAudit(params.tenantId, "mapping_created", { naturalKey });
    return { mapping: newMapping, isDuplicate: false, conflictDetected: false };
  }

  public resolveConflict(
    naturalKey: string,
    resolution: "accept_pms" | "accept_deskcomm"
  ): PmsExternalMapping | null {
    const existing = this.mappings.get(naturalKey);
    if (!existing || existing.syncStatus !== "conflict") return null;

    const resolved: PmsExternalMapping = {
      ...existing,
      syncStatus: "synced",
      conflictType: undefined,
      lastSyncedAt: new Date().toISOString(),
    };
    this.mappings.set(naturalKey, resolved);
    this.logAudit(existing.tenantId, "conflict_resolved", { naturalKey, resolution });
    return resolved;
  }

  public getMappingsByTenant(tenantId: string): PmsExternalMapping[] {
    return Array.from(this.mappings.values()).filter((m) => m.tenantId === tenantId);
  }

  public getConflictCount(tenantId?: string): number {
    const list = tenantId ? this.getMappingsByTenant(tenantId) : Array.from(this.mappings.values());
    return list.filter((m) => m.syncStatus === "conflict").length;
  }

  public getAllMappings(): PmsExternalMapping[] {
    return Array.from(this.mappings.values());
  }

  public clear(): void {
    this.mappings.clear();
    this.auditLogs = [];
  }

  private logAudit(tenantId: string, action: string, metadata: Record<string, unknown>): void {
    // Fail-safe: ensure no password/apiKey in metadata
    const sanitized = JSON.stringify(metadata, (key, value) => {
      if (/password|secret|apikey|token/i.test(key)) return "[REDACTED]";
      return value;
    });
    this.auditLogs.push({
      timestamp: new Date().toISOString(),
      tenantId,
      action,
      metadata: sanitized,
    });
  }
}

export const globalPmsMappingStore = new PmsMappingStore();
