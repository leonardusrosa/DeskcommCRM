/**
 * Contexto do Negócio Canônico (Fatos da Organização vs Instruções do Agente).
 *
 * Separação estrita:
 * - FATOS DA ORGANIZAÇÃO: display_name, timezone, business_profile (description, etc.)
 *   pertencem à ORGANIZAÇÃO e são universais para todos os atendentes.
 * - INSTRUÇÕES DO AGENTE: system_prompt da versão (tom, persona, regras de handoff).
 *
 * Invariantes:
 * - Fatos da organização são delimitados como contexto estruturado, mitigando prompt injection.
 * - Campos ausentes são omitidos (nunca inventa fatos ou ramos de atuação).
 * - Fallback gracioso para onboarding_state.welcome.o_que_faz caso business_profile.description
 *   ainda não tenha sido preenchido.
 */

export interface BusinessProfile {
  description?: string | null;
  industry?: string | null;
  business_hours?: string | null;
  website?: string | null;
}

export interface BuildAgentSystemContextInput {
  displayName?: string | null;
  timezone?: string | null;
  businessProfile?: BusinessProfile | null;
  onboardingOQueFaz?: string | null;
  agentInstructions?: string | null;
}

/**
 * Constrói o system prompt final compondo o bloco canônico de contexto do negócio
 * e as instruções específicas do agente.
 */
export function buildAgentSystemContext(input: BuildAgentSystemContextInput): string {
  const lines: string[] = [];

  const displayName = input.displayName?.trim();
  const description =
    input.businessProfile?.description?.trim() ||
    input.onboardingOQueFaz?.trim() ||
    undefined;
  const industry = input.businessProfile?.industry?.trim();
  const businessHours = input.businessProfile?.business_hours?.trim();
  const website = input.businessProfile?.website?.trim();
  const timezone = input.timezone?.trim();

  if (displayName) lines.push(`Empresa: ${displayName}`);
  if (description) lines.push(`O que faz: ${description}`);
  if (industry) lines.push(`Ramo de atuação: ${industry}`);
  if (businessHours) lines.push(`Horário de funcionamento: ${businessHours}`);
  if (website) lines.push(`Site: ${website}`);
  if (timezone) lines.push(`Fuso horário: ${timezone}`);

  const contextBlock =
    lines.length > 0
      ? `[CONTEXTO DO NEGÓCIO]\n${lines.join("\n")}`
      : "";

  const instructions = input.agentInstructions?.trim() ?? "";

  if (!contextBlock) {
    return instructions;
  }

  if (!instructions) {
    return contextBlock;
  }

  return `${contextBlock}\n\n[INSTRUÇÕES DO AGENTE]\n${instructions}`;
}