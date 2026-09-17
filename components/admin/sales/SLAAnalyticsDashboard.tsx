"use client";

import { useSLAAnalytics } from "@/hooks/useSLAAnalytics";

export function SLAAnalyticsDashboard() {
  const { data, loading, error, refetch } = useSLAAnalytics();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando analítica histórica de SLA…
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

  const { summary, byActionType, recentBreaches } = data;

  return (
    <div className="space-y-8">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">Tasa de Cumplimiento</span>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {summary.complianceRatePercentage}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{summary.completedOnTime} a tiempo</p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-red-600 dark:text-red-400">Quebras de SLA</span>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1 tabular-nums">
            {summary.breachedCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Requieren escalamiento</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-amber-600 dark:text-amber-400">En Advertencia</span>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1 tabular-nums">
            {summary.warningCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">&lt; 30 min para vencer</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Tiempo Promedio</span>
          <p className="text-2xl font-bold mt-1 tabular-nums">~{summary.avgResolutionMinutes} min</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Desde creación a resolución</p>
        </div>
      </div>

      {/* Breakdown by Action Type */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cumplimiento Histórico por Tipo de Acción</h3>
          <button onClick={() => void refetch()} className="text-xs text-muted-foreground hover:underline">
            Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Tipo de Acción</th>
                <th className="px-4 py-3 text-center">Total Timers</th>
                <th className="px-4 py-3 text-center">Cumplidos</th>
                <th className="px-4 py-3 text-center">Quebrados</th>
                <th className="px-4 py-3 text-right">Tasa de Cumplimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byActionType.map((row) => (
                <tr key={row.actionType} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground uppercase text-xs">
                    {row.actionType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums font-mono">{row.total}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-emerald-600 font-bold">{row.completed}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-red-600 font-bold">{row.breached}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                        row.complianceRate >= 80
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : row.complianceRate >= 50
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {row.complianceRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Breaches Feed */}
      {recentBreaches.length > 0 && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold border-b pb-3 flex items-center justify-between">
            <span>🚨 Incidentes Recientes de Quebra de SLA</span>
            <span className="text-xs text-muted-foreground font-mono">{recentBreaches.length} eventos</span>
          </h3>

          <div className="space-y-2.5">
            {recentBreaches.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-red-50/20 dark:bg-red-950/10 text-xs"
              >
                <div>
                  <span className="font-bold text-red-700 dark:text-red-300 uppercase">
                    {b.actionType.replace(/_/g, " ")}
                  </span>
                  <p className="text-[11px] text-muted-foreground">Tenant: {b.tenantId}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono">
                    {b.escalatedTo ? `Escalado a ${b.escalatedTo}` : "Pendiente de escalamiento"}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Venció: {new Date(b.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
