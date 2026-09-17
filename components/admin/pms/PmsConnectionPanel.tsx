"use client";

import React, { useState } from "react";
import { usePmsConnection } from "@/hooks/usePmsConnection";
import type { PmsHealthState } from "@/lib/integrations/pms/types";

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
    isLoading,
    isTesting,
    isSyncing,
    isSaving,
    testResult,
    lastSyncResult,
    configureConnection,
    testConnection,
    triggerSync,
    toggleSyncEnabled,
  } = usePmsConnection(tenantId);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [clinicApiKey, setClinicApiKey] = useState("");

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
        A carregar ligação PMS...
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ligar NewSoft DS</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure o endpoint HTTPS do bridge autorizado e a chave da clínica. A chave é cifrada no servidor e nunca retorna ao navegador.
          </p>
        </div>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await configureConnection(endpointUrl, clinicApiKey);
            if (saved) setClinicApiKey("");
          }}
        >
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs font-medium text-slate-500">Endpoint HTTPS</span>
            <input
              required
              type="url"
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
              placeholder="https://bridge.clinica.example/api/v1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs font-medium text-slate-500">Chave API da clínica</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={clinicApiKey}
              onChange={(event) => setClinicApiKey(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? "A guardar..." : "Guardar ligação"}
            </button>
          </div>
        </form>
        {testResult && (
          <p className={`text-xs font-medium ${testResult.success ? "text-emerald-700" : "text-rose-700"}`}>
            {testResult.message}
          </p>
        )}
        <SafetyNotice />
      </div>
    );
  }

  const healthBadge = HEALTH_BADGES[connection.health];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Interoperabilidade PMS Dental</h2>
            <p className="text-sm text-slate-500">Coexistência administrativa com o software clínico da receção</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${healthBadge.className}`}>
              {healthBadge.label}
            </span>
            <button
              type="button"
              onClick={() => toggleSyncEnabled(!connection.syncEnabled)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                connection.syncEnabled
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {connection.syncEnabled ? "Parar Sincronização" : "Ativar Sincronização"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <Detail label="Fornecedor" value="NewSoft DS (Imaginasoft — runtime habilitado)" />
          <Detail label="Endpoint" value={connection.endpointUrl} mono />
          <Detail label="Chave API da Clínica" value={`••••••••••••••••••••${connection.last4}`} mono />
          <Detail
            label="Última Sincronização"
            value={connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString("pt-PT") : "Nunca"}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={isTesting}
            onClick={testConnection}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {isTesting ? "A testar..." : "Testar Ligação"}
          </button>
          <button
            type="button"
            disabled={isSyncing || !connection.syncEnabled}
            onClick={() => triggerSync("incremental_sync")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSyncing ? "A enfileirar..." : "Sincronizar Agora"}
          </button>
          {testResult && (
            <span className={`text-xs font-medium ${testResult.success ? "text-emerald-700" : "text-rose-700"}`}>
              {testResult.message}
            </span>
          )}
        </div>

        {lastSyncResult && (
          <div className="mt-4 flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <span>Contactos: <strong>{lastSyncResult.contactsMapped}</strong></span>
            <span>Marcações: <strong>{lastSyncResult.appointmentsMapped}</strong></span>
            <span>Conflitos: <strong>{lastSyncResult.conflictsDetected}</strong></span>
          </div>
        )}
      </div>
      <SafetyNotice />
    </div>
  );
};

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <p className={`truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SafetyNotice() {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
      <strong>Salvaguarda de Privacidade & Não-Intrusão Clínica:</strong> o Deskcomm limita esta integração a contactos de receção e agendamento administrativo. Fichas clínicas, odontogramas, diagnósticos, radiografias, prescrições e faturação ficam fora do contrato de sincronização.
    </div>
  );
}
