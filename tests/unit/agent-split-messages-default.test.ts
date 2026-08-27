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

  it("nova versão sem split_messages explícito recebe true como default do produto", () => {
    const parsed = versionCreateSchema.parse(baseVersion);
    expect(parsed.split_messages).toBe(true);
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

  it("novo agente via agentMcpCreateSchema sem split_messages recebe true", () => {
    const parsed = agentMcpCreateSchema.parse({
      name: "Novo Atendente",
      version: baseVersion,
    });
    expect(parsed.version.split_messages).toBe(true);
  });

  it("novo agente via agentMcpCreateSchema com split_messages: false preserva false", () => {
    const parsed = agentMcpCreateSchema.parse({
      name: "Novo Atendente",
      version: {
        ...baseVersion,
        split_messages: false,
      },
    });
    expect(parsed.version.split_messages).toBe(false);
  });
});