/**
 * Background PMS sync worker.
 * Event payloads contain only opaque connection ids; credentials are loaded server-side.
 */

import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { pmsConnectionRepository } from "@/lib/integrations/pms/connection-repository";
import { pmsSyncEngine } from "@/lib/integrations/pms/sync-engine";
import type { PmsConnection, PmsSyncResult } from "@/lib/integrations/pms/types";

interface PmsSyncEventPayload {
  connectionId: string;
  jobType: "initial_sync" | "incremental_sync" | "reconcile";
  windowDays?: number;
}

interface RuntimeConnection {
  connection: PmsConnection;
  clinicApiKey: string;
}

export interface PmsSyncWorkerDependencies {
  connectionRepository: {
    getRuntimeConnection(connectionId: string): Promise<RuntimeConnection>;
    recordSyncOutcome(
      connectionId: string,
      outcome: { success: boolean; health: PmsConnection["health"]; errorCode?: string }
    ): Promise<void>;
  };
  syncEngine: {
    executeSyncJob(params: {
      connection: PmsConnection;
      config: {
        tenantId: string;
        endpointUrl: string;
        clinicApiKey: string;
        appointmentWriteEnabled?: boolean;
      };
      jobType: PmsSyncEventPayload["jobType"];
      windowDays?: number;
    }): Promise<PmsSyncResult>;
    deriveHealth(connection: PmsConnection, result?: PmsSyncResult): PmsConnection["health"];
  };
}

export function createPmsSyncEventProcessor(deps: PmsSyncWorkerDependencies) {
  return async function process(row: EventRow): Promise<HandlerResult> {
    const payload = row.payload as unknown as PmsSyncEventPayload;
    if (!payload?.connectionId || !payload?.jobType) {
      return {
        consumer_key: "pms-sync-worker.v1",
        status: "error",
        detail: "Malformed event payload: missing required connectionId or jobType",
      };
    }

    try {
      const runtime = await deps.connectionRepository.getRuntimeConnection(payload.connectionId);
      const { connection, clinicApiKey } = runtime;
      if (row.organization_id && row.organization_id !== connection.tenantId) {
        throw new Error("[PMS Security] Event organization does not match connection organization");
      }
      if (connection.provider !== "newsoft_ds") {
        throw new Error(`[PMS Worker] Unsupported runtime provider: ${connection.provider}`);
      }

      const result = await deps.syncEngine.executeSyncJob({
        connection,
        config: {
          tenantId: connection.tenantId,
          endpointUrl: connection.endpointUrl,
          clinicApiKey,
          appointmentWriteEnabled: connection.appointmentWriteEnabled,
        },
        jobType: payload.jobType,
        windowDays: payload.windowDays,
      });
      await deps.connectionRepository.recordSyncOutcome(connection.id, {
        success: result.status === "SUCCESS",
        health: deps.syncEngine.deriveHealth(connection, result),
      });

      return {
        consumer_key: "pms-sync-worker.v1",
        status: "ok",
        detail: JSON.stringify({
          syncRunId: result.syncRunId,
          contactsMapped: result.contactsMapped,
          appointmentsMapped: result.appointmentsMapped,
          duplicatesDetected: result.duplicatesDetected,
          conflictsDetected: result.conflictsDetected,
          durationMs: result.durationMs,
        }),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await deps.connectionRepository.recordSyncOutcome(payload.connectionId, {
          success: false,
          health: "FAILED",
          errorCode: "PMS_SYNC_FAILED",
        });
      } catch {
        // Preserve original worker failure.
      }
      return { consumer_key: "pms-sync-worker.v1", status: "error", detail: message };
    }
  };
}

export const processPmsSyncEvent = createPmsSyncEventProcessor({
  connectionRepository: pmsConnectionRepository,
  syncEngine: pmsSyncEngine,
});
