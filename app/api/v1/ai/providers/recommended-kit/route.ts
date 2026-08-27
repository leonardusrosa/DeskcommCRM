import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  bindingsDoKitRecomendado,
  KIT_RECOMENDADO_V1,
  modelosObrigatoriosDoKit,
} from "@/lib/ai/pontos/recommended-kit";
import { validarBinding } from "@/lib/ai/pontos/validar-binding";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ModeloDoCatalogo {
  provider: string;
  model_id: string;
  display_name: string;
  supports_tools: boolean;
  supports_vision: boolean;
  deprecated_at: string | null;
}

const corpoDoPost = z.object({
  credential_id: z.string().uuid(),
});

async function contexto(minRole: "manager" | "admin") {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) return { resposta: fail("no_active_org", "nenhuma organização ativa", 400) } as const;
  if (ROLE_RANK[org.role] < ROLE_RANK[minRole]) {
    return {
      resposta: fail(
        "forbidden",
        minRole === "admin" ? "requer papel de administrador" : "requer papel de gerente ou superior",
        403,
      ),
    } as const;
  }
  return { user, org, db: await createClient() } as const;
}

/**
 * GET mostra o preset e se esta organização tem os pré-requisitos para aplicá-lo.
 * Nenhum segredo é devolvido: só id/label/last4 da credencial, igual ao painel.
 */
export async function GET(): Promise<Response> {
  const ctx = await contexto("manager");
  if ("resposta" in ctx) return ctx.resposta;

  const ids = modelosObrigatoriosDoKit();
  const [credenciaisRes, modelosRes] = await Promise.all([
    ctx.db
      .from("ai_provider_credentials")
      .select("id, provider, label, api_key_last4, validated_at, is_active")
      .eq("organization_id", ctx.org.orgId)
      .eq("provider", KIT_RECOMENDADO_V1.provider)
      .eq("is_active", true),
    ctx.db
      .from("ai_models")
      .select("provider, model_id, display_name, supports_tools, supports_vision, deprecated_at")
      .eq("provider", KIT_RECOMENDADO_V1.provider)
      .in("model_id", ids)
      .is("deprecated_at", null),
  ]);

  if (credenciaisRes.error) return fail("load_failed", credenciaisRes.error.message, 500);
  if (modelosRes.error) return fail("load_failed", modelosRes.error.message, 500);

  const encontrados = new Set((modelosRes.data ?? []).map((m) => m.model_id));
  const modelos = ids.map((modelId) => ({
    modelId,
    disponivel: encontrados.has(modelId),
  }));

  return ok({
    kit: KIT_RECOMENDADO_V1,
    bindingsAutomaticos: bindingsDoKitRecomendado(),
    modelos,
    credenciais: credenciaisRes.data ?? [],
    podeAplicar: ROLE_RANK[ctx.org.role] >= ROLE_RANK.admin,
  });
}

/**
 * POST aplica o preset apenas aos bindings que pertencem a este painel.
 *
 * A validação inteira acontece ANTES do único upsert em lote. Assim, modelo que
 * saiu do catálogo ou perdeu capacidade não deixa metade do kit aplicada.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const ctx = await contexto("admin");
  if ("resposta" in ctx) return ctx.resposta;

  const parsed = corpoDoPost.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("invalid_body", "escolha uma chave OpenRouter válida", 422, {
      details: parsed.error.issues,
    });
  }

  const [credRes, modelosRes] = await Promise.all([
    ctx.db
      .from("ai_provider_credentials")
      .select("id, provider, validated_at, is_active")
      .eq("id", parsed.data.credential_id)
      .eq("organization_id", ctx.org.orgId)
      .eq("provider", KIT_RECOMENDADO_V1.provider)
      .eq("is_active", true)
      .maybeSingle(),
    ctx.db
      .from("ai_models")
      .select("provider, model_id, display_name, supports_tools, supports_vision, deprecated_at")
      .eq("provider", KIT_RECOMENDADO_V1.provider)
      .in("model_id", modelosObrigatoriosDoKit())
      .is("deprecated_at", null),
  ]);

  if (credRes.error) return fail("credencial_invalida", credRes.error.message, 422);
  if (!credRes.data) {
    return fail(
      "credencial_invalida",
      "a chave OpenRouter não existe nesta organização ou está desativada",
      422,
    );
  }
  if (!credRes.data.validated_at) {
    return fail(
      "credencial_nao_validada",
      "teste a chave OpenRouter antes de aplicar o kit recomendado",
      422,
    );
  }
  if (modelosRes.error) return fail("catalogo_indisponivel", modelosRes.error.message, 500);

  const modelos = (modelosRes.data ?? []) as ModeloDoCatalogo[];
  const porId = new Map(modelos.map((modelo) => [modelo.model_id, modelo]));
  const faltantes = modelosObrigatoriosDoKit().filter((id) => !porId.has(id));
  if (faltantes.length > 0) {
    return fail(
      "kit_modelo_indisponivel",
      `O kit não foi aplicado porque ${faltantes.join(", ")} não está ativo no catálogo desta instalação. ` +
        "Sincronize o catálogo ou personalize os pontos manualmente.",
      422,
      { details: { modelos_faltantes: faltantes } },
    );
  }

  const plano = bindingsDoKitRecomendado();
  const avisos: string[] = [];
  for (const binding of plano) {
    const modelo = porId.get(binding.modelId);
    // `faltantes` acima torna este ramo impossível, mas mantê-lo explícito faz
    // a segurança sobreviver a uma futura mudança no plano.
    if (!modelo) {
      return fail("kit_modelo_indisponivel", `${binding.modelId} não está no catálogo`, 422);
    }
    const validacao = validarBinding({
      pontoId: binding.purpose,
      modelo: {
        model_id: modelo.model_id,
        supports_tools: modelo.supports_tools,
        supports_vision: modelo.supports_vision,
        conhecido: true,
      },
    });
    if (!validacao.ok) {
      return fail(
        "kit_incompativel",
        `O kit não foi aplicado: ${validacao.mensagem}`,
        422,
        { details: { purpose: binding.purpose, codigo: validacao.codigo } },
      );
    }
    avisos.push(...validacao.avisos.map((aviso) => `${binding.purpose}: ${aviso}`));
  }

  const linhas = plano.map((binding) => ({
    organization_id: ctx.org.orgId,
    purpose: binding.purpose,
    provider: binding.provider,
    model_id: binding.modelId,
    credential_id: parsed.data.credential_id,
    base_url: null,
    is_enabled: true,
  }));

  const { data: gravados, error } = await ctx.db
    .from("ai_purpose_bindings")
    .upsert(linhas, { onConflict: "organization_id,purpose" })
    .select("id, purpose, provider, model_id, is_enabled");

  if (error) return fail("save_failed", error.message, 500);
  if ((gravados ?? []).length !== linhas.length) {
    return fail(
      "save_failed",
      "o banco não confirmou todos os pontos do kit; nenhuma configuração deve ser considerada concluída",
      500,
    );
  }

  void audit({
    action: "ai.recommended_kit_applied",
    organizationId: ctx.org.orgId,
    actorUserId: ctx.user.id,
    resourceType: "organization",
    resourceId: ctx.org.orgId,
    metadata: {
      kit_id: KIT_RECOMENDADO_V1.id,
      kit_version: KIT_RECOMENDADO_V1.versao,
      provider: KIT_RECOMENDADO_V1.provider,
      purposes: plano.map((p) => p.purpose),
      // Credencial deliberadamente ausente do audit. O dado útil é qual preset
      // mudou o roteamento; chave/identificador de chave não é necessário aqui.
    },
  });

  return ok({
    kitId: KIT_RECOMENDADO_V1.id,
    kitVersion: KIT_RECOMENDADO_V1.versao,
    aplicados: gravados ?? [],
    avisos,
    manual: {
      agente: {
        modelId: KIT_RECOMENDADO_V1.agente.modelId,
        caminho: "/app/ai/agents",
      },
      audio: {
        modelId: KIT_RECOMENDADO_V1.audio.modelId,
        motivo: "o transcritor de áudio é configurado separadamente do modelo de conversa",
      },
    },
  });
}
