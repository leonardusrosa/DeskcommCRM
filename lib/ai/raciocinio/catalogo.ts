/**
 * Mapeamento e validação de capacidades de raciocínio (Reasoning Effort).
 *
 * Centraliza as regras de suporte por provedor e modelo, impedindo que checagens
 * ad-hoc de string fiquem espalhadas pelo código.
 */

import {
  type CapacidadeDeRaciocinioDoModelo,
  type NivelDeRaciocinio,
  NIVEIS_DE_RACIOCINIO,
} from "./tipos";

const SEM_RACIOCINIO: CapacidadeDeRaciocinioDoModelo = {
  supports_reasoning: false,
  reasoning_efforts_supported: [],
  reasoning_effort_default: null,
};

const EFFORTS_OPENAI_O_SERIES: NivelDeRaciocinio[] = ["low", "medium", "high"];
const EFFORTS_OPENAI_GPT5: NivelDeRaciocinio[] = ["minimal", "low", "medium", "high", "xhigh"];
const EFFORTS_THINKING_STANDARD: NivelDeRaciocinio[] = ["low", "medium", "high"];
const EFFORTS_GOOGLE_THINKING: NivelDeRaciocinio[] = ["minimal", "low", "medium", "high"];

export function obterCapacidadesDeRaciocinio(
  provider: string,
  modelId: string,
): CapacidadeDeRaciocinioDoModelo {
  const cleanId = (modelId.includes("/") ? modelId.split("/").pop()! : modelId).toLowerCase().trim();

  switch (provider) {
    case "openai": {
      if (cleanId.startsWith("o1") || cleanId.startsWith("o3")) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_OPENAI_O_SERIES,
          reasoning_effort_default: null,
        };
      }
      if (cleanId.startsWith("gpt-5")) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_OPENAI_GPT5,
          reasoning_effort_default: null,
        };
      }
      return SEM_RACIOCINIO;
    }

    case "opencode_zen": {
      if (cleanId.startsWith("o1") || cleanId.startsWith("o3")) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_OPENAI_O_SERIES,
          reasoning_effort_default: null,
        };
      }
      if (cleanId.startsWith("gpt-5")) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_OPENAI_GPT5,
          reasoning_effort_default: null,
        };
      }
      if (
        cleanId.includes("thinking") ||
        cleanId === "claude-3-7-sonnet" ||
        cleanId === "claude-sonnet-5" ||
        cleanId === "deepseek-r1" ||
        cleanId === "gemini-2.5-pro"
      ) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_THINKING_STANDARD,
          reasoning_effort_default: null,
        };
      }
      return SEM_RACIOCINIO;
    }

    case "anthropic": {
      if (
        cleanId.startsWith("claude-3-7-sonnet") ||
        cleanId.startsWith("claude-sonnet-5") ||
        cleanId.startsWith("claude-opus-4")
      ) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_THINKING_STANDARD,
          reasoning_effort_default: null,
        };
      }
      return SEM_RACIOCINIO;
    }

    case "google": {
      if (
        cleanId.includes("thinking") ||
        cleanId.startsWith("gemini-2.5-pro") ||
        cleanId.startsWith("gemini-3.5-flash")
      ) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_GOOGLE_THINKING,
          reasoning_effort_default: null,
        };
      }
      return SEM_RACIOCINIO;
    }

    case "deepseek": {
      if (cleanId.includes("r1") || cleanId.includes("reasoner")) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_THINKING_STANDARD,
          reasoning_effort_default: null,
        };
      }
      return SEM_RACIOCINIO;
    }

    case "openrouter": {
      if (cleanId.includes("r1") || cleanId.includes("thinking") || cleanId.includes("o1") || cleanId.includes("o3")) {
        return {
          supports_reasoning: true,
          reasoning_efforts_supported: EFFORTS_THINKING_STANDARD,
          reasoning_effort_default: null,
        };
      }
      return SEM_RACIOCINIO;
    }

    default:
      return SEM_RACIOCINIO;
  }
}

export function validarEsforcoDeRaciocinio(
  provider: string,
  modelId: string,
  effort: string | null | undefined,
): { ok: true; effort: NivelDeRaciocinio | null } | { ok: false; motivo: string } {
  if (!effort || effort === "auto") {
    return { ok: true, effort: null };
  }

  const normalizado = effort.toLowerCase().trim() as NivelDeRaciocinio;
  if (!NIVEIS_DE_RACIOCINIO.includes(normalizado)) {
    return {
      ok: false,
      motivo: `Nível de raciocínio inválido: "${effort}". Valores aceitos: ${NIVEIS_DE_RACIOCINIO.join(", ")}.`,
    };
  }

  const cap = obterCapacidadesDeRaciocinio(provider, modelId);
  if (!cap.supports_reasoning) {
    return {
      ok: false,
      motivo: `O modelo "${modelId}" do provedor "${provider}" não suporta esforço de raciocínio configurável.`,
    };
  }

  if (!cap.reasoning_efforts_supported.includes(normalizado)) {
    return {
      ok: false,
      motivo: `O modelo "${modelId}" suporta apenas os seguintes níveis de raciocínio: ${cap.reasoning_efforts_supported.join(", ")}.`,
    };
  }

  return { ok: true, effort: normalizado };
}
