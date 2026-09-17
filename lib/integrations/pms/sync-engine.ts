/**
 * lib/integrations/pms/sync-engine.ts
 *
 * Core synchronization engine for PMS background sync jobs.
 * Orchestrates bounded, idempotent sync runs, health checks, conflict handling,
 * and security audit logging.
 */

import crypto from "node:crypto";
import { defaultMappingRepository, type PmsMappingRepository } from "./mapping";
import { newSoftProductionConnector, type NewSoftConnectorConfig } from "./newsoft-connector";
import type {
  PmsAuditEvent,
  PmsConnection,
  PmsHealthState,
  PmsProviderName,
  PmsSyncResult,
} from "./types";

// Platform-level kill switch store
const disabledProviders = new Set<PmsProviderName>();

export function isPlatformProviderEnabled(provider: PmsProviderName): boolean {
  return !disabledProviders.has(provider);
}

export function setPlatformProviderEnabled(provider: PmsProviderName, enabled: boolean): void {
  if (enabled) {
    disabledProviders.delete(provider);
  } else {
    disabledProviders.add(provider);
  }
}

export class PmsSyncEngine {
  private auditLogs: PmsAuditEvent[] = [];

  constructor(
    private mappingRepo: PmsMappingRepository = defaultMappingRepository,
    private connector = newSoftProductionConnector
  ) {}

  public async executeSyncJob(params: {
    connection: PmsConnection;
    config: NewSoftConnectorConfig;
    jobType: "initial_sync" | "incremental_sync" | "reconcile";
    windowDays?: number;
  }): Promise<PmsSyncResult> {
    const { connection, config, jobType } = params;
    const startTime = Date.now();
    const syncRunId = `sync-${crypto.randomUUID().slice(0, 8)}`;

    // 1. Check Platform & Connection Kill Switches
    if (!isPlatformProviderEnabled(connection.provider)) {
      this.recordAudit(connection.tenantId, connection.provider, "sync_failed", {
        reason: "Provider disabled at platform level",
      });
      throw new Error(`[PMS Sync Aborted] Provider "${connection.provider}" is disabled by platform kill switch.`);
    }

    if (!connection.syncEnabled) {
      this.recordAudit(connection.tenantId, connection.provider, "sync_failed", {
        reason: "Sync disabled for tenant connection",
      });
      throw new Error(`[PMS Sync Aborted] Synchronization is disabled for tenant "${connection.tenantId}".`);
    }

    // 2. Audit start
    this.recordAudit(
      connection.tenantId,
      connection.provider,
      jobType === "initial_sync" ? "initial_sync_started" : "connection_enabled",
      { syncRunId, jobType }
    );

    let contactsRead = 0;
    let contactsMapped = 0;
    let appointmentsRead = 0;
    let appointmentsMapped = 0;
    let duplicatesDetected = 0;
    let conflictsDetected = 0;
    let errorsCount = 0;

    try {
      // 3. Fetch and map administrative contacts
      const contacts = await this.connector.fetchContacts(config, {
        limit: jobType === "initial_sync" ? 100 : 25,
      });
      contactsRead = contacts.length;

      for (const contact of contacts) {
        const res = this.mappingRepo.upsert({
          tenantId: connection.tenantId,
          provider: connection.provider,
          entityType: "contact",
          externalId: contact.externalId,
          deskcommId: `dk-c-${contact.externalId}`,
          externalVersion: "v1.0",
          lastExternalUpdateAt: new Date().toISOString(),
        });

        if (res.isDuplicate) {
          duplicatesDetected++;
        } else {
          contactsMapped++;
        }
        if (res.conflictDetected) {
          conflictsDetected++;
          this.recordAudit(connection.tenantId, connection.provider, "conflict_detected", {
            externalId: contact.externalId,
          });
        }
      }

      // 4. Fetch and map appointments window
      const windowDays = params.windowDays ?? 14;
      const appointments = await this.connector.fetchAppointments(config, {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + windowDays * 86400000).toISOString(),
      });
      appointmentsRead = appointments.length;

      for (const apt of appointments) {
        const res = this.mappingRepo.upsert({
          tenantId: connection.tenantId,
          provider: connection.provider,
          entityType: "appointment",
          externalId: apt.externalId,
          deskcommId: `dk-a-${apt.externalId}`,
          externalVersion: "v1.0",
          lastExternalUpdateAt: new Date().toISOString(),
        });

        if (res.isDuplicate) {
          duplicatesDetected++;
        } else {
          appointmentsMapped++;
        }
        if (res.conflictDetected) {
          conflictsDetected++;
          this.recordAudit(connection.tenantId, connection.provider, "conflict_detected", {
            externalId: apt.externalId,
          });
        }
      }

      // 5. Audit completion
      this.recordAudit(connection.tenantId, connection.provider, "initial_sync_completed", {
        syncRunId,
        contactsMapped,
        appointmentsMapped,
      });

      const durationMs = Date.now() - startTime;
      return {
        tenantId: connection.tenantId,
        provider: connection.provider,
        syncRunId,
        status: errorsCount > 0 ? "PARTIAL" : "SUCCESS",
        contactsRead,
        contactsMapped,
        appointmentsRead,
        appointmentsMapped,
        duplicatesDetected,
        conflictsDetected,
        errorsCount,
        durationMs,
        syncedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      errorsCount++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.recordAudit(connection.tenantId, connection.provider, "sync_failed", {
        syncRunId,
        error: errorMessage,
      });
      throw err;
    }
  }

  public deriveHealth(connection: PmsConnection, lastResult?: PmsSyncResult): PmsHealthState {
    if (!connection.syncEnabled) return "DISABLED";
    if (!lastResult) return "HEALTHY";
    if (lastResult.status === "FAILED" || lastResult.errorsCount > 5) return "FAILED";
    if (lastResult.conflictsDetected > 0 || lastResult.errorsCount > 0) return "DEGRADED";
    return "HEALTHY";
  }

  public getAuditLogs(tenantId?: string): PmsAuditEvent[] {
    return tenantId ? this.auditLogs.filter((a) => a.tenantId === tenantId) : this.auditLogs;
  }

  public clearAudit(): void {
    this.auditLogs = [];
  }

  private recordAudit(
    tenantId: string,
    provider: PmsProviderName,
    action: PmsAuditEvent["action"],
    metadata?: Record<string, unknown>
  ): void {
    this.auditLogs.push({
      id: `audit-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      provider,
      action,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }
}

export const pmsSyncEngine = new PmsSyncEngine();
