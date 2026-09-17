"use client";

import { useAdminSalesWorkspace } from "@/hooks/useAdminSalesWorkspace";
import type { DemoFollowupPlan } from "@/scripts/demo/lib/demo-followups";

export function SalesWorkspaceDashboard() {
  const { data, loading, error, actionLoading, completeItem, refetch } =
    useAdminSalesWorkspace();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando espacio comercial…
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

  const { urgentActions, followups, expiringDemos, highIntentDemos, summary } = data;

  return (
    <div className="space-y-8">
      {/* Top Counter Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-red-600 dark:text-red-400">
            Avisos Urgentes
          </span>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
            {summary.urgentCount}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-blue-600 dark:text-blue-400">
            Follow-ups Pendientes
          </span>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
            {summary.followupsCount}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-amber-600 dark:text-amber-400">
            Demos Expirando (&lt;48h)
          </span>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {summary.expiringCount}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">
            Alta Intención
          </span>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {summary.highIntentCount}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Urgent Actions Section */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-red-500">🚨</span> Acciones Urgentes
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {urgentActions.length} pendientes
            </span>
          </div>

          {urgentActions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No hay acciones con SLA vencido o urgente.
            </p>
          ) : (
            <div className="space-y-3">
              {urgentActions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-lg border p-3.5 bg-muted/20 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {action.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      SLA: {action.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Vence: {new Date(action.slaDueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      onClick={() => void completeItem("action", action.id)}
                      disabled={actionLoading === action.id}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-foreground text-background hover:opacity-90 transition-opacity"
                    >
                      {actionLoading === action.id ? "Guardando…" : "Completar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Follow-ups Section */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-blue-500">📞</span> Follow-ups Comerciales
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {followups.length} programados
            </span>
          </div>

          {followups.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No hay tareas de seguimiento pendientes.
            </p>
          ) : (
            <div className="space-y-3">
              {followups.map((f: DemoFollowupPlan) => (
                <div
                  key={f.id}
                  className="rounded-lg border p-3.5 bg-muted/20 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{f.channel.toUpperCase()}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {f.trigger}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground italic">“{f.messageTemplate}”</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Prioridad: {f.priority}
                    </span>
                    <button
                      onClick={() => void completeItem("followup", f.id)}
                      disabled={actionLoading === f.id}
                      className="px-2.5 py-1 text-xs font-medium rounded border bg-background hover:bg-muted"
                    >
                      {actionLoading === f.id ? "Guardando…" : "Marcar enviado"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Demos Section */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-amber-500">⏳</span> Demos por Expirar (&lt;48h)
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {expiringDemos.length} críticas
            </span>
          </div>

          {expiringDemos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No hay demostraciones próximas a expirar en las próximas 48h.
            </p>
          ) : (
            <div className="space-y-2.5">
              {expiringDemos.map((d) => (
                <div
                  key={d.tenantId}
                  className="rounded-lg border p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-semibold">{d.company}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.leadName} • {d.country}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {d.hoursLeft > 0 ? `${d.hoursLeft}h restantes` : "Expirada"}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Score: {d.score}/100
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High Intent Demos Section */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <span className="text-emerald-500">🔥</span> Demos de Alta Intención
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {highIntentDemos.length} calificadas
            </span>
          </div>

          {highIntentDemos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Aún no se detectan leads con score superior a 60 o señales avanzadas.
            </p>
          ) : (
            <div className="space-y-2.5">
              {highIntentDemos.map((d) => (
                <div
                  key={d.tenantId}
                  className="rounded-lg border p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-semibold">{d.company}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.leadName} • Salud: {d.healthScore}/100
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 tabular-nums">
                      {d.score} pts
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
