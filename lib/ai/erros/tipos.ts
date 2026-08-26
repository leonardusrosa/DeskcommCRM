/**
 * Categorias e formatos padronizados para erros de provedores de IA.
 *
 * Garante que payloads brutos de provedores (JSONs, stack traces, etc.) jamais
 * vazem diretamente para a interface do operador.
 */

export const CATEGORIAS_DE_ERRO_PROVEDOR = [
  "RATE_LIMIT",
  "FREE_QUOTA_EXHAUSTED",
  "INSUFFICIENT_CREDITS",
  "INVALID_API_KEY",
  "MODEL_UNAVAILABLE",
  "PROVIDER_TEMPORARILY_UNAVAILABLE",
  "TIMEOUT",
  "UNKNOWN_PROVIDER_ERROR",
] as const;

export type CategoriaDeErroDoProvedor =
  (typeof CATEGORIAS_DE_ERRO_PROVEDOR)[number];

export type AcaoSugeridaErro =
  | "trocar_modelo"
  | "atualizar_chave"
  | "tentar_novamente"
  | "painel_provedor";

export interface ErroAmigavelDoProvedor {
  categoria: CategoriaDeErroDoProvedor;
  titulo: string;
  mensagem: string;
  acaoSugerida: AcaoSugeridaErro;
  /** Mensagem técnica redigida sem segredos para logs estruturados. */
  rawSanitizado?: string;
  httpStatus?: number | null;
}
