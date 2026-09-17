"use client";

import { useDemoCenterHealth } from "@/hooks/useDemoCenterHealth";

export function DemoHealthObservability() {
  const { data, loading, error, refetch } = useDemoCenterHealth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando telemetría y observabilidad…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error ?? "Sin datos disponibles."}</p>
        <button
          onClick={() => void refetch()}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { jobs, failures, latency, notifications, syncHealth } = data;

  return (
    <div className="space-y-8">
      {/* Top Health Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Tareas Totales (Queue)</span>
          <p className="text-2xl font-bold mt-1 tabular-nums">{jobs.total}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
            <span>{jobs.completed} completadas</span> • <span>{jobs.pending} pendientes</span>
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-red-600 dark:text-red-400">Dead-Letter / Fallas</span>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1 tabular-nums">
            {jobs.deadLetter}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Requieren intervención manual</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">Disponibilidad (Uptime)</span>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {latency.uptimePercentage}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Latencia p95: {latency.p95Ms} ms</p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-indigo-600 dark:text-indigo-400">Alertas Disparadas</span>
          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1 tabular-nums">
            {notifications.alertsSent}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">{notifications.alertsFailed} fallos de entrega</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Failures & Dead-Letter Inspector */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>⚠️</span> Inspección de Errores y Dead-Letter
            </h3>
            <span className="text-xs text-muted-foreground font-mono">{failures.length} eventos</span>
          </div>

          {failures.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No hay tareas en cola fallidas ni en la papelera dead-letter.
            </p>
          ) : (
            <div className="space-y-3">
              {failures.map((f) => (
                <div key={f.id} className="rounded-lg border p-3 bg-red-50/20 dark:bg-red-950/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono">{f.jobType}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-mono">
                      {f.attempts} intentos
                    </span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 font-mono text-[11px]">{f.error}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Ocurrió: {new Date(f.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CRM Sync Health */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>🔄</span> Estado de Sincronización CRM
            </h3>
            <button
              onClick={() => void refetch()}
              className="text-xs text-muted-foreground hover:underline"
            >
              Actualizar
            </button>
          </div>

          <div className="space-y-3">
            {syncHealth.map((item) => (
              <div
                key={item.provider}
                className="flex items-center justify-between border-b pb-3 text-xs last:border-b-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{item.provider}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.status === "healthy"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : item.status === "degraded"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {item.lastSyncAt
                      ? `Último sync: ${new Date(item.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Sin eventos registrados en la sesión"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs">{item.successRatePercentage}% éxito</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
