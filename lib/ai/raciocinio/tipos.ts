/**
 * Tipos canônicos de esforço de raciocínio (Reasoning Effort).
 *
 * Normalização agnóstica para modelos que suportam cadeias de pensamento
 * configuráveis (ex: OpenAI o-series/gpt-5, Anthropic Thinking, Google Thinking, DeepSeek R1).
 */

export const NIVEIS_DE_RACIOCINIO = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type NivelDeRaciocinio = (typeof NIVEIS_DE_RACIOCINIO)[number];

export interface CapacidadeDeRaciocinioDoModelo {
  supports_reasoning: boolean;
  reasoning_efforts_supported: NivelDeRaciocinio[];
  reasoning_effort_default: NivelDeRaciocinio | null;
}

export interface RotuloDeNivel {
  id: NivelDeRaciocinio;
  rotulo: string;
  descricao: string;
  aumentaConsumo: boolean;
}

export const ROTULOS_DE_RACIOCINIO: Record<NivelDeRaciocinio, RotuloDeNivel> = {
  minimal: {
    id: "minimal",
    rotulo: "Mínimo (Minimal)",
    descricao: "Raciocínio ultrarrápido com menor latência.",
    aumentaConsumo: false,
  },
  low: {
    id: "low",
    rotulo: "Baixo (Low)",
    descricao: "Raciocínio leve para tarefas simples e rápidas.",
    aumentaConsumo: false,
  },
  medium: {
    id: "medium",
    rotulo: "Médio (Medium)",
    descricao: "Equilíbrio padrão entre profundidade e tempo de resposta.",
    aumentaConsumo: true,
  },
  high: {
    id: "high",
    rotulo: "Alto (High)",
    descricao: "Análise profunda para instruções complexas ou casos difíceis.",
    aumentaConsumo: true,
  },
  xhigh: {
    id: "xhigh",
    rotulo: "Máximo (XHigh)",
    descricao: "Esforço exaustivo de raciocínio.",
    aumentaConsumo: true,
  },
};
