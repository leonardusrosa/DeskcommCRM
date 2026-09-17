"use client";

import { useSalesPerformance } from "@/hooks/useSalesPerformance";

export function SalesPerformanceDashboard() {
  const { data, loading, error, refetch } = useSalesPerformance();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando rendimiento comercial…
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

  const { summary, reps } = data;

  return (
    <div className="space-y-8">
      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Vendedores Activos</span>
          <p className="text-2xl font-bold mt-1 tabular-nums">{summary.totalReps}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-blue-600 dark:text-blue-400">Demos Asignadas</span>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1 tabular-nums">
            {summary.totalAssignedDemos}
          </p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-indigo-600 dark:text-indigo-400">Reuniones Agendadas</span>
          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1 tabular-nums">
            {summary.totalMeetingsBooked}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">Tasa Conversión</span>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
            {summary.overallConversionRate}%
          </p>
        </div>
      </div>

      {/* Influenced Revenue Bar */}
      {Object.keys(summary.totalInfluencedRevenue).length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Ingresos Influenciados por el Equipo (Won Deals)
          </h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(summary.totalInfluencedRevenue).map(([cur, val]) => (
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

      {/* Reps Performance Leaderboard Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tabla de Rendimiento Comercial</h3>
          <button
            onClick={() => void refetch()}
            className="text-xs text-muted-foreground hover:underline"
          >
            Actualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Ejecutivo de Ventas</th>
                <th className="px-4 py-3 text-center">Demos Asignadas</th>
                <th className="px-4 py-3 text-center">Tiempo Respuesta</th>
                <th className="px-4 py-3 text-center">Reuniones</th>
                <th className="px-4 py-3 text-center">Conversiones</th>
                <th className="px-4 py-3 text-center">Tasa Conversión</th>
                <th className="px-4 py-3 text-right">Ingresos Cerrados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reps.map((rep) => {
                const revEntries = Object.entries(rep.influencedRevenue).filter(([, v]) => v > 0);
                return (
                  <tr key={rep.repId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <p className="font-semibold text-foreground">{rep.repName}</p>
                      <p className="text-xs text-muted-foreground">{rep.repEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums font-mono">{rep.assignedDemos}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-muted">
                        ~{rep.avgResponseTimeMinutes} min
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{rep.meetingsBooked}</td>
                    <td className="px-4 py-3 text-center tabular-nums font-bold text-foreground">
                      {rep.conversionsCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                          rep.conversionRatePercentage >= 20
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {rep.conversionRatePercentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {revEntries.length === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        revEntries.map(([cur, val]) => (
                          <div key={cur} className="text-xs font-bold text-green-600 dark:text-green-400">
                            {cur} {val.toLocaleString()}
                          </div>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
