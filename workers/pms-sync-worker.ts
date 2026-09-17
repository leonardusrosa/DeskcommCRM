/**
 * Background PMS sync worker.
 * Event payloads contain only opaque connection ids; credentials are loaded server-side.
 */

import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { pmsConnectionRepository } from "@/lib/integrations/pms/connection-repository";
import { pmsSyncEngine } from "@/lib/integrations/pms/sync-engine";

interface PmsSyncEventPayload {
  connectionId: string;
  jobType: "initial_sync" | "incremental_sync" | "reconcile";
  windowDays?: number;
}

export async function processPmsSyncEvent(row: EventRow): Promise<HandlerResult> {
  const payload = row.payload as unknown as PmsSyncEventPayload;

  if (!payload?.connectionId || !payload?.jobType) {
    return {
      consumer_key: "pms-sync-worker.v1",
      status: "error",
      detail: "Malformed event payload: missing required connectionId or jobType",
    };
  }

  try {
    const runtime = await pmsConnectionRepository.getRuntimeConnection(payload.connectionId);
    const { connection, clinicApiKey } = runtime;

    if (row.organization_id && row.organization_id !== connection.tenantId) {
      throw new Error("[PMS Security] Event organization does not match connection organization");
    }
    if (connection.provider !== "newsoft_ds") {
      throw new Error(`[PMS Worker] Unsupported runtime provider: ${connection.provider}`);
    }

    const result = await pmsSyncEngine.executeSyncJob({
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

    await pmsConnectionRepository.recordSyncOutcome(connection.id, {
      success: result.status === "SUCCESS",
      health: pmsSyncEngine.deriveHealth(connection, result),
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
      await pmsConnectionRepository.recordSyncOutcome(payload.connectionId, {
        success: false,
        health: "FAILED",
        errorCode: "PMS_SYNC_FAILED",
      });
    } catch {
      // Preserve original worker failure; repository errors are visible in platform logs.
    }
    return {
      consumer_key: "pms-sync-worker.v1",
      status: "error",
      detail: message,
    };
  }
}
