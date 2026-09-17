/** Core bounded PMS synchronization engine. */

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultMappingRepository, type PmsMappingStore } from "./mapping";
import { newSoftProductionConnector, type NewSoftConnectorConfig } from "./newsoft-connector";
import {
  defaultPmsEntityProjector,
  PmsProjectionConflictError,
  type PmsEntityProjector,
} from "./entity-projector";
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

function payloadVersion(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export class PmsSyncEngine {
  private auditLogs: PmsAuditEvent[] = [];
  private readonly durableRuntime: boolean;

  constructor(
    private mappingRepo: PmsMappingStore = defaultMappingRepository,
    private connector = newSoftProductionConnector,
    private projector: PmsEntityProjector = defaultPmsEntityProjector,
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
      throw new Error(
        `[PMS Sync Aborted] Provider "${connection.provider}" is disabled by platform kill switch.`,
      );
    }
    if (!connection.syncEnabled) {
      await this.recordAudit(connection.tenantId, connection.provider, "sync_failed", {
        reason: "Sync disabled for tenant connection",
      });
      throw new Error(
        `[PMS Sync Aborted] Synchronization is disabled for tenant "${connection.tenantId}".`,
      );
    }

    await this.recordAudit(
      connection.tenantId,
      connection.provider,
      jobType === "initial_sync" ? "initial_sync_started" : "connection_enabled",
      { syncRunId, jobType },
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
        const externalVersion = payloadVersion(contact);
        const existing = await this.mappingRepo.getByExternalId(
          connection.tenantId,
          connection.provider,
          "contact",
          contact.externalId,
        );

        if (existing?.syncStatus === "disabled") {
          continue;
        }
        if (existing?.syncStatus === "conflict") {
          conflictsDetected++;
          continue;
        }
        if (existing?.syncStatus === "synced" && existing.externalVersion === externalVersion) {
          duplicatesDetected++;
          continue;
        }

        try {
          const projection = await this.projector.projectContact({
            tenantId: connection.tenantId,
            provider: connection.provider,
            contact,
            existingMapping: existing,
          });
          const lastExternalUpdateAt = new Date().toISOString();
          const res = await this.mappingRepo.upsert({
            tenantId: connection.tenantId,
            provider: connection.provider,
            entityType: "contact",
            externalId: contact.externalId,
            deskcommId: projection.deskcommId,
            externalVersion,
            lastExternalUpdateAt,
            deskcommUpdatedAt: projection.deskcommUpdatedAt,
          });

          if (res.isDuplicate) {
            duplicatesDetected++;
          } else if (res.conflictDetected) {
            conflictsDetected++;
            await this.recordAudit(connection.tenantId, connection.provider, "conflict_detected", {
              externalId: contact.externalId,
              entityType: "contact",
              reason: projection.applied ? "concurrent_change" : "deskcomm_changed",
            });
          } else {
            contactsMapped++;
          }
        } catch (error: unknown) {
          if (!(error instanceof PmsProjectionConflictError)) throw error;
          conflictsDetected++;
          errorsCount++;
          await this.recordAudit(connection.tenantId, connection.provider, "conflict_detected", {
            externalId: contact.externalId,
            entityType: "contact",
            reason: error.message,
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
        const patientMapping = appointment.patientExternalId
          ? await this.mappingRepo.getByExternalId(
              connection.tenantId,
              connection.provider,
              "contact",
              appointment.patientExternalId,
            )
          : null;

        // LGPD/anonymization tombstone: never recreate appointment mirrors for
        // a PMS patient whose Deskcomm contact mapping was deliberately disabled.
        if (patientMapping?.syncStatus === "disabled") {
          continue;
        }

        // The mirror version includes the resolved Deskcomm contact identity.
        // This makes a mirror imported before its patient was mapped get updated
        // later with contact_id, even when the PMS appointment payload is unchanged.
        const externalVersion = payloadVersion({
          appointment,
          contactDeskcommId: patientMapping?.deskcommId ?? null,
        });
        const existing = await this.mappingRepo.getByExternalId(
          connection.tenantId,
          connection.provider,
          "appointment",
          appointment.externalId,
        );

        if (existing?.syncStatus === "disabled") {
          continue;
        }
        if (existing?.syncStatus === "conflict") {
          conflictsDetected++;
          continue;
        }
        if (existing?.syncStatus === "synced" && existing.externalVersion === externalVersion) {
          duplicatesDetected++;
          continue;
        }

        try {
          const projection = await this.projector.projectAppointment({
            tenantId: connection.tenantId,
            provider: connection.provider,
            appointment,
            contactDeskcommId: patientMapping?.deskcommId,
            externalVersion,
            existingMapping: existing,
          });
          const res = await this.mappingRepo.upsert({
            tenantId: connection.tenantId,
            provider: connection.provider,
            entityType: "appointment",
            externalId: appointment.externalId,
            deskcommId: projection.deskcommId,
            externalVersion,
            lastExternalUpdateAt: new Date().toISOString(),
          });

          if (res.isDuplicate) {
            duplicatesDetected++;
          } else if (res.conflictDetected) {
            conflictsDetected++;
            await this.recordAudit(connection.tenantId, connection.provider, "conflict_detected", {
              externalId: appointment.externalId,
              entityType: "appointment",
            });
          } else {
            appointmentsMapped++;
          }
        } catch (error: unknown) {
          if (!(error instanceof PmsProjectionConflictError)) throw error;
          conflictsDetected++;
          errorsCount++;
          await this.recordAudit(connection.tenantId, connection.provider, "conflict_detected", {
            externalId: appointment.externalId,
            entityType: "appointment",
            reason: error.message,
          });
        }
      }

      await this.recordAudit(connection.tenantId, connection.provider, "initial_sync_completed", {
        syncRunId,
        contactsMapped,
        appointmentsMapped,
        conflictsDetected,
        errorsCount,
      });

      return {
        tenantId: connection.tenantId,
        provider: connection.provider,
        syncRunId,
        status: errorsCount > 0 || conflictsDetected > 0 ? "PARTIAL" : "SUCCESS",
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
    if (
      lastResult.status === "PARTIAL" ||
      lastResult.conflictsDetected > 0 ||
      lastResult.errorsCount > 0
    ) {
      return "DEGRADED";
    }
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
    metadata?: Record<string, unknown>,
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
