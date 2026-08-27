"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Kit {
  id: string;
  versao: number;
  rotulo: string;
  descricao: string;
  provider: string;
  agente: { modelId: string; rotulo: string; aplicacao: string };
  auxiliares: { modelId: string; rotulo: string; aplicacao: string };
  imagem: { modelId: string; rotulo: string; purpose: string; aplicacao: string };
  audio: { modelId: string; rotulo: string; purpose: string; aplicacao: string };
}

interface Credencial {
  id: string;
  provider: string;
  label: string;
  api_key_last4: string | null;
  validated_at: string | null;
  is_active: boolean;
}

interface DadosDoKit {
  kit: Kit;
  bindingsAutomaticos: Array<{ purpose: string; provider: string; modelId: string }>;
  modelos: Array<{ modelId: string; disponivel: boolean }>;
  credenciais: Credencial[];
  podeAplicar: boolean;
}

interface Envelope<T> {
  data?: T;
  error?: { message?: string };
}

export function KitRecomendado() {
  const [dados, setDados] = useState<DadosDoKit | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState("");
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/ai/providers/recommended-kit");
        const json = (await res.json()) as Envelope<DadosDoKit>;
        if (cancelado) return;
        if (!res.ok || !json.data) {
          setErro(json.error?.message ?? "não consegui carregar o kit recomendado");
          return;
        }
        setDados(json.data);
        const primeiraValidada = json.data.credenciais.find((c) => c.validated_at)?.id ?? "";
        setCredentialId(primeiraValidada);
      } catch (e) {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : "não consegui carregar o kit recomendado");
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const modelosIndisponiveis = useMemo(
    () => dados?.modelos.filter((modelo) => !modelo.disponivel).map((modelo) => modelo.modelId) ?? [],
    [dados],
  );

  if (erro) {
    return (
      <Card className="mb-6 border-amber-500/30 p-4">
        <p className="text-sm font-medium">Kit recomendado indisponível</p>
        <p className="mt-1 text-xs text-muted-foreground">{erro}</p>
      </Card>
    );
  }

  if (!dados) return null;

  const credenciaisValidadas = dados.credenciais.filter((c) => c.validated_at !== null);
  const podeExecutar =
    dados.podeAplicar && credentialId !== "" && modelosIndisponiveis.length === 0 && !aplicando;

  async function aplicar() {
    if (!podeExecutar) return;
    const confirmou = window.confirm(
      "Aplicar o Kit recomendado? As escolhas explícitas dos pontos compatíveis serão substituídas. " +
        "A versão publicada do agente, o transcritor de áudio e o RAG não serão alterados.",
    );
    if (!confirmou) return;

    setAplicando(true);
    try {
      const res = await fetch("/api/v1/ai/providers/recommended-kit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential_id: credentialId }),
      });
      const json = (await res.json()) as Envelope<{
        aplicados?: unknown[];
        avisos?: string[];
      }>;
      if (!res.ok) {
        toast.error(json.error?.message ?? "não consegui aplicar o kit recomendado");
        return;
      }
      for (const aviso of json.data?.avisos ?? []) toast.warning(aviso);
      toast.success(
        `Kit recomendado aplicado a ${json.data?.aplicados?.length ?? dados.bindingsAutomaticos.length} pontos.`,
      );
      // O painel vizinho mantém seu próprio snapshot. Recarregar garante que a
      // coluna "Usando" reflita os bindings recém-gravados sem criar duas
      // fontes de estado para a mesma configuração.
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui aplicar o kit recomendado");
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Card className="mb-6 p-5" data-testid="kit-recomendado">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">{dados.kit.rotulo}</h2>
            <Badge variant="secondary">v{dados.kit.versao}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{dados.kit.descricao}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Aplica de uma vez os modelos recomendados aos pontos que este painel controla. O modelo
            principal continua versionado no agente e o áudio continua no transcritor separado.
          </p>
        </div>

        <Button
          onClick={() => void aplicar()}
          disabled={!podeExecutar}
          data-testid="aplicar-kit-recomendado"
        >
          {aplicando ? "Aplicando…" : "Usar kit recomendado"}
        </Button>
      </div>

      <details className="mt-4 rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none font-medium">Ver modelos do kit</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ItemDoKit
            titulo="Agente principal / CRM"
            modelo={dados.kit.agente.rotulo}
            detalhe="Configurar na versão publicada do agente"
            link="/app/ai/agents"
          />
          <ItemDoKit
            titulo="Pontos auxiliares"
            modelo={dados.kit.auxiliares.rotulo}
            detalhe={`Aplicação automática em ${dados.bindingsAutomaticos.filter((b) => b.modelId === dados.kit.auxiliares.modelId).length} pontos`}
          />
          <ItemDoKit
            titulo="Imagem → texto"
            modelo={dados.kit.imagem.rotulo}
            detalhe="Aplicação automática no ponto de visão"
          />
          <ItemDoKit
            titulo="Áudio → texto"
            modelo={dados.kit.audio.rotulo}
            detalhe="Recomendação para o transcritor separado; este botão não o altera"
          />
        </div>
      </details>

      <div className="mt-4 max-w-md">
        <Label className="text-xs">Chave OpenRouter usada pelo kit</Label>
        {credenciaisValidadas.length > 0 ? (
          <Select value={credentialId} onValueChange={setCredentialId}>
            <SelectTrigger className="mt-1" data-testid="chave-kit-recomendado">
              <SelectValue placeholder="escolha uma chave validada" />
            </SelectTrigger>
            <SelectContent>
              {credenciaisValidadas.map((credencial) => (
                <SelectItem key={credencial.id} value={credencial.id}>
                  {credencial.label} ••{credencial.api_key_last4 ?? "??"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
            Nenhuma chave OpenRouter validada. {" "}
            <Link className="underline underline-offset-4" href="/app/ai/credentials">
              Cadastrar ou testar uma chave
            </Link>
          </p>
        )}
      </div>

      {modelosIndisponiveis.length > 0 && (
        <p className="mt-3 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-500">
          O kit não pode ser aplicado ainda: {modelosIndisponiveis.join(", ")} não está ativo no
          catálogo local. Sincronize o catálogo ou personalize os pontos manualmente.
        </p>
      )}

      {!dados.podeAplicar && (
        <p className="mt-3 text-xs text-muted-foreground">
          Você pode ver o preset, mas só um administrador da organização pode aplicá-lo.
        </p>
      )}
    </Card>
  );
}

function ItemDoKit({
  titulo,
  modelo,
  detalhe,
  link,
}: {
  titulo: string;
  modelo: string;
  detalhe: string;
  link?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="mt-0.5 font-mono text-xs">{modelo}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {detalhe}
        {link ? (
          <>
            {" · "}
            <Link className="underline underline-offset-4" href={link}>
              abrir
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
