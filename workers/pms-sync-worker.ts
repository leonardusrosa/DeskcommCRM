/**
 * workers/pms-sync-worker.ts
 *
 * Background worker processing bounded PMS synchronization events:
 * initial_sync, incremental_sync, reconcile.
 * Guarantees idempotency, tenant scoping, and kill-switch safety.
 */

import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { pmsSyncEngine } from "@/lib/integrations/pms/sync-engine";
import {
  NEWSOFT_CAPABILITIES,
  type PmsConnection,
  type PmsProviderName,
} from "@/lib/integrations/pms";

interface PmsSyncEventPayload {
  tenantId: string;
  provider: PmsProviderName;
  jobType: "initial_sync" | "incremental_sync" | "reconcile";
  endpointUrl: string;
  clinicApiKey: string;
  syncEnabled?: boolean;
  appointmentWriteEnabled?: boolean;
  windowDays?: number;
}

export async function processPmsSyncEvent(row: EventRow): Promise<HandlerResult> {
  const payload = row.payload as unknown as PmsSyncEventPayload;

  if (!payload || !payload.tenantId || !payload.provider) {
    return {
      consumer_key: "pms-sync-worker.v1",
      status: "error",
      detail: "Malformed event payload: missing required tenantId or provider",
    };
  }

  const connection: PmsConnection = {
    id: `conn-${payload.tenantId}-${payload.provider}`,
    tenantId: payload.tenantId,
    provider: payload.provider,
    status: "connected",
    health: "HEALTHY",
    syncEnabled: payload.syncEnabled ?? true,
    appointmentWriteEnabled: payload.appointmentWriteEnabled ?? false,
    endpointUrl: payload.endpointUrl,
    encryptedSecretRef: `enc-${payload.tenantId}`,
    last4: payload.clinicApiKey ? payload.clinicApiKey.slice(-4) : "0000",
    capabilities: { ...NEWSOFT_CAPABILITIES },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const result = await pmsSyncEngine.executeSyncJob({
      connection,
      config: {
        tenantId: payload.tenantId,
        endpointUrl: payload.endpointUrl,
        clinicApiKey: payload.clinicApiKey,
        appointmentWriteEnabled: connection.appointmentWriteEnabled,
      },
      jobType: payload.jobType,
      windowDays: payload.windowDays,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      consumer_key: "pms-sync-worker.v1",
      status: "error",
      detail: message,
    };
  }
}
