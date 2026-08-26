import type { PassoDoOnboarding } from "@/lib/onboarding/passos";

/**
 * Retorna a etapa lógica anterior do wizard, sem depender do histórico do
 * navegador. Assim, um deep link não faz "Voltar" escapar para login, e-mail
 * ou uma página externa.
 */
export function hrefAnteriorOnboarding(
  pathname: string,
  passos: readonly PassoDoOnboarding[],
): string | null {
  const prefixo = "/onboarding/";
  if (!pathname.startsWith(prefixo)) return null;

  const segmentoAtual = pathname.slice(prefixo.length).split("/")[0];
  if (!segmentoAtual) return null;

  const indiceAtual = passos.findIndex((passo) => passo.segmento === segmentoAtual);
  if (indiceAtual <= 0) return null;

  const anterior = passos[indiceAtual - 1];
  return anterior ? `/onboarding/${anterior.segmento}` : null;
}
