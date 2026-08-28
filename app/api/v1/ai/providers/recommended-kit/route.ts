import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  bindingsDoKitRecomendado,
  ehKitPadrao,
  KIT_RECOMENDADO_V1,
  MODELOS_PADRAO_DO_KIT,
  modelosDoKitSalvo,
  modelosObrigatoriosDoKit,
  modelosOpenRouterDoKit,
  settingsComKitSalvo,
  type ModelosDoKitRecomendado,
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
  input_price_per_million_cents: number | null;
  output_price_per_million_cents: number | null;
  context_window: number | null;
}

const corpoDoPost = z.object({
  credential_id: z.string().uuid(),
});

const idDeModelo = z.string().trim().min(1).max(300);
const corpoDoPut = z.object({
  modelos: z.object({
    agente: idDeModelo,
    auxiliares: idDeModelo,
    imagem: idDeModelo,
    audio: idDeModelo,
  }),
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

function kitParaResposta(modelos: ModelosDoKitRecomendado, catalogo: ModeloDoCatalogo[]) {
  const porId = new Map(catalogo.map((modelo) => [modelo.model_id, modelo]));
  const rotulo = (modelId: string, fallback: string) =>
    porId.get(modelId)?.display_name ?? (modelId === fallback ? fallback : modelId);

  return {
    ...KIT_RECOMENDADO_V1,
    agente: {
      ...KIT_RECOMENDADO_V1.agente,
      modelId: modelos.agente,
      rotulo: rotulo(modelos.agente, KIT_RECOMENDADO_V1.agente.rotulo),
    },
    auxiliares: {
      ...KIT_RECOMENDADO_V1.auxiliares,
      modelId: modelos.auxiliares,
      rotulo: rotulo(modelos.auxiliares, KIT_RECOMENDADO_V1.auxiliares.rotulo),
    },
    imagem: {
      ...KIT_RECOMENDADO_V1.imagem,
      modelId: modelos.imagem,
      rotulo: rotulo(modelos.imagem, KIT_RECOMENDADO_V1.imagem.rotulo),
    },
    audio: {
      ...KIT_RECOMENDADO_V1.audio,
      modelId: modelos.audio,
      rotulo:
        modelos.audio === KIT_RECOMENDADO_V1.audio.modelId
          ? KIT_RECOMENDADO_V1.audio.rotulo
          : modelos.audio,
    },
  };
}

function validarPlanoAutomatico(
  modelos: ModelosDoKitRecomendado,
  catalogo: ModeloDoCatalogo[],
): { ok: true; avisos: string[] } | { ok: false; response: Response } {
  const porId = new Map(catalogo.map((modelo) => [modelo.model_id, modelo]));
  const faltantes = modelosObrigatoriosDoKit(modelos).filter((id) => !porId.has(id));
  if (faltantes.length > 0) {
    return {
      ok: false,
      response: fail(
        "kit_modelo_indisponivel",
        `O kit não foi aplicado porque ${faltantes.join(", ")} não está ativo no catálogo desta instalação. ` +
          "Sincronize o catálogo ou edite o kit.",
        422,
        { details: { modelos_faltantes: faltantes } },
      ),
    };
  }

  const avisos: string[] = [];
  for (const binding of bindingsDoKitRecomendado(modelos)) {
    const modelo = porId.get(binding.modelId);
    if (!modelo) {
      return {
        ok: false,
        response: fail("kit_modelo_indisponivel", `${binding.modelId} não está no catálogo`, 422),
      };
    }

    if (binding.purpose === KIT_RECOMENDADO_V1.imagem.purpose && !modelo.supports_vision) {
      return {
        ok: false,
        response: fail(
          "kit_incompativel",
          `O kit não foi aplicado: ${modelo.model_id} não está marcado como capaz de ler imagens no catálogo atual.`,
          422,
          { details: { purpose: binding.purpose, codigo: "modelo_sem_visao" } },
        ),
      };
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
      return {
        ok: false,
        response: fail(
          "kit_incompativel",
          `O kit não foi aplicado: ${validacao.mensagem}`,
          422,
          { details: { purpose: binding.purpose, codigo: validacao.codigo } },
        ),
      };
    }
    avisos.push(...validacao.avisos.map((aviso) => `${binding.purpose}: ${aviso}`));
  }

  return { ok: true, avisos };
}

/** GET mostra o preset efetivo desta organização e o catálogo usado pelo editor. */
export async function GET(): Promise<Response> {
  const ctx = await contexto("manager");
  if ("resposta" in ctx) return ctx.resposta;

  const [credenciaisRes, modelosRes, orgRes] = await Promise.all([
    ctx.db
      .from("ai_provider_credentials")
      .select("id, provider, label, api_key_last4, validated_at, is_active")
      .eq("organization_id", ctx.org.orgId)
      .eq("provider", KIT_RECOMENDADO_V1.provider)
      .eq("is_active", true),
    ctx.db
      .from("ai_models")
      .select(
        "provider, model_id, display_name, supports_tools, supports_vision, input_price_per_million_cents, output_price_per_million_cents, context_window",
      )
      .eq("provider", KIT_RECOMENDADO_V1.provider)
      .is("deprecated_at", null)
      .order("display_name"),
    ctx.db.from("organizations").select("settings").eq("id", ctx.org.orgId).maybeSingle(),
  ]);

  if (credenciaisRes.error) return fail("load_failed", credenciaisRes.error.message, 500);
  if (modelosRes.error) return fail("load_failed", modelosRes.error.message, 500);
  if (orgRes.error) return fail("load_failed", orgRes.error.message, 500);
  if (!orgRes.data) return fail("org_not_found", "organização não encontrada", 404);

  const catalogo = (modelosRes.data ?? []) as ModeloDoCatalogo[];
  const { modelos, customizado } = modelosDoKitSalvo(orgRes.data.settings);
  const encontrados = new Set(catalogo.map((modelo) => modelo.model_id));
  const modelosAutomaticos = modelosObrigatoriosDoKit(modelos).map((modelId) => ({
    modelId,
    disponivel: encontrados.has(modelId),
  }));

  return ok({
    kit: kitParaResposta(modelos, catalogo),
    modelosEfetivos: modelos,
    modelosPadrao: MODELOS_PADRAO_DO_KIT,
    customizado,
    bindingsAutomaticos: bindingsDoKitRecomendado(modelos),
    modelos: modelosAutomaticos,
    catalogo,
    credenciais: credenciaisRes.data ?? [],
    podeAplicar: ROLE_RANK[ctx.org.role] >= ROLE_RANK.admin,
    podeEditar: ROLE_RANK[ctx.org.role] >= ROLE_RANK.admin,
  });
}

/**
 * PUT salva uma variante do preset para ESTA organização. Não aplica bindings,
 * não publica agente e não mexe no transcritor; apenas muda o que o próximo
 * clique em "Usar kit" considera como preset efetivo.
 */
export async function PUT(req: NextRequest): Promise<Response> {
  const ctx = await contexto("admin");
  if ("resposta" in ctx) return ctx.resposta;

  const parsed = corpoDoPut.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("invalid_body", "modelos do kit inválidos", 422, {
      details: parsed.error.issues,
    });
  }
  const modelos = parsed.data.modelos;

  const [modelosRes, orgRes] = await Promise.all([
    ctx.db
      .from("ai_models")
      .select(
        "provider, model_id, display_name, supports_tools, supports_vision, input_price_per_million_cents, output_price_per_million_cents, context_window",
      )
      .eq("provider", KIT_RECOMENDADO_V1.provider)
      .in("model_id", modelosOpenRouterDoKit(modelos))
      .is("deprecated_at", null),
    ctx.db.from("organizations").select("settings").eq("id", ctx.org.orgId).maybeSingle(),
  ]);

  if (modelosRes.error) return fail("catalogo_indisponivel", modelosRes.error.message, 500);
  if (orgRes.error) return fail("load_failed", orgRes.error.message, 500);
  if (!orgRes.data) return fail("org_not_found", "organização não encontrada", 404);

  const catalogo = (modelosRes.data ?? []) as ModeloDoCatalogo[];
  const porId = new Map(catalogo.map((modelo) => [modelo.model_id, modelo]));
  const faltantes = modelosOpenRouterDoKit(modelos).filter((id) => !porId.has(id));
  if (faltantes.length > 0) {
    return fail(
      "kit_modelo_indisponivel",
      `Não foi possível salvar: ${faltantes.join(", ")} não está ativo no catálogo OpenRouter local.`,
      422,
      { details: { modelos_faltantes: faltantes } },
    );
  }

  const agente = porId.get(modelos.agente);
  if (!agente?.supports_tools) {
    return fail(
      "kit_agente_sem_ferramentas",
      `Não foi possível salvar: ${modelos.agente} não está marcado como capaz de usar ferramentas do CRM.`,
      422,
    );
  }

  const imagem = porId.get(modelos.imagem);
  if (!imagem?.supports_vision) {
    return fail(
      "kit_imagem_sem_visao",
      `Não foi possível salvar: ${modelos.imagem} não está marcado como capaz de ler imagens.`,
      422,
    );
  }

  const validacaoPlano = validarPlanoAutomatico(modelos, catalogo);
  if (!validacaoPlano.ok) return validacaoPlano.response;

  const nextSettings = settingsComKitSalvo(orgRes.data.settings, modelos);
  const { data: atualizado, error } = await ctx.db
    .from("organizations")
    .update({ settings: nextSettings })
    .eq("id", ctx.org.orgId)
    .select("id")
    .maybeSingle();

  if (error) return fail("save_failed", error.message, 500);
  if (!atualizado) return fail("save_failed", "nada foi gravado", 500);

  void audit({
    action: "ai.recommended_kit_customized",
    organizationId: ctx.org.orgId,
    actorUserId: ctx.user.id,
    resourceType: "organization",
    resourceId: ctx.org.orgId,
    metadata: {
      kit_id: KIT_RECOMENDADO_V1.id,
      kit_version: KIT_RECOMENDADO_V1.versao,
      reset_to_default: ehKitPadrao(modelos),
      models: modelos,
    },
  });

  return ok({
    modelos,
    customizado: !ehKitPadrao(modelos),
    avisos: validacaoPlano.avisos,
  });
}

/**
 * POST aplica o preset efetivo salvo no servidor apenas aos bindings que este
 * painel controla. A versão publicada do agente e o transcritor continuam fora.
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

  const [credRes, orgRes] = await Promise.all([
    ctx.db
      .from("ai_provider_credentials")
      .select("id, provider, validated_at, is_active")
      .eq("id", parsed.data.credential_id)
      .eq("organization_id", ctx.org.orgId)
      .eq("provider", KIT_RECOMENDADO_V1.provider)
      .eq("is_active", true)
      .maybeSingle(),
    ctx.db.from("organizations").select("settings").eq("id", ctx.org.orgId).maybeSingle(),
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
  if (orgRes.error) return fail("load_failed", orgRes.error.message, 500);
  if (!orgRes.data) return fail("org_not_found", "organização não encontrada", 404);

  const { modelos, customizado } = modelosDoKitSalvo(orgRes.data.settings);
  const { data: rows, error: modelosErr } = await ctx.db
    .from("ai_models")
    .select(
      "provider, model_id, display_name, supports_tools, supports_vision, input_price_per_million_cents, output_price_per_million_cents, context_window",
    )
    .eq("provider", KIT_RECOMENDADO_V1.provider)
    .in("model_id", modelosObrigatoriosDoKit(modelos))
    .is("deprecated_at", null);
  if (modelosErr) return fail("catalogo_indisponivel", modelosErr.message, 500);

  const validacaoPlano = validarPlanoAutomatico(modelos, (rows ?? []) as ModeloDoCatalogo[]);
  if (!validacaoPlano.ok) return validacaoPlano.response;

  const plano = bindingsDoKitRecomendado(modelos);
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
      customizado,
      provider: KIT_RECOMENDADO_V1.provider,
      purposes: plano.map((p) => p.purpose),
    },
  });

  return ok({
    kitId: KIT_RECOMENDADO_V1.id,
    kitVersion: KIT_RECOMENDADO_V1.versao,
    customizado,
    aplicados: gravados ?? [],
    avisos: validacaoPlano.avisos,
    manual: {
      agente: {
        modelId: modelos.agente,
        caminho: "/app/ai/agents",
      },
      audio: {
        modelId: modelos.audio,
        motivo: "o transcritor de áudio é configurado separadamente do modelo de conversa",
      },
    },
  });
}
