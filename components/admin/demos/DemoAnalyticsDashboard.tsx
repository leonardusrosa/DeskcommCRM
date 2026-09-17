"use client";

import { useDemoAnalytics } from "@/hooks/useDemoAnalytics";

const CURRENCIES = ["BRL", "COP", "MXN", "EUR", "USD"] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  BRL: "R$",
  COP: "COP",
  MXN: "MX$",
  EUR: "€",
  USD: "US$",
};

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}

function KpiCard({ label, value, sub, highlight }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-1 ${
        highlight ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-border bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

interface BarRowProps {
  label: string;
  count: number;
  total: number;
}

function BarRow({ label, count, total }: BarRowProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 truncate text-sm text-muted-foreground">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-sm tabular-nums">{count}</span>
    </div>
  );
}

export function DemoAnalyticsDashboard() {
  const { data, loading, error, refetch } = useDemoAnalytics();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
        Cargando analytics…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-3 h-60 justify-center">
        <p className="text-sm text-destructive">{error ?? "No hay datos disponibles."}</p>
        <button onClick={() => void refetch()} className="text-xs underline text-muted-foreground">
          Reintentar
        </button>
      </div>
    );
  }

  const mrrEntries = CURRENCIES.map((c) => ({
    currency: c,
    value: data.estimatedMRR[c],
  })).filter((e) => e.value > 0);

  const byCountryEntries = Object.entries(data.byCountry).sort((a, b) => b[1] - a[1]);
  const byVerticalEntries = Object.entries(data.byVertical).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Demos creados" value={data.demosCreated} />
        <KpiCard
          label="Tasa activación"
          value={`${data.activationRatePercentage}%`}
          sub={`${data.activatedCount} de ${data.demosCreated}`}
          highlight
        />
        <KpiCard label="Reuniones agendadas" value={data.meetingsBooked} />
        <KpiCard
          label="Tasa conversión"
          value={`${data.conversionRatePercentage}%`}
          sub={`${data.convertedCount} convertidos`}
          highlight
        />
        <KpiCard label="Propuestas enviadas" value={data.proposalsSent} />
      </div>

      {/* MRR Estimado */}
      {mrrEntries.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            MRR Estimado (closed_won)
          </h3>
          <div className="flex flex-wrap gap-4">
            {mrrEntries.map(({ currency, value }) => (
              <div key={currency} className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950/20 px-5 py-3 flex flex-col">
                <span className="text-xs text-muted-foreground">{currency}</span>
                <span className="text-2xl font-bold text-green-700 dark:text-green-400 tabular-nums">
                  {CURRENCY_SYMBOLS[currency]}{value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Breakdowns */}
      <div className="grid md:grid-cols-2 gap-6">
        {byCountryEntries.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Por país
            </h3>
            <div className="space-y-2">
              {byCountryEntries.map(([country, count]) => (
                <BarRow key={country} label={country} count={count} total={data.demosCreated} />
              ))}
            </div>
          </section>
        )}

        {byVerticalEntries.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Por vertical
            </h3>
            <div className="space-y-2">
              {byVerticalEntries.map(([vertical, count]) => (
                <BarRow key={vertical} label={vertical} count={count} total={data.demosCreated} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Activity breakdown */}
      <section>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Actividad total ({data.activitySummary.total} eventos)
        </h3>
        <div className="space-y-2">
          {Object.entries(data.activitySummary.byCategory).map(([cat, count]) => (
            <BarRow key={cat} label={cat} count={count} total={data.activitySummary.total} />
          ))}
        </div>
      </section>
    </div>
  );
}
