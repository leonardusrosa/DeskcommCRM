"use client";

import { useLiveDemoCenter } from "@/hooks/useLiveDemoCenter";

export function LiveDemoCenterDashboard() {
  const { data, loading, error, isLivePolling, togglePolling, refetch } = useLiveDemoCenter();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Conectando al Centro de Mando en Vivo…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error ?? "Sin telemetría en vivo."}</p>
        <button
          onClick={() => void refetch()}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { recentEvents, queueStats, workerState, activeDemosCount, activeAlerts, recentActivities } = data;

  return (
    <div className="space-y-6">
      {/* Top Bar with Live Indicator & Controls */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {isLivePolling && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isLivePolling ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <span className="text-sm font-semibold">
            {isLivePolling ? "Telemetría en Vivo Conectada" : "Sondeo en Pausa"}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            Última actualización: {new Date(data.polledAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePolling}
            className="text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent font-medium transition-colors"
          >
            {isLivePolling ? "Pausar" : "Reanudar"}
          </button>
          <button
            onClick={() => void refetch()}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Refrescar
          </button>
        </div>
      </div>

      {/* Top Telemetry KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Demos Activas</span>
          <p className="text-2xl font-bold mt-1 tabular-nums text-foreground">{activeDemosCount}</p>
          <span className="text-xs text-muted-foreground">en proceso comercial</span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-sm">
          <span className="text-xs uppercase font-semibold text-blue-600 dark:text-blue-400">Cola de Tareas</span>
          <p className="text-2xl font-bold mt-1 tabular-nums text-blue-700 dark:text-blue-300">
            {queueStats.pending} <span className="text-xs font-normal">pendientes</span>
          </p>
          <span className="text-xs text-blue-600 dark:text-blue-400">
            {queueStats.completed} completados • {queueStats.failed} reintentos
          </span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-sm">
          <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">Worker de Fondo</span>
          <p className="text-2xl font-bold mt-1 capitalize text-emerald-700 dark:text-emerald-300">
            {workerState.status}
          </p>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
            {workerState.workerId} • {workerState.jobsProcessed} jobs
          </span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-sm">
          <span className="text-xs uppercase font-semibold text-amber-600 dark:text-amber-400">Alertas y SLAs</span>
          <p className="text-2xl font-bold mt-1 tabular-nums text-amber-700 dark:text-amber-300">
            {activeAlerts.length}
          </p>
          <span className="text-xs text-amber-600 dark:text-amber-400">
            en riesgo o superados
          </span>
        </div>
      </div>

      {/* Realtime Dual Streams: Event Bus vs Sales Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Realtime Event Bus Ticker */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Bus de Eventos en Tiempo Real</h2>
          <div className="space-y-2 max-h-[380px] overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Esperando eventos en el bus…</p>
            ) : (
              recentEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-start justify-between p-2.5 rounded-lg border border-border/70 bg-background/50 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono font-semibold text-primary">{evt.topic}</span>
                    <p className="text-muted-foreground text-[11px]">
                      Tenant: {evt.tenantId ?? "system"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(evt.emittedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Realtime Sales Activities */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Actividad Comercial Reciente</h2>
          <div className="space-y-2 max-h-[380px] overflow-y-auto">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Sin actividades registradas.</p>
            ) : (
              recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between p-2.5 rounded-lg border border-border/70 bg-background/50 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-medium text-foreground">{act.description}</span>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {act.category.replace("_", " ")} • {act.tenantId}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(act.occurredAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
