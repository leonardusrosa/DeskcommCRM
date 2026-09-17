"use client";

import { useDemoCohorts } from "@/hooks/useDemoCohorts";
import type { CohortDimension } from "@/scripts/demo/lib/demo-cohorts";

const DIMENSION_TABS: Array<{ id: CohortDimension; label: string }> = [
  { id: "country", label: "País" },
  { id: "vertical", label: "Vertical" },
  { id: "month", label: "Mes de Creación" },
];

export function DemoCohortsTable() {
  const { dimension, setDimension, data, loading, error, refetch } = useDemoCohorts();

  return (
    <div className="space-y-6">
      {/* Dimension Selector Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-lg border">
          {DIMENSION_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDimension(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dimension === tab.id
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
          Cargando cohortes…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => void refetch()} className="text-xs underline ml-4">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Cohorte</th>
                  <th className="px-4 py-3 text-center">Demos</th>
                  <th className="px-4 py-3 text-center">Activadas</th>
                  <th className="px-4 py-3 text-center">Tasa Activación</th>
                  <th className="px-4 py-3 text-center">Reuniones</th>
                  <th className="px-4 py-3 text-center">Convertidas</th>
                  <th className="px-4 py-3 text-center">Tasa Conversión</th>
                  <th className="px-4 py-3 text-right">MRR Ganado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.cohorts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No hay datos registrados para esta dimensión.
                    </td>
                  </tr>
                ) : (
                  data.cohorts.map((row) => {
                    const mrrEntries = Object.entries(row.estimatedMRR).filter(
                      ([, v]) => v > 0,
                    );
                    return (
                      <tr key={row.key} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                          <span>{row.label}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            ({row.key})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {row.demosCount}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                          {row.activatedCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                              row.activationRatePercentage >= 60
                                ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                                : row.activationRatePercentage >= 30
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {row.activationRatePercentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {row.meetingsCount}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums font-semibold">
                          {row.convertedCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                              row.conversionRatePercentage >= 20
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : row.conversionRatePercentage > 0
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {row.conversionRatePercentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {mrrEntries.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            mrrEntries.map(([cur, val]) => (
                              <div key={cur} className="text-xs">
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  {cur} {val.toLocaleString()}
                                </span>
                              </div>
                            ))
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
