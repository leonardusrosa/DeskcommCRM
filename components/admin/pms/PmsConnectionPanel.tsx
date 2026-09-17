"use client";

/**
 * components/admin/pms/PmsConnectionPanel.tsx
 *
 * Minimal administrative UI panel for PMS connection management.
 * Handles layout and rendering of provider status, health badges,
 * test connection trigger, and emergency kill switch.
 */

import React from "react";
import { usePmsConnection } from "@/hooks/usePmsConnection";
import type { PmsHealthState, PmsProviderName } from "@/lib/integrations/pms";

interface PmsConnectionPanelProps {
  tenantId: string;
}

const HEALTH_BADGES: Record<PmsHealthState, { label: string; className: string }> = {
  HEALTHY: { label: "Saudável", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  DEGRADED: { label: "Degradado", className: "bg-amber-100 text-amber-800 border-amber-300" },
  FAILED: { label: "Falha", className: "bg-rose-100 text-rose-800 border-rose-300" },
  DISABLED: { label: "Desativado", className: "bg-slate-100 text-slate-800 border-slate-300" },
};

export const PmsConnectionPanel: React.FC<PmsConnectionPanelProps> = ({ tenantId }) => {
  const {
    connection,
    isTesting,
    isSyncing,
    testResult,
    lastSyncResult,
    testConnection,
    triggerSync,
    toggleSyncEnabled,
    changeProvider,
  } = usePmsConnection(tenantId);

  if (!connection) {
    return (
      <div className="p-6 bg-white rounded-lg border border-slate-200">
        <p className="text-slate-500">Nenhuma ligação PMS configurada para esta clínica.</p>
      </div>
    );
  }

  const healthBadge = HEALTH_BADGES[connection.health];

  return (
    <div className="space-y-6">
      {/* Header & Status Card */}
      <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Interoperabilidade PMS Dental</h2>
            <p className="text-sm text-slate-500">
              Coexistência administrativa com o software clínico da receção
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${healthBadge.className}`}
            >
              {healthBadge.label}
            </span>
            <button
              type="button"
              onClick={() => toggleSyncEnabled(!connection.syncEnabled)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                connection.syncEnabled
                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              {connection.syncEnabled ? "Parar Sincronização (Kill Switch)" : "Ativar Sincronização"}
            </button>
          </div>
        </div>

        {/* Configuration Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <label htmlFor="pms-provider-select" className="block text-xs font-medium text-slate-500 mb-1">
              Fornecedor Ativo
            </label>
            <select
              id="pms-provider-select"
              value={connection.provider}
              onChange={(e) => changeProvider(e.target.value as PmsProviderName)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="newsoft_ds">NewSoft DS (Imaginasoft — Homologado)</option>
              <option value="gesden">Gesden G5 (Infomed / Henry Schein — Provisório)</option>
              <option value="infomed_dentool">Infomed Dentool (Legado)</option>
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1">Ponto de Ligação (Endpoint)</span>
            <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono text-xs truncate">
              {connection.endpointUrl}
            </p>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1">Chave de API da Clínica</span>
            <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono text-xs">
              ••••••••••••••••••••{connection.last4}
            </p>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1">Última Sincronização</span>
            <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs">
              {connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString("pt-PT") : "Nunca"}
            </p>
          </div>
        </div>

        {/* Actions & Feedback */}
        <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={isTesting}
            onClick={testConnection}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {isTesting ? "A testar..." : "Testar Ligação"}
          </button>
          <button
            type="button"
            disabled={isSyncing || !connection.syncEnabled}
            onClick={() => triggerSync("incremental_sync")}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSyncing ? "A sincronizar..." : "Sincronizar Agora"}
          </button>

          {testResult && (
            <span
              className={`text-xs font-medium ${
                testResult.success ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {testResult.message}
            </span>
          )}
        </div>

        {/* Last Sync Stats */}
        {lastSyncResult && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex gap-4">
            <span>Contactos: <strong>{lastSyncResult.contactsMapped}</strong></span>
            <span>Marcações: <strong>{lastSyncResult.appointmentsMapped}</strong></span>
            <span>Conflitos: <strong>{lastSyncResult.conflictsDetected}</strong></span>
            <span>Duração: <strong>{lastSyncResult.durationMs}ms</strong></span>
          </div>
        )}
      </div>

      {/* Non-Clinical Safety Guarantee Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
        <strong>Salvaguarda de Privacidade & Não-Intrusão Clínica:</strong> O Deskcomm opera
        estritamente na camada de agendamento administrativo e contactos de receção. Fichas clínicas,
        odontogramas, diagnósticos, radiografias e faturação permanecem sob guarda exclusiva do seu
        software PMS titular.
      </div>
    </div>
  );
};
