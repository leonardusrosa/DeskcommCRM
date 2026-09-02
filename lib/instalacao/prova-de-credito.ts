/**
 * PROVA DE SALDO / CRÉDITO DA INSTALAÇÃO.
 *
 * ## O que isto resolve (spec 19 §4)
 *
 * O instalador aceitava chaves sem saldo (ou com quota esgotada) porque só
 * testava *autenticação* (geralmente uma listagem de modelos). A instalação
 * nascia com o selo "Validada", mas na primeira mensagem real o agente falhava
 * com `insufficient_quota` / `credit_limit_exceeded`.
 *
 * Este módulo faz uma *geração mínima* (1 token de saída) no modelo escolhido
 * usando a chave informada. Se o provedor responder 200, a chave tem saldo
 * suficiente para começar. Qualquer outro status (401, 402, 429 com quota) é
 * devolvido com mensagem clara para o operador corrigir antes de avançar.
 *
 * ⚠️ NÃO pode depender do banco de dados nem de auth Supabase: roda durante a
 * instalação (quando o banco pode estar sendo inicializado) e no diagnóstico que
 * ele mesmo lê, nem ser recusado justamente quando o operador precisa descobrir
 * por que nada funciona.
 */
import { normalizarErro } from "@/lib/agent-engine/edge/llm/run-model-call";
import {
  cabecalhosDeAtribuicaoOpenRouter,
  OPENROUTER_ENDPOINT,
  OPENCODE_ZEN_ENDPOINT,
  DEEPSEEK_ENDPOINT,
} from "@/lib/agent-engine/edge/llm/providers";

export type ResultadoDaProva =
  | { ok: true }
  | {
      ok: false;
      /** Mesmos baldes da tela de Execuções — uma régua só para o mesmo erro. */
      codigo: string;
      mensagem: string;
      httpStatus: number | null;
    };

type Requisicao = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

/** Monta o payload HTTP mínimo para cada provedor suportado. */
export function montarRequisicaoDeProva(
  provider: string,
  apiKey: string,
  modelo: string,
  baseUrl?: string,
  reasoningEffort?: string | null,
): Requisicao | null {
  const msg = [{ role: "user", content: "oi" }];
  switch (provider) {
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: { model: modelo, max_tokens: 1, messages: msg },
      };
    case "openai":
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: {
          model: modelo,
          max_tokens: 1,
          messages: msg,
          ...(reasoningEffort && reasoningEffort !== "auto" ? { reasoning_effort: reasoningEffort } : {}),
        },
      };
    case "openrouter":
      return {
        url: `${baseUrl ?? OPENROUTER_ENDPOINT}/chat/completions`,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          ...cabecalhosDeAtribuicaoOpenRouter(),
        },
        body: {
          model: modelo,
          max_tokens: 1,
          messages: msg,
          ...(reasoningEffort && reasoningEffort !== "auto" ? { reasoning_effort: reasoningEffort } : {}),
        },
      };
    case "google":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        headers: { "content-type": "application/json" },
        body: {
          contents: [{ parts: [{ text: "oi" }] }],
          generationConfig: { maxOutputTokens: 1 },
        },
      };
    case "opencode_zen":
      return {
        url: `${baseUrl ?? OPENCODE_ZEN_ENDPOINT}/chat/completions`,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "user-agent": "DeskcommCRM/1.0",
        },
        body: {
          model: modelo,
          max_tokens: 1,
          messages: msg,
          ...(reasoningEffort && reasoningEffort !== "auto" ? { reasoning_effort: reasoningEffort } : {}),
        },
      };
    case "deepseek":
      return {
        url: `${baseUrl ?? DEEPSEEK_ENDPOINT}/chat/completions`,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: {
          model: modelo,
          max_tokens: 1,
          messages: msg,
          ...(reasoningEffort && reasoningEffort !== "auto" ? { reasoning_effort: reasoningEffort } : {}),
        },
      };
    default:
      // Fail-closed: provedor que este módulo não sabe cobrar não recebe um
      // "ok" por omissão — seria a frase tranquilizadora de novo.
      return null;
  }
}

/** Traduz a resposta HTTP no mesmo vocabulário de erro do runtime. */
export function classificarResposta(status: number, corpo: string): ResultadoDaProva {
  if (status >= 200 && status < 300) return { ok: true };
  // `normalizarErro` lê `status` do objeto — é a régua canônica, compartilhada
  // com a tela de Execuções, e ela também redige a mensagem do provedor (que
  // pode ecoar header de autorização em endpoint próprio).
  const err = Object.assign(new Error(corpo), { status });
  const n = normalizarErro(err);
  return {
    ok: false,
    codigo: n.error_code,
    mensagem: n.error_message,
    httpStatus: n.http_status,
  };
}

/** Executa uma requisição mínima de 1 token contra o provedor e classifica a resposta. */
export async function provarSaldo(
  provider: string,
  apiKey: string,
  modelo: string,
  opcoes?: { baseUrl?: string; fetchImpl?: typeof fetch; reasoningEffort?: string | null },
): Promise<ResultadoDaProva> {
  const req = montarRequisicaoDeProva(provider, apiKey, modelo, opcoes?.baseUrl, opcoes?.reasoningEffort);
  if (!req) {
    return {
      ok: false,
      codigo: "provedor_desconhecido",
      mensagem: `Não sei como testar o provedor "${provider}".`,
      httpStatus: null,
    };
  }

  const f = opcoes?.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);

  try {
    const res = await f(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: ctrl.signal,
    });
    const corpo = await res.text().catch(() => "");
    return classificarResposta(res.status, corpo);
  } catch (err) {
    // Rede fora, DNS, timeout: NÃO é chave ruim, e dizer que é mandaria o
    // operador trocar uma chave que está certa.
    const n = normalizarErro(err);
    return { ok: false, codigo: n.error_code, mensagem: n.error_message, httpStatus: n.http_status };
  } finally {
    clearTimeout(timer);
  }
}
