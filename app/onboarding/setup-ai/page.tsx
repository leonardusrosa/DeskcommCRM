import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { lerRetratoDaInstalacao } from "@/lib/instalacao/retrato";
import { lerAmbiente } from "@/lib/instalacao/ambiente";
import { PROVEDORES } from "@/lib/ai/pontos/provedores";
import { SetupAiForm } from "./_form";
import { InteligenciaDele } from "./_inteligencia";
import { capacidadesPadraoDoOnboarding } from "@/lib/ai/agents/capacidades-padrao";
import { TOOL_CATALOG } from "@/lib/mcp/tools/catalog";
import { CONFERENCIAS_DE_SAIDA } from "@/lib/ai/guardrails/lista-de-conferencia";

export const dynamic = "force-dynamic";

export default async function SetupAiPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const supabase = await createClient();
  const [retrato, { data: modelosRaw }, { data: credsOrg }] = await Promise.all([
    lerRetratoDaInstalacao({ supabase, orgId: activeOrg.orgId }),
    supabase
      .from("ai_models")
      .select("provider, model_id, display_name, supports_tools, supports_vision, input_price_per_million_cents")
      .is("deprecated_at", null)
      .order("display_name", { ascending: true }),
    supabase
      .from("ai_provider_credentials")
      .select("provider")
      .eq("organization_id", activeOrg.orgId)
      .eq("is_active", true)
      .not("validated_at", "is", null),
  ]);

  const ambiente = lerAmbiente();
  const chavesDeInstalacao = Object.keys(ambiente.chavesDeProvedor).filter(
    (k) => ambiente.chavesDeProvedor[k] === true,
  );
  const chavesDaOrg = Array.from(new Set((credsOrg ?? []).map((c) => c.provider)));

  const porNome = new Map(TOOL_CATALOG.map((c) => [c.name, c]));
  const capacidades = capacidadesPadraoDoOnboarding()
    .map((id) => porNome.get(id)?.rotulo)
    .filter((r): r is string => Boolean(r));

  const conferencias = CONFERENCIAS_DE_SAIDA.map((c) => c.rotulo);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Treine seu funcionário</h2>
        <p className="text-sm text-muted-foreground">
          Quem ele é, como fala e o que pode prometer. Dá para mudar tudo depois.
        </p>
      </header>

      <InteligenciaDele
        inicial={{
          origem: retrato.inteligencia.origemDaChave,
          provedor: retrato.inteligencia.provedor,
          modelo: retrato.inteligencia.modeloCurado || "padrão",
          rotulo: retrato.inteligencia.rotulo,
          final: retrato.inteligencia.chaveDaOrg?.final ?? null,
        }}
        provedores={PROVEDORES}
        modelos={modelosRaw ?? []}
        chavesDeInstalacao={chavesDeInstalacao}
        chavesDaOrg={chavesDaOrg}
      />

      <SetupAiForm capacidades={capacidades} conferencias={conferencias} />
    </div>
  );
}
