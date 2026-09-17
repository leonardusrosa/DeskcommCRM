/**
 * components/admin/pms/PmsConnectionPanel.tsx
 *
 * Minimal administrative interface for managing PMS connections.
 * Pure UI presentation component: state and actions delegated to usePmsConnection.
 * Hidden completely when PMS_NEWSOFT_ENABLED is not active.
 */

"use client";

import React from "react";
import { usePmsConnection } from "@/hooks/usePmsConnection";

export interface PmsConnectionPanelProps {
  tenantId: string;
}

export function PmsConnectionPanel({ tenantId }: PmsConnectionPanelProps) {
  const {
    connection,
    isPmsEnabled,
    isTesting,
    isSyncing,
    testResult,
    lastSyncResult,
    testConnection,
    triggerSync,
    toggleSync,
  } = usePmsConnection(tenantId);

  // Requirement: When disabled, PMS settings panel is hidden
  if (!isPmsEnabled) {
    return null;
  }

  if (!connection) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-900">Integração PMS Dentário</h3>
        <p className="mt-1 text-sm text-neutral-500">Nenhum fornecedor PMS configurado para esta organização.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-neutral-900">NewSoft DS (Imaginasoft)</h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                connection.health === "HEALTHY"
                  ? "bg-green-100 text-green-800"
                  : connection.health === "DEGRADED"
                  ? "bg-yellow-100 text-yellow-800"
                  : connection.health === "DISABLED"
                  ? "bg-neutral-100 text-neutral-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {connection.health}
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              Coexistência Administrativa
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Sincronização bidirecional de contactos e consultas. Registos clínicos e faturação permanecem no NewSoft.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={connection.syncEnabled}
              onChange={(e) => toggleSync(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
            />
            Sincronização Ativa
          </label>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border border-neutral-100 bg-neutral-50 p-3">
          <div className="text-xs text-neutral-500">Endpoint Relay</div>
          <div className="mt-1 font-mono text-sm font-medium text-neutral-800 truncate" title={connection.endpointUrl}>
            {connection.endpointUrl}
          </div>
        </div>

        <div className="rounded border border-neutral-100 bg-neutral-50 p-3">
          <div className="text-xs text-neutral-500">Chave de API da Clínica</div>
          <div className="mt-1 font-mono text-sm font-medium text-neutral-800">
            ••••••••••••{connection.last4}
          </div>
        </div>

        <div className="rounded border border-neutral-100 bg-neutral-50 p-3">
          <div className="text-xs text-neutral-500">Escrita de Consultas</div>
          <div className="mt-1 text-sm font-medium text-neutral-600">
            {connection.appointmentWriteEnabled ? "Ativada" : "Desativada (Apenas Leitura)"}
          </div>
        </div>
      </div>

      {testResult && (
        <div
          className={`mt-4 rounded p-3 text-sm ${
            testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {testResult.message}
        </div>
      )}

      {lastSyncResult && (
        <div className="mt-4 rounded bg-neutral-50 p-3 text-xs text-neutral-600 flex gap-4">
          <span>Contactos mapeados: <strong>{lastSyncResult.contactsMapped}</strong></span>
          <span>Consultas mapeadas: <strong>{lastSyncResult.appointmentsMapped}</strong></span>
          <span>Duplicados: <strong>{lastSyncResult.duplicatesDetected}</strong></span>
          <span>Duração: <strong>{lastSyncResult.durationMs}ms</strong></span>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={testConnection}
          disabled={isTesting}
          className="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          {isTesting ? "A testar ligação..." : "Testar Ligação"}
        </button>

        <button
          type="button"
          onClick={() => triggerSync("incremental_sync")}
          disabled={isSyncing || !connection.syncEnabled}
          className="rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isSyncing ? "A sincronizar..." : "Sincronizar Agora"}
        </button>
      </div>
    </div>
  );
}
