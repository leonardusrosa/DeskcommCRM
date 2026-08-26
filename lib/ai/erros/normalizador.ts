/**
 * Normalizador centralizado de erros de provedores de IA.
 *
 * Converte erros técnicos e JSONs de fornecedores em mensagens amigáveis,
 * acionáveis e categorizadas, protegendo a interface do operador contra vazamento
 * de payloads brutos.
 */

import { redigirMensagemDoProvedor } from "@/lib/agent-engine/edge/llm/run-model-call";
import type { ErroAmigavelDoProvedor } from "./tipos";

interface ExtracaoDeErro {
  textoCompleto: string;
  errorType?: string;
  errorMessage?: string;
  code?: string | number;
}

function extrairDetalhesDoErro(err: unknown): ExtracaoDeErro {
  const bruto = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  let errorType: string | undefined;
  let errorMessage: string | undefined;
  let code: string | number | undefined;

  try {
    const trimmed = bruto.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      errorType = parsed.type || parsed.error?.type || parsed.error?.code || parsed.code;
      errorMessage = parsed.message || parsed.error?.message || parsed.msg;
      code = parsed.status || parsed.statusCode || parsed.code || parsed.error?.status;
    }
  } catch {
    // Não é JSON válido, segue com texto puro
  }

  return {
    textoCompleto: bruto,
    errorType,
    errorMessage,
    code,
  };
}

export function normalizarErroDoProvedor(
  err: unknown,
  statusOverride?: number | null,
  modelId?: string,
): ErroAmigavelDoProvedor {
  const { textoCompleto, errorType, errorMessage, code } = extrairDetalhesDoErro(err);
  const status = typeof statusOverride === "number" ? statusOverride : (typeof code === "number" ? code : null);

  const combinado = `${errorType ?? ""} ${errorMessage ?? ""} ${textoCompleto}`.toLowerCase();
  const rawSanitizado = redigirMensagemDoProvedor(textoCompleto);
  const isFreeModel = Boolean(modelId && modelId.toLowerCase().endsWith("-free"));

  // 1. Cota gratuita esgotada (OpenCode Zen FreeUsageLimitError, etc.)
  if (
    errorType === "FreeUsageLimitError" ||
    combinado.includes("freeusagelimiterror") ||
    combinado.includes("free tier limit") ||
    combinado.includes("free usage limit") ||
    combinado.includes("free quota") ||
    (isFreeModel && (status === 429 || combinado.includes("rate limit") || combinado.includes("limit exceeded")))
  ) {
    return {
      categoria: "FREE_QUOTA_EXHAUSTED",
      titulo: "Limite gratuito atingido",
      mensagem: "Este modelo gratuito está temporariamente sem cota disponível. Tente novamente mais tarde ou escolha outro modelo.",
      acaoSugerida: "trocar_modelo",
      rawSanitizado,
      httpStatus: status,
    };
  }

  // 2. Saldo insuficiente / Falta de créditos
  if (
    errorType === "CreditsError" ||
    status === 402 ||
    combinado.includes("creditserror") ||
    combinado.includes("insufficient balance") ||
    combinado.includes("insufficient_quota") ||
    combinado.includes("credit balance is too low") ||
    combinado.includes("out of credits") ||
    combinado.includes("billing")
  ) {
    return {
      categoria: "INSUFFICIENT_CREDITS",
      titulo: "Saldo insuficiente no provedor",
      mensagem: "Sua conta no provedor está sem créditos ou com a cota mensal esgotada. Recarregue os créditos no painel do provedor.",
      acaoSugerida: "painel_provedor",
      rawSanitizado,
      httpStatus: status,
    };
  }

  // 3. Chave de API inválida / não autorizada
  if (
    status === 401 ||
    status === 403 ||
    errorType === "InvalidApiKey" ||
    errorType === "invalid_api_key" ||
    combinado.includes("invalidapikey") ||
    combinado.includes("invalid api key") ||
    combinado.includes("invalid x-api-key") ||
    combinado.includes("incorrect api key") ||
    combinado.includes("authentication failed") ||
    combinado.includes("unauthorized")
  ) {
    return {
      categoria: "INVALID_API_KEY",
      titulo: "Chave de API inválida ou rejeitada",
      mensagem: "O provedor não reconheceu a chave de API informada. Verifique se copiou a chave inteira e atualize-a.",
      acaoSugerida: "atualizar_chave",
      rawSanitizado,
      httpStatus: status,
    };
  }

  // 4. Modelo não suportado / indisponível
  if (
    status === 404 ||
    errorType === "ModelError" ||
    errorType === "model_not_found" ||
    combinado.includes("modelerror") ||
    combinado.includes("is not supported") ||
    combinado.includes("model not found") ||
    combinado.includes("does not exist") ||
    combinado.includes("model is unavailable")
  ) {
    return {
      categoria: "MODEL_UNAVAILABLE",
      titulo: "Modelo indisponível no provedor",
      mensagem: "O modelo selecionado não está disponível ou foi desativado pelo provedor. Escolha outro modelo.",
      acaoSugerida: "trocar_modelo",
      rawSanitizado,
      httpStatus: status,
    };
  }

  // 5. Rate limit geral (quando não é especificamente cota gratuita)
  if (
    status === 429 ||
    errorType === "RateLimitError" ||
    combinado.includes("rate limit") ||
    combinado.includes("too many requests") ||
    combinado.includes("ratelimit")
  ) {
    return {
      categoria: "RATE_LIMIT",
      titulo: "Limite de requisições excedido",
      mensagem: "O provedor recebeu muitas requisições simultâneas. Aguarde alguns instantes e tente novamente.",
      acaoSugerida: "tentar_novamente",
      rawSanitizado,
      httpStatus: status,
    };
  }

  // 6. Timeout / Tempo esgotado
  if (
    status === 408 ||
    status === 504 ||
    combinado.includes("timeout") ||
    combinado.includes("aborted") ||
    combinado.includes("timed out") ||
    combinado.includes("etimedout") ||
    combinado.includes("deadline exceeded")
  ) {
    return {
      categoria: "TIMEOUT",
      titulo: "Tempo de resposta esgotado",
      mensagem: "O provedor demorou muito para responder. Verifique sua conexão e tente novamente.",
      acaoSugerida: "tentar_novamente",
      rawSanitizado,
      httpStatus: status,
    };
  }

  // 7. Provedor temporariamente indisponível / 5xx
  if (
    (status !== null && status >= 500) ||
    combinado.includes("server_error") ||
    combinado.includes("service unavailable") ||
    combinado.includes("bad gateway") ||
    combinado.includes("overloaded") ||
    combinado.includes("service_unavailable") ||
    combinado.includes("econnrefused") ||
    combinado.includes("fetch failed")
  ) {
    return {
      categoria: "PROVIDER_TEMPORARILY_UNAVAILABLE",
      titulo: "Provedor temporariamente indisponível",
      mensagem: "Os servidores do provedor de IA estão passando por instabilidade temporária. Tente novamente em instantes.",
      acaoSugerida: "tentar_novamente",
      rawSanitizado,
      httpStatus: status,
    };
  }

  // 8. Fallback desconhecido
  return {
    categoria: "UNKNOWN_PROVIDER_ERROR",
    titulo: "Falha na comunicação com o provedor",
    mensagem: "Não foi possível completar o teste com o provedor de IA. Tente novamente ou escolha outro modelo.",
    acaoSugerida: "tentar_novamente",
    rawSanitizado,
    httpStatus: status,
  };
}
