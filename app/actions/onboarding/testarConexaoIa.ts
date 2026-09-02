"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { validateProviderKey, type Provider } from "@/lib/ai/provider-validators";
import { provarSaldo } from "@/lib/instalacao/prova-de-credito";
import { byteaToBuffer, decryptKey } from "@/lib/crypto/aes_gcm";
import { validarEsforcoDeRaciocinio } from "@/lib/ai/raciocinio/catalogo";
import { PROVEDOR_POR_ID } from "@/lib/ai/pontos/provedores";
import { normalizarErroDoProvedor } from "@/lib/ai/erros/normalizador";
import { requireOnboardingCtx } from "./_shared";

export interface TestarConexaoInput {
  provider: string;
  model_id: string;
  reasoning_effort?: string | null;
  api_key?: string;
  base_url?: string;
}

export type ResultadoTesteConexao =
  | { ok: true }
  | { ok: false; erro: string; titulo?: string; categoria?: string };

export async function testarConexaoIa(
  input: TestarConexaoInput,
): Promise<ResultadoTesteConexao> {
  let ctx;
  try {
    ctx = await requireOnboardingCtx();
  } catch {
    return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
  }

  const { provider, model_id, reasoning_effort, api_key, base_url } = input;
  let chaveParaTeste = (api_key ?? "").trim();

  // Validação de esforço de raciocínio
  const validacaoRaciocinio = validarEsforcoDeRaciocinio(
    provider,
    model_id,
    reasoning_effort,
  );
  if (!validacaoRaciocinio.ok) {
    return { ok: false, erro: validacaoRaciocinio.motivo };
  }

  // Se não foi informada uma chave no formulário, buscar a credencial existente da organização
  if (!chaveParaTeste) {
    const admin = createAdminClient();
    const { data: creds } = await admin
      .from("ai_provider_credentials")
      .select("api_key_encrypted, api_key_iv, api_key_tag")
      .eq("organization_id", ctx.orgId)
      .eq("provider", provider)
      .eq("is_active", true)
      .not("validated_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const c = creds?.[0];
    if (c && c.api_key_encrypted) {
      chaveParaTeste = decryptKey({
        ciphertext: byteaToBuffer(c.api_key_encrypted),
        iv: byteaToBuffer(c.api_key_iv),
        tag: byteaToBuffer(c.api_key_tag),
      });
    }
  }

  if (!chaveParaTeste) {
    const nomeProvedor = PROVEDOR_POR_ID.get(provider)?.rotulo ?? provider;
    return {
      ok: false,
      erro: `Nenhuma chave configurada para ${nomeProvedor}. Insira a chave de API da sua empresa.`,
    };
  }

  // Validação da chave no endpoint de listagem
  const val = await validateProviderKey(provider as Provider, chaveParaTeste);
  if (!val.ok) {
    const norm = normalizarErroDoProvedor(val.error, 401, model_id);
    return {
      ok: false,
      categoria: norm.categoria,
      titulo: norm.titulo,
      erro: norm.mensagem,
    };
  }

  // Prova de saldo / geração de 1 token
  const prova = await provarSaldo(provider, chaveParaTeste, model_id, {
    baseUrl: base_url,
    reasoningEffort: validacaoRaciocinio.effort,
  });
  if (!prova.ok) {
    return {
      ok: false,
      categoria: prova.codigo,
      erro: prova.mensagem,
    };
  }

  return { ok: true };
}
