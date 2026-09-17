/**
 * hooks/usePmsConnection.ts
 *
 * Custom hook managing tenant PMS connection state, testing,
 * background sync triggers, and emergency kill switch toggling.
 */

import { useState, useCallback } from "react";
import type {
  PmsConnection,
  PmsHealthState,
  PmsProviderName,
  PmsSyncResult,
} from "@/lib/integrations/pms";

export interface UsePmsConnectionOptions {
  initialConnection?: PmsConnection;
  onSyncComplete?: (result: PmsSyncResult) => void;
}

export function usePmsConnection(tenantId: string, options?: UsePmsConnectionOptions) {
  const [connection, setConnection] = useState<PmsConnection | null>(
    options?.initialConnection ?? {
      id: `pms-${tenantId}`,
      tenantId,
      provider: "newsoft_ds",
      status: "connected",
      health: "HEALTHY",
      syncEnabled: true,
      appointmentWriteEnabled: false,
      endpointUrl: "https://api.imaginasoft.pt/v24/sync-bridge",
      encryptedSecretRef: `enc-${tenantId}`,
      last4: "8492",
      capabilities: {
        contactsRead: true,
        appointmentsRead: true,
        appointmentsCreate: true,
        appointmentsUpdate: true,
        appointmentsCancel: true,
        realtimeWebhooks: true,
        incrementalSync: true,
      },
      lastSyncAt: "2026-09-17T12:00:00.000Z",
      lastSuccessAt: "2026-09-17T12:00:00.000Z",
      createdAt: "2026-09-17T10:00:00.000Z",
      updatedAt: "2026-09-17T12:00:00.000Z",
    }
  );

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<PmsSyncResult | null>(null);

  const testConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Simulate connection testing to the vendor bridge
      await new Promise((resolve) => setTimeout(resolve, 300));
      setTestResult({ success: true, message: "Ligação ao NewSoft Sync Bridge estabelecida com sucesso." });
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Falha ao testar ligação com o fornecedor PMS.",
      });
    } finally {
      setIsTesting(false);
    }
  }, []);

  const triggerSync = useCallback(
    async (_jobType: "initial_sync" | "incremental_sync" = "incremental_sync") => {
      if (!connection || !connection.syncEnabled) return;
      setIsSyncing(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const result: PmsSyncResult = {
          tenantId,
          provider: connection.provider,
          syncRunId: `sync-${Date.now().toString().slice(-6)}`,
          status: "SUCCESS",
          contactsRead: 85,
          contactsMapped: 85,
          appointmentsRead: 60,
          appointmentsMapped: 60,
          duplicatesDetected: 0,
          conflictsDetected: 0,
          errorsCount: 0,
          durationMs: 380,
          syncedAt: new Date().toISOString(),
        };
        setLastSyncResult(result);
        setConnection((prev) =>
          prev
            ? {
                ...prev,
                health: "HEALTHY",
                lastSyncAt: result.syncedAt,
                lastSuccessAt: result.syncedAt,
              }
            : null
        );
        options?.onSyncComplete?.(result);
      } finally {
        setIsSyncing(false);
      }
    },
    [connection, tenantId, options]
  );

  const toggleSyncEnabled = useCallback(async (enabled: boolean) => {
    setConnection((prev) =>
      prev
        ? {
            ...prev,
            syncEnabled: enabled,
            health: enabled ? "HEALTHY" : ("DISABLED" as PmsHealthState),
            updatedAt: new Date().toISOString(),
          }
        : null
    );
  }, []);

  const changeProvider = useCallback(async (newProvider: PmsProviderName) => {
    setConnection((prev) =>
      prev
        ? {
            ...prev,
            provider: newProvider,
            health: newProvider === "gesden" ? "DEGRADED" : "HEALTHY",
            updatedAt: new Date().toISOString(),
          }
        : null
    );
  }, []);

  return {
    connection,
    isTesting,
    isSyncing,
    testResult,
    lastSyncResult,
    testConnection,
    triggerSync,
    toggleSyncEnabled,
    changeProvider,
  };
}
