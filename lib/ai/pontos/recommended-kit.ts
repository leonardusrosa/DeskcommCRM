import { PONTOS_DE_IA } from "./registro";
import { PONTOS_DO_AGENTE_PUBLICADO } from "./resolver";

/**
 * Preset recomendado de produção.
 *
 * O código guarda o default global versionado. Cada organização pode salvar um
 * override próprio de MODELOS em `organizations.settings` sem alterar o preset
 * para os demais tenants. O botão de aplicar sempre lê a versão efetiva salva
 * no servidor — nunca confia numa cópia enviada pelo browser.
 *
 * O preset respeita quem é dono de cada escolha:
 * - agente principal: versão publicada do agente (não é gravado por este painel);
 * - pontos auxiliares configuráveis: binding explícito por organização;
 * - visão: binding explícito por organização;
 * - áudio: transcritor OpenAI-compatible separado, hoje fixo neste painel;
 * - embeddings/RAG e teste do agente: pontos fixos, nunca tocados pelo preset.
 */
export const KIT_RECOMENDADO_V1 = {
  id: "standard-v1",
  versao: 1,
  rotulo: "Kit recomendado",
  descricao:
    "Combinação equilibrada de custo, velocidade e confiabilidade para atendimento comercial.",
  provider: "openrouter",
  agente: {
    modelId: "deepseek/deepseek-v4-flash-0731",
    rotulo: "DeepSeek V4 Flash 0731",
    aplicacao: "versao_do_agente" as const,
  },
  auxiliares: {
    modelId: "deepseek/deepseek-v4-flash-0731",
    rotulo: "DeepSeek V4 Flash 0731",
    aplicacao: "automatica" as const,
  },
  imagem: {
    modelId: "nex-agi/nex-n2-mini",
    rotulo: "Nex-N2-Mini",
    purpose: "visao_de_imagem",
    aplicacao: "automatica" as const,
  },
  audio: {
    // ID do transcritor OpenAI-compatible, deliberadamente SEM prefixo de
    // OpenRouter: o ponto de áudio usa outra API e outra chave.
    modelId: "whisper-large-v3-turbo",
    rotulo: "Whisper Large V3 Turbo",
    purpose: "transcricao_de_audio",
    aplicacao: "transcritor_separado" as const,
  },
} as const;

export const SETTINGS_KEY_KIT_RECOMENDADO = "ai_recommended_kit_override" as const;

export interface ModelosDoKitRecomendado {
  agente: string;
  auxiliares: string;
  imagem: string;
  audio: string;
}

export interface BindingDoKit {
  purpose: string;
  provider: typeof KIT_RECOMENDADO_V1.provider;
  modelId: string;
}

export const MODELOS_PADRAO_DO_KIT: ModelosDoKitRecomendado = {
  agente: KIT_RECOMENDADO_V1.agente.modelId,
  auxiliares: KIT_RECOMENDADO_V1.auxiliares.modelId,
  imagem: KIT_RECOMENDADO_V1.imagem.modelId,
  audio: KIT_RECOMENDADO_V1.audio.modelId,
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function modelosDoKitSalvo(settings: unknown): {
  modelos: ModelosDoKitRecomendado;
  customizado: boolean;
} {
  const raiz = record(settings);
  const override = record(raiz?.[SETTINGS_KEY_KIT_RECOMENDADO]);
  const modelos = record(override?.models);
  if (!modelos) return { modelos: { ...MODELOS_PADRAO_DO_KIT }, customizado: false };

  const agente = nonEmptyString(modelos.agente);
  const auxiliares = nonEmptyString(modelos.auxiliares);
  const imagem = nonEmptyString(modelos.imagem);
  const audio = nonEmptyString(modelos.audio);
  if (!agente || !auxiliares || !imagem || !audio) {
    // Configuração parcial/corrompida não é mesclada com o default: uma metade
    // antiga de um preset não pode virar um "kit" aparentemente válido.
    return { modelos: { ...MODELOS_PADRAO_DO_KIT }, customizado: false };
  }

  return {
    modelos: { agente, auxiliares, imagem, audio },
    customizado: true,
  };
}

export function ehKitPadrao(modelos: ModelosDoKitRecomendado): boolean {
  return (
    modelos.agente === MODELOS_PADRAO_DO_KIT.agente &&
    modelos.auxiliares === MODELOS_PADRAO_DO_KIT.auxiliares &&
    modelos.imagem === MODELOS_PADRAO_DO_KIT.imagem &&
    modelos.audio === MODELOS_PADRAO_DO_KIT.audio
  );
}

/**
 * Persiste só a customização desta organização e preserva todas as demais
 * chaves de `organizations.settings`. Salvar exatamente os defaults remove o
 * override, então uma futura V2 do preset global pode evoluir normalmente.
 */
export function settingsComKitSalvo(
  settings: unknown,
  modelos: ModelosDoKitRecomendado,
): Record<string, unknown> {
  const atual = { ...(record(settings) ?? {}) };
  if (ehKitPadrao(modelos)) {
    delete atual[SETTINGS_KEY_KIT_RECOMENDADO];
    return atual;
  }

  atual[SETTINGS_KEY_KIT_RECOMENDADO] = {
    base_id: KIT_RECOMENDADO_V1.id,
    base_version: KIT_RECOMENDADO_V1.versao,
    models: { ...modelos },
  };
  return atual;
}

/**
 * Retorna apenas o que esta tela pode gravar sem violar outra fonte de verdade.
 * `agent_turn`/`operator_turn` ficam na versão publicada; pontos fixos ficam fora.
 */
export function bindingsDoKitRecomendado(
  modelos: ModelosDoKitRecomendado = MODELOS_PADRAO_DO_KIT,
): BindingDoKit[] {
  return PONTOS_DE_IA.filter(
    (ponto) => ponto.fixo === undefined && !PONTOS_DO_AGENTE_PUBLICADO.has(ponto.id),
  ).map((ponto) => ({
    purpose: ponto.id,
    provider: KIT_RECOMENDADO_V1.provider,
    modelId:
      ponto.id === KIT_RECOMENDADO_V1.imagem.purpose ? modelos.imagem : modelos.auxiliares,
  }));
}

/** Modelos OpenRouter realmente gravados pelo botão de aplicação. */
export function modelosObrigatoriosDoKit(
  modelos: ModelosDoKitRecomendado = MODELOS_PADRAO_DO_KIT,
): string[] {
  return [...new Set(bindingsDoKitRecomendado(modelos).map((binding) => binding.modelId))];
}

/** Modelos OpenRouter que precisam existir para salvar o preset completo. */
export function modelosOpenRouterDoKit(modelos: ModelosDoKitRecomendado): string[] {
  return [...new Set([modelos.agente, modelos.auxiliares, modelos.imagem])];
}
