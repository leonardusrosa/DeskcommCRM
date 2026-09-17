"use client";

import { useSalesMobile } from "@/hooks/useSalesMobile";

export function SalesMobileWorkspace() {
  const { leads, loading, error, onlyHighIntent, setOnlyHighIntent, refetch } = useSalesMobile();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando prospectos urgentes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => void refetch()}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-md mx-auto pb-12">
      {/* Top Filter & Counter */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
        <div>
          <span className="text-xs text-muted-foreground">Prospectos Asignados</span>
          <p className="text-lg font-bold">{leads.length} activos</p>
        </div>
        <button
          onClick={() => setOnlyHighIntent(!onlyHighIntent)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            onlyHighIntent
              ? "bg-amber-500 text-white"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {onlyHighIntent ? "⭐ Alta Intención" : "Todos"}
        </button>
      </div>

      {/* Leads List */}
      {leads.length === 0 ? (
        <div className="p-8 text-center bg-card rounded-xl border border-border text-sm text-muted-foreground">
          No hay prospectos urgentes pendientes en este momento.
        </div>
      ) : (
        leads.map((lead) => {
          const slaBadgeColor =
            lead.sla.status === "breached"
              ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
              : lead.sla.status === "warning"
              ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";

          return (
            <div
              key={lead.id}
              className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base">{lead.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {lead.company} • {lead.country}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <span
                    className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${slaBadgeColor}`}
                  >
                    SLA: {lead.sla.status}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-primary">
                      Score: {lead.score}
                    </span>
                  </div>
                </div>
              </div>

              {/* Suggested Action Box */}
              <div className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-1 border border-border/60">
                <div className="flex justify-between font-medium">
                  <span className="text-foreground">Acción Sugerida:</span>
                  <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400">
                    {lead.suggestedAction.priority}
                  </span>
                </div>
                <p className="text-muted-foreground">{lead.suggestedAction.title}</p>
              </div>

              {/* Quick Contact Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <a
                  href={lead.contact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors text-center"
                >
                  WhatsApp
                </a>
                <a
                  href={lead.contact.phoneUrl}
                  className="flex items-center justify-center py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors text-center"
                >
                  Llamar
                </a>
                <a
                  href={lead.contact.emailUrl}
                  className="flex items-center justify-center py-2 px-3 rounded-lg border border-border bg-background hover:bg-accent text-foreground text-xs font-medium transition-colors text-center"
                >
                  Email
                </a>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
