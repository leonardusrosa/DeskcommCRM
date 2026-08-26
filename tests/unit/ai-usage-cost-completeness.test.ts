// @vitest-environment node
import { describe, expect, it } from "vitest";

import { aggregateUsage, type InvocationRow } from "@/lib/ai/usage/aggregate";

const range = {
  from: new Date("2026-08-26T00:00:00.000Z"),
  to: new Date("2026-08-26T00:00:00.000Z"),
};

function row(overrides: Partial<InvocationRow> = {}): InvocationRow {
  return {
    created_at: "2026-08-26T12:00:00.000Z",
    invocation_kind: "agent_turn",
    cost_cents: 0.25,
    prompt_tokens: 100,
    completion_tokens: 20,
    total_tokens: 120,
    latency_ms: 500,
    ...overrides,
  };
}

describe("completude do custo de IA", () => {
  it("não transforma chamada com tokens e preço desconhecido em custo zero completo", () => {
    const payload = aggregateUsage(
      [row(), row({ cost_cents: null, prompt_tokens: 80, completion_tokens: 10, total_tokens: 90 })],
      new Map(),
      new Map(),
      range,
    );

    expect(payload.totals.cost_cents).toBe(0.25);
    expect(payload.totals.unknown_cost_calls).toBe(1);
    expect(payload.totals.cost_is_complete).toBe(false);
  });

  it("falha sem usage não torna o custo conhecido incompleto", () => {
    const payload = aggregateUsage(
      [row(), row({ cost_cents: null, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })],
      new Map(),
      new Map(),
      range,
    );

    expect(payload.totals.cost_cents).toBe(0.25);
    expect(payload.totals.unknown_cost_calls).toBe(0);
    expect(payload.totals.cost_is_complete).toBe(true);
  });
});
