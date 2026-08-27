// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const generateTextMock = vi.fn();
vi.mock("ai", () => ({
  generateText: generateTextMock,
  stepCountIs: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() });
const rpcMock = vi.fn().mockResolvedValue({ error: null });

function createMockAdmin(orgResult: { data: unknown; error: unknown }) {
  return {
    from: (table: string) => {
      if (table === "ai_agent_runs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "run-1",
                  organization_id: "org-1",
                  agent_id: "agent-1",
                  agent_version_id: "ver-1",
                  conversation_id: null,
                  contact_id: null,
                  channel_session_id: "cs-1",
                  inbound_message_id: null,
                  status: "pending",
                  is_dry_run: true,
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        };
      }
      if (table === "ai_agent_versions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "ver-1",
                    organization_id: "org-1",
                    agent_id: "agent-1",
                    system_prompt: "Instruções do agente",
                    provider: "anthropic",
                    model: "claude-sonnet-4-6",
                    credential_id: null,
                    tool_ids: [],
                    channel_session_id: "cs-1",
                    max_steps: 5,
                    token_budget: 1000,
                    cost_budget_cents: 100,
                    history_message_window: 10,
                    history_token_window: 1000,
                    handoff_keywords: [],
                    handoff_tool_enabled: false,
                    created_by: "user-1",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => orgResult,
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      };
    },
    rpc: rpcMock,
  };
}

describe("TestPanel Runtime (runAgent) — Proteção contra falha de leitura de organização", () => {
  it("A. falha o run explicitamente com org_not_found e NÃO chama generateText quando a consulta da organização falha com erro", async () => {
    generateTextMock.mockClear();

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => createMockAdmin({ data: null, error: { message: "connection timeout" } }),
    }));

    const { runAgent } = await import("@/lib/ai/runtime/agent");
    const result = await runAgent({ runId: "run-1" });

    expect(result.status).toBe("failed");
    expect(result.error_code).toBe("org_not_found");
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("B. falha o run explicitamente com org_not_found e NÃO chama generateText quando a organização não é encontrada", async () => {
    generateTextMock.mockClear();

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => createMockAdmin({ data: null, error: null }),
    }));

    const { runAgent } = await import("@/lib/ai/runtime/agent");
    const result = await runAgent({ runId: "run-1" });

    expect(result.status).toBe("failed");
    expect(result.error_code).toBe("org_not_found");
    expect(generateTextMock).not.toHaveBeenCalled();
  });
});