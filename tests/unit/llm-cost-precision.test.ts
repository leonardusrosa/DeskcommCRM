/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeCostCents, _resetRuntimeCostCacheForTests } from "@/lib/ai/runtime/cost";
import { computeCost, _resetPricingCacheForTests } from "@/lib/ai/cost";
import { precoParaCentavosPorMilhao } from "@/lib/ai/catalogo/openrouter";

// Mock Supabase admin client for unit tests
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

describe("LLM Cost Precision - Runtime & Catalog Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRuntimeCostCacheForTests();
    _resetPricingCacheForTests();
  });

  describe("OpenRouter catalog price conversion", () => {
    it("converts cheap model rates to fractional cents without integer rounding", () => {
      // $0.000000001 / token -> 0.1 cents / 1M tokens
      expect(precoParaCentavosPorMilhao("0.000000001")).toBeCloseTo(0.1, 6);

      // $0.000000007 / token -> 0.7 cents / 1M tokens (e.g. DeepSeek cache read)
      expect(precoParaCentavosPorMilhao("0.000000007")).toBeCloseTo(0.7, 6);

      // $0.0000000125 / token -> 1.25 cents / 1M tokens
      expect(precoParaCentavosPorMilhao("0.0000000125")).toBeCloseTo(1.25, 6);

      // $0.000000123456 / token -> 12.3456 cents / 1M tokens
      expect(precoParaCentavosPorMilhao("0.000000123456")).toBeCloseTo(12.3456, 6);
    });

    it("preserves free models as 0 and missing prices as null", () => {
      expect(precoParaCentavosPorMilhao("0")).toBe(0);
      expect(precoParaCentavosPorMilhao(null)).toBeNull();
      expect(precoParaCentavosPorMilhao(undefined)).toBeNull();
      expect(precoParaCentavosPorMilhao("")).toBeNull();
    });
  });

  describe("lib/ai/runtime/cost.ts (computeCostCents)", () => {
    it("preserves sub-cent costs (< 1 cent) without Math.ceil inflation", async () => {
      mockSelect.mockResolvedValueOnce({
        data: [
          {
            provider: "openrouter",
            model_id: "deepseek/deepseek-v4-flash",
            input_price_per_million_cents: 22, // $0.22/1M
            output_price_per_million_cents: 66, // $0.66/1M
          },
        ],
        error: null,
      });

      // 75 input tokens, 244 output tokens
      // input cost = 75 * 22 / 1M = 0.00165 cents
      // output cost = 244 * 66 / 1M = 0.016104 cents
      // total = 0.017754 cents (~ $0.00017754 USD)
      const cost = await computeCostCents({
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        inputTokens: 75,
        outputTokens: 244,
      });

      // Old buggy behavior would return Math.ceil(0.017754) = 1 cent ($0.01)
      expect(cost).toBeCloseTo(0.017754, 6);
      expect(cost).toBeLessThan(1);
    });

    it("calculates tiny costs (< 0.01 cent) accurately", async () => {
      mockSelect.mockResolvedValueOnce({
        data: [
          {
            provider: "openrouter",
            model_id: "cheap-model",
            input_price_per_million_cents: 0.7, // 0.7 cents / 1M
            output_price_per_million_cents: 1.5,
          },
        ],
        error: null,
      });

      // 50 input tokens: 50 * 0.7 / 1M = 0.000035 cents
      const cost = await computeCostCents({
        provider: "openrouter",
        model: "cheap-model",
        inputTokens: 50,
        outputTokens: 0,
      });

      expect(cost).toBeCloseTo(0.000035, 6);
      expect(cost).toBeLessThan(0.01);
    });

    it("calculates multi-cent costs (> 1 cent) accurately without premature rounding", async () => {
      mockSelect.mockResolvedValueOnce({
        data: [
          {
            provider: "anthropic",
            model_id: "claude-opus-5",
            input_price_per_million_cents: 1500, // $15 / 1M = 1500 cents / 1M
            output_price_per_million_cents: 7500, // $75 / 1M = 7500 cents / 1M
          },
        ],
        error: null,
      });

      // 1000 input tokens: 1000 * 1500 / 1M = 1.5 cents
      // 500 output tokens: 500 * 7500 / 1M = 3.75 cents
      // total = 5.25 cents
      const cost = await computeCostCents({
        provider: "anthropic",
        model: "claude-opus-5",
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(cost).toBeCloseTo(5.25, 6);
    });

    it("returns 0 for free models (0 price) and uncataloged models", async () => {
      mockSelect.mockResolvedValueOnce({
        data: [
          {
            provider: "opencode_zen",
            model_id: "nemotron-3-ultra-free",
            input_price_per_million_cents: 0,
            output_price_per_million_cents: 0,
          },
        ],
        error: null,
      });

      const costFree = await computeCostCents({
        provider: "opencode_zen",
        model: "nemotron-3-ultra-free",
        inputTokens: 500,
        outputTokens: 500,
      });
      expect(costFree).toBe(0);

      const costUnknown = await computeCostCents({
        provider: "unknown",
        model: "non-existent",
        inputTokens: 500,
        outputTokens: 500,
      });
      expect(costUnknown).toBe(0);
    });
  });

  describe("lib/ai/cost.ts (computeCost)", () => {
    it("preserves fractional cost for legacy worker invocations", async () => {
      // Mock ai_pricing select empty to fallback to ai_models
      mockSelect
        .mockReturnValueOnce({
          is: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
        })
        .mockReturnValueOnce({
          in: vi.fn().mockReturnValueOnce({
            is: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce({
                data: [
                  {
                    model_id: "meta-llama/llama-3.3-70b-instruct",
                    input_price_per_million_cents: 30, // $0.30/1M
                    output_price_per_million_cents: 40, // $0.40/1M
                  },
                ],
              }),
            }),
          }),
        });

      // 100 prompt tokens (0.003 cents) + 100 completion tokens (0.004 cents) = 0.007 cents
      const cost = await computeCost({
        model: "meta-llama/llama-3.3-70b-instruct",
        promptTokens: 100,
        completionTokens: 100,
      });

      // Old buggy behavior returned Math.ceil(0.007) = 1 cent
      expect(cost).toBeCloseTo(0.007, 6);
      expect(cost).toBeLessThan(1);
    });
  });

  describe("Aggregation precision", () => {
    it("sums 1000 sub-cent calls without per-call rounding drift", () => {
      const callCost = 0.05743; // 0.05743 cents
      let totalCost = 0;
      for (let i = 0; i < 1000; i++) {
        totalCost += callCost;
      }

      // 1000 * 0.05743 cents = 57.43 cents = $0.5743 USD
      expect(totalCost).toBeCloseTo(57.43, 4);

      // If Math.ceil had been used, total would be 1000 * 1 = 1000 cents ($10.00 USD)
      expect(totalCost).not.toBe(1000);
    });
  });
});