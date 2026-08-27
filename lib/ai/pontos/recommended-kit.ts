import { PONTOS_DE_IA } from "./registro";
import { PONTOS_DO_AGENTE_PUBLICADO } from "./resolver";

/**
 * Preset recomendado de produção.
 *
 * É versionado de propósito: o nome "kit recomendado" pode continuar estável na
 * interface enquanto os modelos evoluem. Uma mudança de modelo vira V2 em vez
 * de alterar silenciosamente o significado de uma configuração já aplicada.
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
    modelId: "openai/whisper-large-v3-turbo",
    rotulo: "Whisper Large V3 Turbo",
    purpose: "transcricao_de_audio",
    aplicacao: "transcritor_separado" as const,
  },
} as const;

export interface BindingDoKit {
  purpose: string;
  provider: typeof KIT_RECOMENDADO_V1.provider;
  modelId: string;
}

/**
 * Retorna apenas o que esta tela pode gravar sem violar outra fonte de verdade.
 *
 * `agent_turn`/`operator_turn` ficam na versão publicada. Pontos `fixo` (áudio,
 * embeddings, TestPanel e contagem de tokens) ficam fora. Todo outro ponto de
 * texto recebe o modelo auxiliar; visão recebe o especialista de imagem.
 */
export function bindingsDoKitRecomendado(): BindingDoKit[] {
  return PONTOS_DE_IA.filter(
    (ponto) => ponto.fixo === undefined && !PONTOS_DO_AGENTE_PUBLICADO.has(ponto.id),
  ).map((ponto) => ({
    purpose: ponto.id,
    provider: KIT_RECOMENDADO_V1.provider,
    modelId:
      ponto.id === KIT_RECOMENDADO_V1.imagem.purpose
        ? KIT_RECOMENDADO_V1.imagem.modelId
        : KIT_RECOMENDADO_V1.auxiliares.modelId,
  }));
}

/** Modelos que precisam existir no catálogo para a aplicação automática. */
export function modelosObrigatoriosDoKit(): string[] {
  return [...new Set(bindingsDoKitRecomendado().map((binding) => binding.modelId))];
}
