"use client";

import Link from "next/link";
import { useDemoCenter } from "@/hooks/useDemoCenter";

export function DemoCenterDashboard() {
  const { data, loading, error, refetch } = useDemoCenter();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando Centro de Control Demo…
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

  const { activeDemos, highIntent, slaIssues, recommendedActions, recentAlerts, summary } = data;

  return (
    <div className="space-y-8">
      {/* Top Metric Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Demos Activas</span>
          <p className="text-2xl font-bold mt-1 tabular-nums">{summary.activeDemosCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">Alta Intención</span>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {summary.highIntentCount}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-red-600 dark:text-red-400">Alertas SLA</span>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1 tabular-nums">
            {summary.slaIssuesCount}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-blue-600 dark:text-blue-400">Acciones Pendientes</span>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1 tabular-nums">
            {summary.pendingActionsCount}
          </p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-purple-600 dark:text-purple-400">Alertas Recientes</span>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1 tabular-nums">
            {summary.alertsCount}
          </p>
        </div>
      </div>

      {/* Revenue Forecast Banner */}
      {Object.keys(summary.forecastARR).length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
                Proyección de Ingresos (ARR Forecast)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calculado sobre MRR ganado + pipeline ponderado por probabilidad de cierre.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {Object.entries(summary.forecastARR).map(([cur, arr]) => (
                <div key={cur} className="rounded-lg bg-background border px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] uppercase text-muted-foreground font-mono">{cur} ARR</span>
                  <p className="text-sm font-bold tabular-nums text-foreground">{arr.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Command Center Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* High Intent & Active Demos */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>🔥</span> Demos de Alta Intención & Activas
            </h3>
            <Link href="/admin/demos" className="text-xs text-muted-foreground hover:underline">
              Ver todas ({activeDemos.length})
            </Link>
          </div>

          {highIntent.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No hay leads de alta intención actualmente.</p>
          ) : (
            <div className="space-y-2.5">
              {highIntent.map((demo) => (
                <div
                  key={demo.tenantId}
                  className="rounded-lg border p-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{demo.company}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{demo.country}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Salud: <strong className="text-foreground">{demo.healthScore}/100</strong> • Score:{" "}
                      <strong>{demo.score} pts</strong>
                    </p>
                  </div>
                  <Link
                    href={`/admin/demos/${demo.tenantId}/timeline`}
                    className="px-2.5 py-1 text-xs font-medium rounded border hover:bg-muted"
                  >
                    Cronología
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SLA Issues Section */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>⏱️</span> Estado y Alertas de SLA
            </h3>
            <span className="text-xs text-muted-foreground font-mono">{slaIssues.length} problemas</span>
          </div>

          {slaIssues.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Todos los acuerdos de nivel de servicio están al día.</p>
          ) : (
            <div className="space-y-2.5">
              {slaIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border p-3 flex items-center justify-between gap-2 bg-red-50/40 dark:bg-red-950/10"
                >
                  <div>
                    <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                      {issue.actionType.toUpperCase()}
                    </span>
                    <p className="text-[10px] text-muted-foreground">Tenant: {issue.tenantId}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                      {issue.status}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Vence: {new Date(issue.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Actions */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>💡</span> Acciones Sugeridas por el Motor
            </h3>
            <Link href="/admin/sales" className="text-xs text-muted-foreground hover:underline">
              Ir al Workspace
            </Link>
          </div>

          {recommendedActions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No hay acciones pendientes en cola.</p>
          ) : (
            <div className="space-y-2.5">
              {recommendedActions.slice(0, 5).map((action) => (
                <div key={action.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold">{action.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{action.description}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted font-mono shrink-0">
                    {action.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Alerts Feed */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>📢</span> Registro de Alertas Recientes
            </h3>
            <span className="text-xs text-muted-foreground font-mono">{recentAlerts.length} alertas</span>
          </div>

          {recentAlerts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin alertas registradas en el periodo.</p>
          ) : (
            <div className="space-y-2.5">
              {recentAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{alert.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-mono bg-muted">
                        {alert.channel}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{alert.message}</p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
