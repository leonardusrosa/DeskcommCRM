"use client";

import { useDemoMarketing } from "@/hooks/useDemoMarketing";

export function DemoMarketingDashboard() {
  const { data, loading, error, refetch } = useDemoMarketing();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando métricas de marketing…
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

  const { summary, sources, campaigns, experiments } = data;

  return (
    <div className="space-y-8">
      {/* Top Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Demos Atribuidas</span>
          <p className="text-2xl font-bold mt-1 tabular-nums">{summary.totalAttributedDemos}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-indigo-600 dark:text-indigo-400">Canal Principal</span>
          <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1 truncate">{summary.topSource}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">Campaña Líder</span>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 truncate">{summary.topCampaign}</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-purple-600 dark:text-purple-400">Test A/B Activos</span>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1 tabular-nums">{experiments.length}</p>
        </div>
      </div>

      {/* Revenue Attribution by Currency */}
      {Object.keys(summary.totalRevenue).length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Ingresos Atribuidos a Canales (Won Deals)
          </h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(summary.totalRevenue).map(([cur, val]) => (
              <div key={cur} className="rounded-lg border px-4 py-2 bg-muted/20">
                <span className="text-[10px] text-muted-foreground font-mono">{cur}</span>
                <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
                  {val.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources and Campaigns Tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sources Breakdown */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold border-b pb-3 flex items-center justify-between">
            <span>🌐 Rendimiento por Canal / Fuente</span>
            <span className="text-xs text-muted-foreground font-mono">{sources.length} canales</span>
          </h3>

          {sources.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No hay fuentes registradas.</p>
          ) : (
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.source} className="flex items-center justify-between border-b pb-2 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{s.source}</p>
                    <p className="text-[11px] text-muted-foreground">{s.demosCount} demos registradas</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {s.conversionRate}% conv.
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.convertedCount} convertidas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campaigns Breakdown */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold border-b pb-3 flex items-center justify-between">
            <span>🎯 Rendimiento por Campaña</span>
            <span className="text-xs text-muted-foreground font-mono">{campaigns.length} campañas</span>
          </h3>

          {campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No hay campañas registradas.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.campaign} className="flex items-center justify-between border-b pb-2 text-xs">
                  <div>
                    <p className="font-semibold text-foreground truncate max-w-[200px]">{c.campaign}</p>
                    <p className="text-[11px] text-muted-foreground">{c.demosCount} demos</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {c.conversionRate}% conv.
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{c.convertedCount} cerradas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Experiments Section */}
      {experiments.length > 0 && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold border-b pb-3 flex items-center justify-between">
            <span>🧪 Experimentos A/B en Captación</span>
            <span className="text-xs text-muted-foreground font-mono">{experiments.length} pruebas</span>
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {experiments.map((exp) => (
              <div key={exp.experimentId} className="rounded-lg border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{exp.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-mono bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                    +{exp.upliftPercentage}% Mejora
                  </span>
                </div>
                <div className="space-y-1.5">
                  {exp.variants.map((v) => (
                    <div key={v.variantId} className="flex items-center justify-between text-xs">
                      <span className={v.isLeader ? "font-bold text-foreground" : "text-muted-foreground"}>
                        {v.variantName} {v.isLeader && "🏆"}
                      </span>
                      <span className="tabular-nums font-mono">
                        {v.conversionRatePercentage}% ({v.conversions}/{v.impressions})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
