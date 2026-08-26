/**
 * Adaptador de runtime para opções de raciocínio específicas de cada provedor.
 *
 * Converte a configuração normalizada do Deskcomm (ex: "high", "low", "auto"/null)
 * nos parâmetros exatos esperados pelo SDK e protocolo wire de cada vendor.
 */

import type { NivelDeRaciocinio } from "./tipos";
import { obterCapacidadesDeRaciocinio } from "./catalogo";

export interface OpcoesDeExecucaoDeRaciocinio {
  requestedEffort: NivelDeRaciocinio | null;
  effectiveEffort: NivelDeRaciocinio | null;
  providerOptions?: Record<string, Record<string, any>>;
  extraBody?: Record<string, any>;
}

const BUDGET_ANTHROPIC: Record<NivelDeRaciocinio, number> = {
  minimal: 1024,
  low: 1024,
  medium: 4096,
  high: 16384,
  xhigh: 32768,
};

const BUDGET_GOOGLE: Record<NivelDeRaciocinio, number> = {
  minimal: 512,
  low: 1024,
  medium: 4096,
  high: 16384,
  xhigh: 24576,
};

export function montarOpcoesDeRaciocinio(
  provider: string,
  modelId: string,
  effort: string | null | undefined,
): OpcoesDeExecucaoDeRaciocinio {
  if (!effort || effort === "auto") {
    return {
      requestedEffort: null,
      effectiveEffort: null,
      providerOptions: undefined,
      extraBody: undefined,
    };
  }

  const normalizado = effort.toLowerCase().trim() as NivelDeRaciocinio;
  const cap = obterCapacidadesDeRaciocinio(provider, modelId);
  if (!cap.supports_reasoning || !cap.reasoning_efforts_supported.includes(normalizado)) {
    return {
      requestedEffort: normalizado,
      effectiveEffort: null,
      providerOptions: undefined,
      extraBody: undefined,
    };
  }

  const cleanId = (modelId.includes("/") ? modelId.split("/").pop()! : modelId).toLowerCase().trim();

  switch (provider) {
    case "openai": {
      return {
        requestedEffort: normalizado,
        effectiveEffort: normalizado,
        providerOptions: {
          openai: {
            reasoningEffort: normalizado,
          },
        },
      };
    }

    case "anthropic": {
      const budget = BUDGET_ANTHROPIC[normalizado] ?? 4096;
      return {
        requestedEffort: normalizado,
        effectiveEffort: normalizado,
        providerOptions: {
          anthropic: {
            thinking: {
              type: "enabled",
              budgetTokens: budget,
            },
          },
        },
      };
    }

    case "google": {
      const budget = BUDGET_GOOGLE[normalizado] ?? 4096;
      return {
        requestedEffort: normalizado,
        effectiveEffort: normalizado,
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget: budget,
            },
          },
        },
      };
    }

    case "opencode_zen": {
      if (cleanId.startsWith("claude-")) {
        const budget = BUDGET_ANTHROPIC[normalizado] ?? 4096;
        return {
          requestedEffort: normalizado,
          effectiveEffort: normalizado,
          providerOptions: {
            openai: {
              reasoningEffort: normalizado,
            },
            anthropic: {
              thinking: {
                type: "enabled",
                budgetTokens: budget,
              },
            },
          },
        };
      }
      return {
        requestedEffort: normalizado,
        effectiveEffort: normalizado,
        providerOptions: {
          openai: {
            reasoningEffort: normalizado,
          },
        },
        extraBody: {
          reasoning_effort: normalizado,
        },
      };
    }

    case "openrouter": {
      return {
        requestedEffort: normalizado,
        effectiveEffort: normalizado,
        providerOptions: {
          openai: {
            reasoningEffort: normalizado,
          },
        },
        extraBody: {
          reasoning: {
            effort: normalizado,
          },
        },
      };
    }

    case "deepseek": {
      return {
        requestedEffort: normalizado,
        effectiveEffort: normalizado,
        providerOptions: {
          openai: {
            reasoningEffort: normalizado,
          },
        },
      };
    }

    default:
      return {
        requestedEffort: normalizado,
        effectiveEffort: null,
      };
  }
}
