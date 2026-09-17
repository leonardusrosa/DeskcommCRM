"use client";

import { useExecutiveRevenue } from "@/hooks/useExecutiveRevenue";
import type { DealCurrency } from "@/scripts/demo/lib/demo-deals";

const CURRENCY_SYMBOLS: Record<DealCurrency, string> = {
  USD: "$",
  EUR: "€",
  BRL: "R$",
  MXN: "MX$",
  COP: "COL$",
};

export function ExecutiveRevenueDashboard() {
  const { data, loading, error, refetch } = useExecutiveRevenue();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando métricas ejecutivas de ingresos…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error ?? "Sin datos ejecutivos disponibles."}</p>
        <button
          onClick={() => void refetch()}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { pipeline, forecast, conversion, cac, channels, campaigns: _campaigns, territories } = data;

  return (
    <div className="space-y-8">
      {/* Top Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Funil Activo</span>
          <p className="text-2xl font-bold mt-1 tabular-nums text-foreground">
            {pipeline.openDealsCount} <span className="text-xs font-normal text-muted-foreground">deals</span>
          </p>
          <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
            <div>BRL: R$ {pipeline.pipelineValueByCurrency.BRL.toLocaleString()}</div>
            <div>EUR: € {pipeline.pipelineValueByCurrency.EUR.toLocaleString()}</div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-sm">
          <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">ARR Forecast Global</span>
          <p className="text-2xl font-bold mt-1 tabular-nums text-emerald-700 dark:text-emerald-300">
            € {forecast.arrForecastByCurrency.EUR.toLocaleString()}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            + R$ {forecast.arrForecastByCurrency.BRL.toLocaleString()} BRL
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-sm">
          <span className="text-xs uppercase font-semibold text-blue-600 dark:text-blue-400">Tasa de Conversión</span>
          <p className="text-2xl font-bold mt-1 tabular-nums text-blue-700 dark:text-blue-300">
            {conversion.overallConversionRate}%
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            {conversion.totalConverted} ganados de {conversion.totalRequested} demos
          </p>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 p-4 shadow-sm">
          <span className="text-xs uppercase font-semibold text-purple-600 dark:text-purple-400">CAC Estimado (Blended)</span>
          <p className="text-2xl font-bold mt-1 tabular-nums text-purple-700 dark:text-purple-300">
            ${cac.estimatedCACUSD} <span className="text-xs font-normal">USD</span>
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
            Inversión atrib.: ${cac.totalSpendUSD} USD
          </p>
        </div>
      </div>

      {/* Regional Territories Performance */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4">Ingresos por Territorio Regional</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {territories.map((t) => (
            <div key={t.id} className="rounded-lg border border-border/80 bg-background p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{t.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-muted font-mono">{t.defaultCurrency}</span>
              </div>
              <div className="text-xs text-muted-foreground">{t.region} • {t.dealsCount} oportunidades</div>
              <div className="pt-2 border-t border-border/40 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Etapas abiertas:</span>
                  <span className="font-semibold">{CURRENCY_SYMBOLS[t.defaultCurrency as DealCurrency] ?? ""}{t.openPipelineValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MRR Ganado:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{CURRENCY_SYMBOLS[t.defaultCurrency as DealCurrency] ?? ""}{t.wonMRR.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Forecast ARR:</span>
                  <span className="font-bold text-foreground">{CURRENCY_SYMBOLS[t.defaultCurrency as DealCurrency] ?? ""}{t.arrForecast.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Acquisition Channels & Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Revenue Attribution */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-3">Atribución de Ingresos por Canal</h2>
          <div className="space-y-3">
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin datos de canales registrados.</p>
            ) : (
              channels.map((ch) => (
                <div key={ch.channel} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-background/50">
                  <div>
                    <p className="text-sm font-medium capitalize">{ch.channel}</p>
                    <p className="text-xs text-muted-foreground">{ch.count} demos atribuidas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {ch.revenue.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">ingresos</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Funnel Stage Breakdown */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-3">Embudo de Conversión Comercial</h2>
          <div className="space-y-3">
            {conversion.stages.map((st) => (
              <div key={st.stage} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">{st.label}</span>
                  <span className="text-muted-foreground">
                    {st.cumulativeCount} ({st.stageConversionRate}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(st.stageConversionRate, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
