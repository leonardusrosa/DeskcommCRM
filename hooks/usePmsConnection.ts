"use client";

import { useCallback, useEffect, useState } from "react";
import type { PmsConnection, PmsSyncResult } from "@/lib/integrations/pms/types";

export interface UsePmsConnectionOptions {
  initialConnection?: PmsConnection;
  onSyncComplete?: (result: PmsSyncResult) => void;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(body.error?.message || `PMS request failed (${response.status})`);
  }
  return body.data as T;
}

export function usePmsConnection(options?: UsePmsConnectionOptions) {
  const [connection, setConnection] = useState<PmsConnection | null>(options?.initialConnection ?? null);
  const [isLoading, setIsLoading] = useState(!options?.initialConnection);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [lastSyncResult] = useState<PmsSyncResult | null>(null);

  const refreshConnection = useCallback(async () => {
    const response = await fetch("/api/v1/pms", { cache: "no-store" });
    const data = await readEnvelope<PmsConnection | null>(response);
    setConnection(data);
    return data;
  }, []);

  useEffect(() => {
    if (options?.initialConnection) return;
    let active = true;
    setIsLoading(true);
    refreshConnection()
      .catch((error: unknown) => {
        if (active) {
          setTestResult({
            success: false,
            message: error instanceof Error ? error.message : "Falha ao carregar ligação PMS.",
          });
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [options?.initialConnection, refreshConnection]);

  const configureConnection = useCallback(async (endpointUrl: string, clinicApiKey: string) => {
    setIsSaving(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/v1/pms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointUrl, clinicApiKey }),
      });
      const saved = await readEnvelope<PmsConnection>(response);
      setConnection(saved);
      setTestResult({ success: true, message: "Ligação PMS guardada com credencial cifrada." });
      return saved;
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Falha ao guardar ligação PMS.",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const testConnection = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/v1/pms/test", { method: "POST" });
      await readEnvelope<{ success: boolean }>(response);
      setTestResult({ success: true, message: "Ligação ao bridge PMS confirmada pelo servidor." });
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Falha ao testar ligação PMS.",
      });
    } finally {
      setIsTesting(false);
    }
  }, []);

  const triggerSync = useCallback(
    async (jobType: "initial_sync" | "incremental_sync" = "incremental_sync") => {
      if (!connection?.syncEnabled) return;
      setIsSyncing(true);
      setTestResult(null);
      try {
        const response = await fetch("/api/v1/pms/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobType }),
        });
        await readEnvelope<{ queued: boolean; eventId: string; jobType: string }>(response);
        setTestResult({
          success: true,
          message: "Sincronização enfileirada. O worker processará a ligação sem expor credenciais.",
        });
        await refreshConnection();
      } catch (error: unknown) {
        setTestResult({
          success: false,
          message: error instanceof Error ? error.message : "Falha ao enfileirar sincronização PMS.",
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [connection?.syncEnabled, refreshConnection]
  );

  const toggleSyncEnabled = useCallback(async (enabled: boolean) => {
    setTestResult(null);
    try {
      const response = await fetch("/api/v1/pms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncEnabled: enabled }),
      });
      setConnection(await readEnvelope<PmsConnection>(response));
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Falha ao alterar kill switch PMS.",
      });
    }
  }, []);

  return {
    connection,
    isLoading,
    isTesting,
    isSyncing,
    isSaving,
    testResult,
    lastSyncResult,
    refreshConnection,
    configureConnection,
    testConnection,
    triggerSync,
    toggleSyncEnabled,
  };
}
