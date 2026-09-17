/** Core bounded PMS synchronization engine. */

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultMappingRepository, type PmsMappingStore } from "./mapping";
import { newSoftProductionConnector, type NewSoftConnectorConfig } from "./newsoft-connector";
import { sanitizeCredentialsForAudit } from "./credentials";
import type {
  PmsAuditEvent,
  PmsConnection,
  PmsHealthState,
  PmsProviderName,
  PmsSyncResult,
} from "./types";

const disabledProviders = new Set<PmsProviderName>();

export function isPlatformProviderEnabled(provider: PmsProviderName): boolean {
  return !disabledProviders.has(provider);
}

export function setPlatformProviderEnabled(provider: PmsProviderName, enabled: boolean): void {
  if (enabled) disabledProviders.delete(provider);
  else disabledProviders.add(provider);
}

export class PmsSyncEngine {
  private auditLogs: PmsAuditEvent[] = [];
  private readonly durableRuntime: boolean;

  constructor(
    private mappingRepo: PmsMappingStore = defaultMappingRepository,
    private connector = newSoftProductionConnector
  ) {
    this.durableRuntime = mappingRepo === defaultMappingRepository;
  }

  public async executeSyncJob(params: {
    connection: PmsConnection;
    config: NewSoftConnectorConfig;
    jobType: "initial_sync" | "incremental_sync" | "reconcile";
    windowDays?: number;
  }): Promise<PmsSyncResult> {
    const { connection, config, jobType } = params;
    const startTime = Date.now();
    const syncRunId = `sync-${crypto.randomUUID().slice(0, 8)}`;

    if (!isPlatformProviderEnabled(connection.provider)) {
      await this.recordAudit(connection.tenantId, connection.provider, "sync_failed", {
        reason: "Provider disabled at platform level",
      });
      throw new Error(`[PMS Sync Aborted] Provider "${connection.provider}" is disabled by platform kill switch.`);
    }
    if (!connection.syncEnabled) {
      await this.recordAudit(connection.tenantId, connection.provider, "sync_failed", {
        reason: "Sync disabled for tenant connection",
      });
      throw new Error(`[PMS Sync Aborted] Synchronization is disabled for tenant "${connection.tenantId}".`);
    }

    await this.recordAudit(
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
      const contacts = await this.connector.fetchContacts(config, {
        limit: jobType === "initial_sync" ? 100 : 25,
      });
      contactsRead = contacts.length;

      for (const contact of contacts) {
        const res = await this.mappingRepo.upsert({
          tenantId: connection.tenantId,
          provider: connection.provider,
          entityType: "contact",
          externalId: contact.externalId,
          deskcommId: `dk-c-${contact.externalId}`,
          externalVersion: "v1.0",
          lastExternalUpdateAt: new Date().toISOString(),
        });
        if (res.isDuplicate) duplicatesDetected++;
        else contactsMapped++;
        if (res.conflictDetected) {
          conflictsDetected++;
          await this.recordAudit(connection.tenantId, connection.provider, "conflict_detected", {
            externalId: contact.externalId,
          });
        }
      }

      const windowDays = params.windowDays ?? 14;
      const appointments = await this.connector.fetchAppointments(config, {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + windowDays * 86400000).toISOString(),
      });
      appointmentsRead = appointments.length;

      for (const appointment of appointments) {
        const res = await this.mappingRepo.upsert({
          tenantId: connection.tenantId,
          provider: connection.provider,
          entityType: "appointment",
          externalId: appointment.externalId,
          deskcommId: `dk-a-${appointment.externalId}`,
          externalVersion: "v1.0",
          lastExternalUpdateAt: new Date().toISOString(),
        });
        if (res.isDuplicate) duplicatesDetected++;
        else appointmentsMapped++;
        if (res.conflictDetected) {
          conflictsDetected++;
          await this.recordAudit(connection.tenantId, connection.provider, "conflict_detected", {
            externalId: appointment.externalId,
          });
        }
      }

      await this.recordAudit(connection.tenantId, connection.provider, "initial_sync_completed", {
        syncRunId,
        contactsMapped,
        appointmentsMapped,
      });

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
        durationMs: Date.now() - startTime,
        syncedAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      errorsCount++;
      const message = error instanceof Error ? error.message : String(error);
      await this.recordAudit(connection.tenantId, connection.provider, "sync_failed", {
        syncRunId,
        error: message,
      });
      throw error;
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
    return tenantId ? this.auditLogs.filter((event) => event.tenantId === tenantId) : this.auditLogs;
  }

  public clearAudit(): void {
    this.auditLogs = [];
  }

  private async recordAudit(
    tenantId: string,
    provider: PmsProviderName,
    action: PmsAuditEvent["action"],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const safeMetadata = metadata ? sanitizeCredentialsForAudit(metadata) : undefined;
    const event: PmsAuditEvent = {
      id: `audit-${crypto.randomUUID().slice(0, 8)}`,
      tenantId,
      provider,
      action,
      metadata: safeMetadata,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.push(event);

    if (!this.durableRuntime) return;
    const { error } = await createAdminClient().from("pms_audit_events").insert({
      organization_id: tenantId,
      provider,
      action,
      metadata: safeMetadata || {},
    });
    if (error) throw new Error(`[PMS Audit] Persist failed: ${error.message}`);
  }
}

export const pmsSyncEngine = new PmsSyncEngine();
