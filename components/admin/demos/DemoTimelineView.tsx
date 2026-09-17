"use client";

import { useDemoTimeline } from "@/hooks/useDemoTimeline";

const CATEGORY_TABS = [
  { id: "all", label: "Todos los Eventos" },
  { id: "user_action", label: "Actividad de Usuario" },
  { id: "commercial", label: "Acciones Comerciales" },
  { id: "score_change", label: "Cambios de Score" },
  { id: "notification", label: "Notificaciones" },
  { id: "conversion", label: "Conversiones" },
];

const CATEGORY_STYLES: Record<string, { badge: string; icon: string }> = {
  user_action: { badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300", icon: "👤" },
  commercial: { badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300", icon: "💼" },
  score_change: { badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300", icon: "📈" },
  notification: { badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300", icon: "✉️" },
  conversion: { badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300", icon: "🎯" },
  alert: { badge: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300", icon: "🚨" },
};

export function DemoTimelineView({ tenantId }: { tenantId: string }) {
  const {
    data,
    filteredItems,
    loading,
    error,
    categoryFilter,
    setCategoryFilter,
    refetch,
  } = useDemoTimeline(tenantId);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      {data?.lead && (
        <div className="rounded-xl border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">{data.lead.company}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.lead.name} • {data.lead.email} • {data.lead.country}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-foreground uppercase tracking-wide">
              {data.lead.status}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {data.totalEvents} eventos registrados
            </span>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-lg border">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                categoryFilter === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => void refetch()}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Cargando cronología…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => void refetch()} className="text-xs underline ml-4">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="relative pl-6 border-l border-border space-y-6">
          {filteredItems.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No hay eventos en esta categoría para este tenant.
            </p>
          ) : (
            filteredItems.map((item) => {
              const style = CATEGORY_STYLES[item.category] ?? {
                badge: "bg-muted text-muted-foreground",
                icon: "📌",
              };
              return (
                <div key={item.id} className="relative group">
                  {/* Timeline bullet */}
                  <span className="absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border text-[11px] shadow-sm">
                    {style.icon}
                  </span>

                  <div className="rounded-xl border bg-card p-4 space-y-2 group-hover:border-foreground/20 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{item.title}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.badge}`}>
                          {item.badge || item.category}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(item.timestamp).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">{item.description}</p>

                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed text-[10px] font-mono text-muted-foreground/80 overflow-x-auto">
                        {JSON.stringify(item.metadata)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
