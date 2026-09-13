// @vitest-environment node
import { describe, expect, it } from "vitest";
import { versionCreateSchema, agentMcpCreateSchema } from "@/lib/ai/agents/validation";

describe("split_messages default em ai_agent_versions", () => {
  const baseVersion = {
    system_prompt: "Você é um atendente prestativo.",
    provider: "opencode_zen",
    model: "nemotron-3-ultra-free",
    credential_id: null,
    channel_session_id: "00000000-0000-4000-8000-000000000001",
    tool_ids: [],
  };

  it("nova versão sem split_messages explícito recebe false como default da migration 0059", () => {
    const parsed = versionCreateSchema.parse(baseVersion);
    expect(parsed.split_messages).toBe(false);
  });

  it("respeita false explícito quando fornecido pelo chamador em versionCreateSchema", () => {
    const parsed = versionCreateSchema.parse({
      ...baseVersion,
      split_messages: false,
    });
    expect(parsed.split_messages).toBe(false);
  });

  it("respeita true explícito quando fornecido pelo chamador em versionCreateSchema", () => {
    const parsed = versionCreateSchema.parse({
      ...baseVersion,
      split_messages: true,
    });
    expect(parsed.split_messages).toBe(true);
  });

  it("novo agente via agentMcpCreateSchema sem split_messages recebe false", () => {
    const parsed = agentMcpCreateSchema.parse({
      name: "Novo Atendente",
      version: baseVersion,
    });
    expect(parsed.version.split_messages).toBe(false);
  });

  it("novo agente via agentMcpCreateSchema com split_messages: true preserva true", () => {
    const parsed = agentMcpCreateSchema.parse({
      name: "Novo Atendente",
      version: {
        ...baseVersion,
        split_messages: true,
      },
    });
    expect(parsed.version.split_messages).toBe(true);
  });
});
