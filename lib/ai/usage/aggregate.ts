/**
 * Pure aggregator for the AI usage observability dashboard.
 *
 * `cost_cents = null` significa custo DESCONHECIDO, não grátis. O agregador
 * soma apenas custos conhecidos e carrega junto um sinal de completude para a
 * UI não transformar lacuna de preço em "US$ 0".
 */

export interface InvocationRow {
  created_at: string;
  invocation_kind: string;
  cost_cents: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
}

export interface UsagePayload {
  range: { from: string; to: string };
  totals: {
    /** Soma dos custos CONHECIDOS. Veja `cost_is_complete`. */
    cost_cents: number;
    /** false quando houve chamada com tokens mas sem preço/custo conhecido. */
    cost_is_complete: boolean;
    unknown_cost_calls: number;
    total_tokens: number;
    invocations: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    handoff_rate: number;
  };
  series: {
    cost_cents: Array<{ day: string; value: number }>;
    total_tokens: Array<{ day: string; value: number }>;
    p50_latency_ms: Array<{ day: string; value: number }>;
    p95_latency_ms: Array<{ day: string; value: number }>;
    handoff_rate: Array<{ day: string; value: number }>;
  };
  by_kind: Record<string, number>;
}

/** Format a Date as YYYY-MM-DD in UTC. */
export function toUtcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build a contiguous list of UTC day strings from `from` to `to` inclusive. */
export function daysBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (cursor.getTime() <= end.getTime()) {
    out.push(toUtcDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function tokensOf(row: InvocationRow): number {
  if (row.total_tokens != null) return row.total_tokens;
  return (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0);
}

function custoDesconhecido(row: InvocationRow): boolean {
  if (row.cost_cents != null) return false;
  return (row.prompt_tokens ?? 0) > 0 || (row.completion_tokens ?? 0) > 0;
}

export function aggregateUsage(
  rows: InvocationRow[],
  dailyInbounds: Map<string, number>,
  dailyHandoffs: Map<string, number>,
  range: { from: Date; to: Date },
): UsagePayload {
  const days = daysBetween(range.from, range.to);

  const buckets = new Map<
    string,
    { cost: number; tokens: number; latencies: number[]; count: number }
  >();
  for (const day of days) {
    buckets.set(day, { cost: 0, tokens: 0, latencies: [], count: 0 });
  }

  const byKind: Record<string, number> = {};
  let totalCost = 0;
  let totalTokens = 0;
  let unknownCostCalls = 0;
  const allLatencies: number[] = [];

  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    const bucket = buckets.get(day);
    if (!bucket) continue;

    const cost = row.cost_cents ?? 0;
    const tokens = tokensOf(row);
    const latency = row.latency_ms ?? 0;

    if (custoDesconhecido(row)) unknownCostCalls += 1;

    bucket.cost += cost;
    bucket.tokens += tokens;
    bucket.count += 1;
    if (latency > 0) {
      bucket.latencies.push(latency);
      allLatencies.push(latency);
    }

    totalCost += cost;
    totalTokens += tokens;

    const kind = row.invocation_kind;
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }

  const costSeries: Array<{ day: string; value: number }> = [];
  const tokensSeries: Array<{ day: string; value: number }> = [];
  const p50Series: Array<{ day: string; value: number }> = [];
  const p95Series: Array<{ day: string; value: number }> = [];
  const handoffSeries: Array<{ day: string; value: number }> = [];

  let totalInvocations = 0;
  for (const day of days) {
    const bucket = buckets.get(day)!;
    const sortedLat = [...bucket.latencies].sort((a, b) => a - b);
    const p50 = percentile(sortedLat, 50);
    const p95 = percentile(sortedLat, 95);
    const inb = dailyInbounds.get(day) ?? 0;
    const hand = dailyHandoffs.get(day) ?? 0;
    const rate = inb > 0 ? hand / inb : 0;

    costSeries.push({ day, value: bucket.cost });
    tokensSeries.push({ day, value: bucket.tokens });
    p50Series.push({ day, value: p50 });
    p95Series.push({ day, value: p95 });
    handoffSeries.push({ day, value: Number(rate.toFixed(4)) });

    totalInvocations += bucket.count;
  }

  const sortedAll = [...allLatencies].sort((a, b) => a - b);
  const p50All = percentile(sortedAll, 50);
  const p95All = percentile(sortedAll, 95);

  let totalInbounds = 0;
  let totalHandoffs = 0;
  for (const day of days) {
    totalInbounds += dailyInbounds.get(day) ?? 0;
    totalHandoffs += dailyHandoffs.get(day) ?? 0;
  }
  const overallRate = totalInbounds > 0 ? totalHandoffs / totalInbounds : 0;

  return {
    range: {
      from: toUtcDay(range.from),
      to: toUtcDay(range.to),
    },
    totals: {
      cost_cents: totalCost,
      cost_is_complete: unknownCostCalls === 0,
      unknown_cost_calls: unknownCostCalls,
      total_tokens: totalTokens,
      invocations: totalInvocations,
      p50_latency_ms: p50All,
      p95_latency_ms: p95All,
      handoff_rate: Number(overallRate.toFixed(4)),
    },
    series: {
      cost_cents: costSeries,
      total_tokens: tokensSeries,
      p50_latency_ms: p50Series,
      p95_latency_ms: p95Series,
      handoff_rate: handoffSeries,
    },
    by_kind: byKind,
  };
}
