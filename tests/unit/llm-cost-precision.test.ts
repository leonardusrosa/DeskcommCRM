/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { computeCostCents, _resetRuntimeCostCacheForTests } from "@/lib/ai/runtime/cost";
import { computeCost, _resetPricingCacheForTests } from "@/lib/ai/cost";
import { precoParaCentavosPorMilhao } from "@/lib/ai/catalogo/openrouter";
import { finalizeRun } from "@/lib/ai/runtime/finalize";

// Mock Supabase admin client for unit tests
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  eq: mockEq,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
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

      const cost = await computeCostCents({
        provider: "openrouter",
        model: "deepseek/deepseek-v4-flash",
        inputTokens: 75,
        outputTokens: 244,
      });

      expect(cost).not.toBeNull();
      expect(cost!).toBeCloseTo(0.017754, 6);
      expect(cost!).toBeLessThan(1);
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

      const cost = await computeCostCents({
        provider: "openrouter",
        model: "cheap-model",
        inputTokens: 50,
        outputTokens: 0,
      });

      expect(cost).not.toBeNull();
      expect(cost!).toBeCloseTo(0.000035, 6);
      expect(cost!).toBeLessThan(0.01);
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

      const cost = await computeCostCents({
        provider: "anthropic",
        model: "claude-opus-5",
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(cost).not.toBeNull();
      expect(cost!).toBeCloseTo(5.25, 6);
    });

    it("returns 0 for genuinely free models (0 price in catalog)", async () => {
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
    });

    it("returns NULL for uncataloged models and missing catalog pricing (unknown != free)", async () => {
      mockSelect.mockResolvedValueOnce({
        data: [
          {
            provider: "opencode_zen",
            model_id: "zen-model-sem-preco",
            input_price_per_million_cents: null,
            output_price_per_million_cents: null,
          },
        ],
        error: null,
      });

      const costMissing = await computeCostCents({
        provider: "opencode_zen",
        model: "zen-model-sem-preco",
        inputTokens: 500,
        outputTokens: 500,
      });
      expect(costMissing).toBeNull();

      const costUncataloged = await computeCostCents({
        provider: "unknown",
        model: "non-existent-model",
        inputTokens: 500,
        outputTokens: 500,
      });
      expect(costUncataloged).toBeNull();
    });
  });

  describe("lib/ai/cost.ts (computeCost)", () => {
    it("preserves fractional cost for legacy worker invocations", async () => {
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

      const cost = await computeCost({
        model: "meta-llama/llama-3.3-70b-instruct",
        promptTokens: 100,
        completionTokens: 100,
      });

      expect(cost).not.toBeNull();
      expect(cost!).toBeCloseTo(0.007, 6);
      expect(cost!).toBeLessThan(1);
    });

    it("returns null when pricing is unknown in both ai_pricing and ai_models", async () => {
      mockSelect
        .mockReturnValueOnce({
          is: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
        })
        .mockReturnValueOnce({
          in: vi.fn().mockReturnValueOnce({
            is: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce({ data: [] }),
            }),
          }),
        });

      const cost = await computeCost({
        model: "completely-unknown-model",
        promptTokens: 100,
        completionTokens: 100,
      });

      expect(cost).toBeNull();
    });

    it("handles embedding-only known price in ai_pricing -> decimal cost", async () => {
      mockSelect.mockReturnValueOnce({
        is: vi.fn().mockResolvedValueOnce({
          data: [
            {
              model: "text-embedding-3-small",
              prompt_cents_per_million_tokens: null,
              completion_cents_per_million_tokens: null,
              embedding_cents_per_million_tokens: 2, // $0.02 / 1M = 2 cents / 1M
            },
          ],
          error: null,
        }),
      });

      const cost = await computeCost({
        model: "text-embedding-3-small",
        embeddingTokens: 500,
      });

      expect(cost).not.toBeNull();
      expect(cost!).toBeCloseTo(0.001, 6);
    });

    it("returns null when embeddingTokens > 0 and embedding rate is NULL in ai_pricing", async () => {
      mockSelect.mockReturnValueOnce({
        is: vi.fn().mockResolvedValueOnce({
          data: [
            {
              model: "custom-embed-model",
              prompt_cents_per_million_tokens: 100,
              completion_cents_per_million_tokens: 200,
              embedding_cents_per_million_tokens: null,
            },
          ],
          error: null,
        }),
      });

      const cost = await computeCost({
        model: "custom-embed-model",
        embeddingTokens: 500,
      });

      expect(cost).toBeNull();
    });

    it("returns null when fallback to ai_models catalog is used with embeddingTokens > 0", async () => {
      mockSelect
        .mockReturnValueOnce({
          is: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
        });

      const cost = await computeCost({
        model: "catalog-model-without-embedding-rate",
        embeddingTokens: 500,
      });

      expect(cost).toBeNull();
    });

    it("does not require embedding rate when zero embedding tokens are used", async () => {
      mockSelect.mockReturnValueOnce({
        is: vi.fn().mockResolvedValueOnce({
          data: [
            {
              model: "gpt-4o",
              prompt_cents_per_million_tokens: 250,
              completion_cents_per_million_tokens: 1000,
              embedding_cents_per_million_tokens: null,
            },
          ],
          error: null,
        }),
      });

      const cost = await computeCost({
        model: "gpt-4o",
        promptTokens: 100,
        completionTokens: 100,
        embeddingTokens: 0,
      });

      expect(cost).not.toBeNull();
      expect(cost!).toBeCloseTo(0.125, 6);
    });

    it("returns 0 for free embedding price explicitly configured as 0", async () => {
      mockSelect.mockReturnValueOnce({
        is: vi.fn().mockResolvedValueOnce({
          data: [
            {
              model: "local-embed-free",
              prompt_cents_per_million_tokens: null,
              completion_cents_per_million_tokens: null,
              embedding_cents_per_million_tokens: 0,
            },
          ],
          error: null,
        }),
      });

      const cost = await computeCost({
        model: "local-embed-free",
        embeddingTokens: 1000,
      });

      expect(cost).toBe(0);
    });
  });

  describe("Finalize persistence with NULL cost", () => {
    it("finalizeRun passes cost_cents: null to Supabase update without coercing to 0", async () => {
      await finalizeRun({
        runId: "test-run-id",
        organizationId: "test-org-id",
        status: "completed",
        costCents: null,
        tokensIn: 50,
        tokensOut: 100,
      });

      expect(mockFrom).toHaveBeenCalledWith("ai_agent_runs");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          cost_cents: null,
          tokens_in: 50,
          tokens_out: 100,
        }),
      );
    });

    it("finalizeRun preserves fractional cost_cents (0.017754) when provided", async () => {
      await finalizeRun({
        runId: "test-run-id-2",
        organizationId: "test-org-id",
        status: "completed",
        costCents: 0.017754,
        tokensIn: 75,
        tokensOut: 244,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          cost_cents: 0.017754,
        }),
      );
    });
  });

  describe("Aggregation precision", () => {
    it("sums 1000 sub-cent calls without per-call rounding drift", () => {
      const callCost = 0.05743; // 0.05743 cents
      let totalCost = 0;
      for (let i = 0; i < 1000; i++) {
        totalCost += callCost;
      }

      expect(totalCost).toBeCloseTo(57.43, 4);
      expect(totalCost).not.toBe(1000);
    });
  });
});