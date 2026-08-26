import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { LinhaDeCatalogo } from "./openrouter";
import { planejarSincronizacao } from "./sincronizar";

export const FONTE_OPENCODE_ZEN = "opencode_zen";

const ENDPOINT_ZEN_MODELS = "https://opencode.ai/zen/v1/models";
const TIMEOUT_MS = 10_000;

export interface ModeloDoZen {
  id?: string;
  created?: number;
  object?: string;
  owned_by?: string;
}

export const MODELOS_FALLBACK_ZEN: ModeloDoZen[] = [
  { id: "mimo-v2.5-free" },
  { id: "nemotron-3.5-lightning-free" },
  { id: "deepseek-v4-flash-free" },
  { id: "claude-sonnet-5" },
  { id: "claude-3-7-sonnet" },
  { id: "gpt-5.6-terra" },
  { id: "gpt-4o" },
  { id: "gemini-3.5-flash" },
  { id: "gemini-2.5-flash" },
  { id: "deepseek-v4-flash" },
  { id: "deepseek-v4-pro" },
];

function formatDisplayName(id: string): string {
  if (id === "mimo-v2.5-free") return "MIMO v2.5 Free";
  if (id === "nemotron-3.5-lightning-free") return "Nemotron 3.5 Lightning Free";
  if (id === "deepseek-v4-flash-free") return "DeepSeek V4 Flash (Free)";
  
  const clean = id
    .replace(/^claude-/, "Claude ")
    .replace(/^gpt-/, "GPT-")
    .replace(/^gemini-/, "Gemini ")
    .replace(/^deepseek-/, "DeepSeek ")
    .replace(/^grok-/, "Grok ")
    .replace(/^qwen/, "Qwen ")
    .replace(/^minimax-/, "MiniMax ")
    .replace(/^glm-/, "GLM ")
    .replace(/^kimi-/, "Kimi ");

  return `${clean} (Zen)`;
}

export function traduzirModeloZen(m: ModeloDoZen): LinhaDeCatalogo | null {
  const id = (m.id ?? "").trim();
  if (!id) return null;

  const isClaude = id.startsWith("claude-");
  const isGpt = id.startsWith("gpt-");
  const isGemini = id.startsWith("gemini-");
  const isDeepSeek = id.startsWith("deepseek-");
  const isFree = id.endsWith("-free");

  const supportsVision = isClaude || isGpt || isGemini;
  const supportsTools = true;

  let contextWindow = 64000;
  if (isClaude) contextWindow = 200000;
  else if (isGemini) contextWindow = 1000000;
  else if (isGpt) contextWindow = 128000;

  return {
    provider: FONTE_OPENCODE_ZEN,
    model_id: id,
    display_name: formatDisplayName(id),
    description: `Modelo ${id} disponível via gateway OpenCode Zen.`,
    context_window: contextWindow,
    input_price_per_million_cents: isFree ? 0 : null,
    output_price_per_million_cents: isFree ? 0 : null,
    supports_tools: supportsTools,
    supports_vision: supportsVision,
    source: FONTE_OPENCODE_ZEN,
  };
}

export function normalizarModelosZen(modelos: ModeloDoZen[]): LinhaDeCatalogo[] {
  const porId = new Map<string, LinhaDeCatalogo>();
  for (const m of modelos) {
    const linha = traduzirModeloZen(m);
    if (linha === null) continue;
    porId.set(linha.model_id, linha);
  }
  return [...porId.values()];
}

export async function buscarDoOpenCodeZen(apiKeyOverride?: string): Promise<ModeloDoZen[]> {
  const apiKey = apiKeyOverride || env.OPENCODE_ZEN_API_KEY;
  if (!apiKey) {
    return MODELOS_FALLBACK_ZEN;
  }
  try {
    const res = await fetch(ENDPOINT_ZEN_MODELS, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "DeskcommCRM/1.0",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`zen_models_status_${res.status}`);
    const json = (await res.json()) as { data?: ModeloDoZen[] };
    if (!Array.isArray(json.data) || json.data.length === 0) {
      throw new Error("zen_models_empty_or_invalid");
    }
    return json.data;
  } catch {
    return MODELOS_FALLBACK_ZEN;
  }
}

export async function sincronizarCatalogoZen(
  admin: ReturnType<typeof createAdminClient>,
  buscar: () => Promise<ModeloDoZen[]> = buscarDoOpenCodeZen,
) {
  const daOrigem = await buscar();
  const normalizados = normalizarModelosZen(daOrigem);

  const { data: noBanco, error: errBanco } = await admin
    .from("ai_models")
    .select("model_id, is_default_for_provider, deprecated_at")
    .eq("provider", FONTE_OPENCODE_ZEN);

  if (errBanco) throw new Error(`catalogo_zen_leitura_falhou: ${errBanco.message}`);

  const plano = planejarSincronizacao(
    normalizados,
    noBanco as { model_id: string; is_default_for_provider: boolean; deprecated_at: string | null }[],
  );

  if (plano.paraGravar.length > 0) {
    const agora = new Date().toISOString();
    const rows = plano.paraGravar.map((l) => ({
      ...l,
      deprecated_at: null,
      synced_at: agora,
    }));
    const { error } = await admin
      .from("ai_models")
      .upsert(rows, { onConflict: "provider,model_id" });
    if (error) throw new Error(`catalogo_zen_upsert_falhou: ${error.message}`);
  }

  if (plano.paraDepreciar.length > 0) {
    const { error } = await admin
      .from("ai_models")
      .update({ deprecated_at: new Date().toISOString() })
      .eq("provider", FONTE_OPENCODE_ZEN)
      .in("model_id", plano.paraDepreciar);
    if (error) throw new Error(`catalogo_zen_depreciacao_falhou: ${error.message}`);
  }

  return {
    fonte: FONTE_OPENCODE_ZEN,
    recebidos: daOrigem.length,
    gravados: plano.paraGravar.length,
    depreciados: plano.paraDepreciar.length,
    ressuscitados: plano.paraRessuscitar.length,
  };
}
