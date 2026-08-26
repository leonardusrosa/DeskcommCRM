/**
 * A chave funciona — e tem saldo?
 *
 * O produto já sabia responder a primeira metade e chamava isso de "Validada".
 * O validador bate em `GET /v1/models` de cada provedor: um endpoint de
 * LISTAGEM, que não consome crédito e responde 200 com a conta zerada. Ou seja,
 * o selo verde prova que a chave existe e é aceita — nunca que ela vai
 * funcionar. Quem instalou, viu "Validada" e recebeu erro na primeira conversa
 * não tinha como saber onde olhar.
 *
 * A única coisa que prova saldo é a coisa que o provedor cobra: uma geração.
 * Por isso a prova aqui é uma chamada real, mínima (um token), e por isso ela
 * nunca sai de graça — é explicitamente pedida, não roda num GET que a tela
 * chama sozinha.
 *
 * ⚠️ Não usa `runModelCall` de propósito: aquele caminho grava em `llm_calls` e
 * é barrado pelo orçamento mensal. Um diagnóstico não pode poluir a tabela que
 * ele mesmo lê, nem ser recusado justamente quando o operador precisa descobrir
 * por que nada funciona.
 */
import {
  cabecalhosDeAtribuicaoOpenRouter,
  OPENROUTER_ENDPOINT,
  OPENCODE_ZEN_ENDPOINT,
  DEEPSEEK_ENDPOINT,
} from "@/lib/agent-engine/edge/llm/providers";
import { normalizarErroDoProvedor } from "@/lib/ai/erros/normalizador";
import type { AcaoSugeridaErro, CategoriaDeErroDoProvedor } from "@/lib/ai/erros/tipos";

export type ResultadoDaProva =
  | { ok: true }
  | {
      ok: false;
      codigo: CategoriaDeErroDoProvedor | string;
      titulo: string;
      mensagem: string;
      acaoSugerida: AcaoSugeridaErro | string;
      httpStatus: number | null;
    };

interface Requisicao {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * A menor geração possível em cada provedor. `max_tokens: 1` porque o objetivo
 * é atravessar a cobrança, não obter texto.
 */
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
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelo,
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
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
      return null;
  }
}

/** Traduz a resposta HTTP no vocabulário amigável e seguro de erro do runtime. */
export function classificarResposta(
  status: number,
  corpo: string,
  modelId?: string,
): ResultadoDaProva {
  if (status >= 200 && status < 300) return { ok: true };
  const amigavel = normalizarErroDoProvedor(corpo, status, modelId);
  return {
    ok: false,
    codigo: amigavel.categoria,
    titulo: amigavel.titulo,
    mensagem: amigavel.mensagem,
    acaoSugerida: amigavel.acaoSugerida,
    httpStatus: typeof status === "number" ? status : null,
  };
}

const TIMEOUT_MS = 8000;

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
      codigo: "UNKNOWN_PROVIDER_ERROR",
      titulo: "Provedor não reconhecido",
      mensagem: `Não sei como testar o provedor "${provider}".`,
      acaoSugerida: "tentar_novamente",
      httpStatus: null,
    };
  }

  const f = opcoes?.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await f(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal: ctrl.signal,
    });
    const corpo = await res.text().catch(() => "");
    return classificarResposta(res.status, corpo, modelo);
  } catch (err) {
    const amigavel = normalizarErroDoProvedor(err, null, modelo);
    return {
      ok: false,
      codigo: amigavel.categoria,
      titulo: amigavel.titulo,
      mensagem: amigavel.mensagem,
      acaoSugerida: amigavel.acaoSugerida,
      httpStatus: amigavel.httpStatus ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}
