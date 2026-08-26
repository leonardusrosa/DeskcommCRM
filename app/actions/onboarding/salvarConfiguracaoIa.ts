"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { guardarCredencial } from "@/lib/ai/credenciais/guardar";
import { IDS_DE_PROVEDOR, PROVEDOR_POR_ID } from "@/lib/ai/pontos/provedores";
import type { Provider } from "@/lib/ai/provider-validators";
import { validarEsforcoDeRaciocinio } from "@/lib/ai/raciocinio/catalogo";
import { requireOnboardingCtx, OnboardingError } from "./_shared";

export interface SalvarConfigIaInput {
  provider: string;
  model_id: string;
  reasoning_effort?: string | null;
  api_key?: string;
  base_url?: string;
}

export type ResultadoSalvarConfigIa =
  | {
      ok: true;
      provedor: string;
      modelo: string;
      raciocinio: string | null;
      origem: "org";
      rotulo: string;
      final: string | null;
    }
  | {
      ok: false;
      erro: string;
    };

export async function salvarConfiguracaoIa(
  input: SalvarConfigIaInput,
): Promise<ResultadoSalvarConfigIa> {
  let ctx;
  try {
    ctx = await requireOnboardingCtx();
  } catch (err) {
    if (err instanceof OnboardingError) {
      return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
    }
    throw err;
  }

  if (ctx.role !== "admin") {
    return {
      ok: false,
      erro: "Só um administrador pode alterar a configuração de inteligência artificial.",
    };
  }

  const provider = input.provider;
  if (!(IDS_DE_PROVEDOR as readonly string[]).includes(provider)) {
    return { ok: false, erro: "Escolha qual inteligência artificial você contratou." };
  }

  const modelId = (input.model_id ?? "").trim();
  if (!modelId) {
    return { ok: false, erro: "Escolha o modelo de IA que vai atender." };
  }

  // Validação de esforço de raciocínio
  const validacaoRaciocinio = validarEsforcoDeRaciocinio(
    provider,
    modelId,
    input.reasoning_effort,
  );
  if (!validacaoRaciocinio.ok) {
    return { ok: false, erro: validacaoRaciocinio.motivo };
  }
  const effortEfetivo = validacaoRaciocinio.effort;

  const admin = createAdminClient();
  const apiKey = (input.api_key ?? "").trim();
  let finalKey: string | null = null;

  if (apiKey.length > 0) {
    if (apiKey.length < 8) {
      return {
        ok: false,
        erro: "Essa chave parece incompleta. Cole a chave inteira, do começo ao fim.",
      };
    }

    const r = await guardarCredencial({
      admin,
      orgId: ctx.orgId,
      userId: ctx.userId,
      provider: provider as Provider,
      label: `Chave ${PROVEDOR_POR_ID.get(provider)?.rotulo ?? provider} (${new Date().toLocaleDateString("pt-BR")})`,
      apiKey,
    });

    if (!r.ok) {
      return {
        ok: false,
        erro: "Não consegui validar ou guardar essa chave. Verifique se ela está correta e com saldo.",
      };
    }
    finalKey = r.last4;
  } else {
    // Sem nova chave: verificar se existe credencial ativa e validada da org
    const { data: credsOrg } = await admin
      .from("ai_provider_credentials")
      .select("id, api_key_last4")
      .eq("organization_id", ctx.orgId)
      .eq("provider", provider)
      .eq("is_active", true)
      .not("validated_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const credExistente = credsOrg?.[0];
    if (credExistente) {
      finalKey = credExistente.api_key_last4;
    } else {
      const nomeProvedor = PROVEDOR_POR_ID.get(provider)?.rotulo ?? provider;
      return {
        ok: false,
        erro: `Adicione uma chave da ${nomeProvedor} para usar este provedor.`,
      };
    }
  }

  // Atualiza organizations.settings->'llm'
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", ctx.orgId)
    .single();

  if (orgErr || !org) {
    return { ok: false, erro: "Não consegui carregar as configurações da empresa." };
  }

  const currentSettings = (org.settings as Record<string, unknown>) || {};
  const currentLlm = (currentSettings.llm as Record<string, unknown>) || {};
  const currentParams = (currentLlm.params as Record<string, unknown>) || {};

  const updatedSettings = {
    ...currentSettings,
    llm: {
      ...currentLlm,
      provider,
      default_model: modelId,
      reasoning_effort: effortEfetivo,
      params: {
        ...currentParams,
        reasoning_effort: effortEfetivo,
      },
      base_url: input.base_url?.trim() || currentLlm.base_url,
    },
  };

  const { error: updateErr } = await admin
    .from("organizations")
    .update({ settings: updatedSettings })
    .eq("id", ctx.orgId);

  if (updateErr) {
    return { ok: false, erro: "Falha ao salvar as preferências no banco de dados." };
  }

  revalidatePath("/onboarding", "layout");

  return {
    ok: true,
    provedor: provider,
    modelo: modelId,
    raciocinio: effortEfetivo,
    origem: "org",
    rotulo: PROVEDOR_POR_ID.get(provider)?.rotulo ?? provider,
    final: finalKey,
  };
}
