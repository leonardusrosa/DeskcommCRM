"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface ModelosDoKit {
  agente: string;
  auxiliares: string;
  imagem: string;
  audio: string;
}

interface ModeloCatalogo {
  provider: string;
  model_id: string;
  display_name: string;
  supports_tools: boolean;
  supports_vision: boolean;
  input_price_per_million_cents: number | null;
  output_price_per_million_cents: number | null;
  context_window: number | null;
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
  modelosEfetivos: ModelosDoKit;
  modelosPadrao: ModelosDoKit;
  customizado: boolean;
  bindingsAutomaticos: Array<{ purpose: string; provider: string; modelId: string }>;
  modelos: Array<{ modelId: string; disponivel: boolean }>;
  catalogo: ModeloCatalogo[];
  credenciais: Credencial[];
  podeAplicar: boolean;
  podeEditar: boolean;
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
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [rascunho, setRascunho] = useState<ModelosDoKit | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/ai/providers/recommended-kit");
      const json = (await res.json()) as Envelope<DadosDoKit>;
      if (!res.ok || !json.data) {
        setErro(json.error?.message ?? "não consegui carregar o kit recomendado");
        return;
      }
      setErro(null);
      setDados(json.data);
      setRascunho({ ...json.data.modelosEfetivos });
      setCredentialId((atual) => {
        if (json.data?.credenciais.some((c) => c.id === atual && c.validated_at)) return atual;
        return json.data?.credenciais.find((c) => c.validated_at)?.id ?? "";
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não consegui carregar o kit recomendado");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const modelosIndisponiveis = useMemo(
    () => dados?.modelos.filter((modelo) => !modelo.disponivel).map((modelo) => modelo.modelId) ?? [],
    [dados],
  );

  const catalogoAgente = useMemo(
    () => dados?.catalogo.filter((modelo) => modelo.supports_tools) ?? [],
    [dados],
  );
  const catalogoAuxiliares = dados?.catalogo ?? [];
  const catalogoImagem = useMemo(
    () => dados?.catalogo.filter((modelo) => modelo.supports_vision) ?? [],
    [dados],
  );

  if (erro) {
    return (
      <Card className="mb-6 border-amber-500/30 p-4">
        <p className="text-sm font-medium">Kit recomendado indisponível</p>
        <p className="mt-1 text-xs text-muted-foreground">{erro}</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => void carregar()}>
          Tentar de novo
        </Button>
      </Card>
    );
  }

  if (!dados || !rascunho) return null;

  const credenciaisValidadas = dados.credenciais.filter((c) => c.validated_at !== null);
  const podeExecutar =
    dados.podeAplicar && credentialId !== "" && modelosIndisponiveis.length === 0 && !aplicando;

  async function aplicar() {
    if (!podeExecutar) return;
    const confirmou = window.confirm(
      "Aplicar o Kit recomendado salvo para esta organização? As escolhas explícitas dos pontos compatíveis serão substituídas. " +
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
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui aplicar o kit recomendado");
    } finally {
      setAplicando(false);
    }
  }

  function abrirEdicao() {
    setRascunho({ ...dados.modelosEfetivos });
    setEditando(true);
  }

  function cancelarEdicao() {
    setRascunho({ ...dados.modelosEfetivos });
    setEditando(false);
  }

  async function salvarPreset() {
    if (!dados.podeEditar || salvando) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/v1/ai/providers/recommended-kit", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelos: rascunho }),
      });
      const json = (await res.json()) as Envelope<{ customizado?: boolean; avisos?: string[] }>;
      if (!res.ok) {
        toast.error(json.error?.message ?? "não consegui salvar o preset");
        return;
      }
      for (const aviso of json.data?.avisos ?? []) toast.warning(aviso);
      toast.success(
        json.data?.customizado
          ? "Preset personalizado salvo. Nada foi aplicado ainda."
          : "Preset restaurado para os valores padrão. Nada foi aplicado ainda.",
      );
      setEditando(false);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui salvar o preset");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="mb-6 p-5" data-testid="kit-recomendado">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">{dados.kit.rotulo}</h2>
            <Badge variant="secondary">v{dados.kit.versao}</Badge>
            {dados.customizado && <Badge variant="outline">personalizado</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{dados.kit.descricao}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Você pode manter o kit padrão ou salvar uma combinação própria para esta organização. Salvar
            o preset não muda o atendimento; “Usar kit recomendado” aplica depois os pontos compatíveis.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {dados.podeEditar && !editando && (
            <Button variant="outline" onClick={abrirEdicao} data-testid="editar-kit-recomendado">
              Editar kit
            </Button>
          )}
          <Button
            onClick={() => void aplicar()}
            disabled={!podeExecutar || editando}
            data-testid="aplicar-kit-recomendado"
          >
            {aplicando ? "Aplicando…" : "Usar kit recomendado"}
          </Button>
        </div>
      </div>

      {editando && (
        <div className="mt-4 rounded-lg border bg-muted/20 p-4" data-testid="editor-kit-recomendado">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium">Editar modelos do preset</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Os três primeiros usam o catálogo OpenRouter ativo. O áudio é um ID do transcritor
                OpenAI-compatible separado.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRascunho({ ...dados.modelosPadrao })}
              data-testid="restaurar-modelos-padrao-kit"
            >
              Restaurar valores padrão
            </Button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoModelo
              id="kit-modelo-agente"
              label="Agente principal / CRM"
              value={rascunho.agente}
              onChange={(agente) => setRascunho((r) => (r ? { ...r, agente } : r))}
              options={catalogoAgente}
              listId="kit-catalogo-agente"
              ajuda="Precisa suportar ferramentas. O valor fica salvo no preset, mas a versão do agente continua sendo publicada separadamente."
            />
            <CampoModelo
              id="kit-modelo-auxiliares"
              label="Pontos auxiliares"
              value={rascunho.auxiliares}
              onChange={(auxiliares) => setRascunho((r) => (r ? { ...r, auxiliares } : r))}
              options={catalogoAuxiliares}
              listId="kit-catalogo-auxiliares"
              ajuda="Classificadores, guardrails, memória e demais pontos configuráveis de texto."
            />
            <CampoModelo
              id="kit-modelo-imagem"
              label="Imagem → texto"
              value={rascunho.imagem}
              onChange={(imagem) => setRascunho((r) => (r ? { ...r, imagem } : r))}
              options={catalogoImagem}
              listId="kit-catalogo-imagem"
              ajuda="A lista sugere apenas modelos que o catálogo marca como capazes de ler imagem."
            />
            <div>
              <Label htmlFor="kit-modelo-audio" className="text-xs">
                Áudio → texto
              </Label>
              <Input
                id="kit-modelo-audio"
                value={rascunho.audio}
                onChange={(e) => setRascunho((r) => (r ? { ...r, audio: e.target.value } : r))}
                placeholder="whisper-large-v3-turbo"
                data-testid="kit-modelo-audio"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Recomendação salva para o transcritor separado; aplicar o kit não altera a configuração de áudio atual.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={salvando || Object.values(rascunho).some((v) => v.trim() === "")}
              onClick={() => void salvarPreset()}
              data-testid="salvar-kit-recomendado"
            >
              {salvando ? "Salvando…" : "Salvar preset"}
            </Button>
            <Button size="sm" variant="outline" disabled={salvando} onClick={cancelarEdicao}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <details className="mt-4 rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none font-medium">Ver modelos do kit</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ItemDoKit
            titulo="Agente principal / CRM"
            modelo={dados.kit.agente.rotulo}
            modelId={dados.kit.agente.modelId}
            detalhe="Configurar na versão publicada do agente"
            link="/app/ai/agents"
          />
          <ItemDoKit
            titulo="Pontos auxiliares"
            modelo={dados.kit.auxiliares.rotulo}
            modelId={dados.kit.auxiliares.modelId}
            detalhe={`Aplicação automática em ${dados.bindingsAutomaticos.filter((b) => b.modelId === dados.kit.auxiliares.modelId).length} pontos`}
          />
          <ItemDoKit
            titulo="Imagem → texto"
            modelo={dados.kit.imagem.rotulo}
            modelId={dados.kit.imagem.modelId}
            detalhe="Aplicação automática no ponto de visão"
          />
          <ItemDoKit
            titulo="Áudio → texto"
            modelo={dados.kit.audio.rotulo}
            modelId={dados.kit.audio.modelId}
            detalhe="Recomendação para o transcritor separado; este botão não o altera"
          />
        </div>
      </details>

      <div className="mt-4 max-w-md">
        <Label className="text-xs">Chave OpenRouter usada ao aplicar o kit</Label>
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
          catálogo local. Edite o kit ou sincronize o catálogo.
        </p>
      )}

      {!dados.podeAplicar && (
        <p className="mt-3 text-xs text-muted-foreground">
          Você pode ver o preset, mas só um administrador da organização pode editar ou aplicar.
        </p>
      )}
    </Card>
  );
}

function CampoModelo({
  id,
  label,
  value,
  onChange,
  options,
  listId,
  ajuda,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ModeloCatalogo[];
  listId: string;
  ajuda: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        data-testid={id}
      />
      <datalist id={listId}>
        {options.map((modelo) => (
          <option key={modelo.model_id} value={modelo.model_id}>
            {modelo.display_name}
          </option>
        ))}
      </datalist>
      <p className="mt-1 text-xs text-muted-foreground">{ajuda}</p>
    </div>
  );
}

function ItemDoKit({
  titulo,
  modelo,
  modelId,
  detalhe,
  link,
}: {
  titulo: string;
  modelo: string;
  modelId: string;
  detalhe: string;
  link?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="mt-0.5 text-sm">{modelo}</div>
      {modelId !== modelo && <div className="font-mono text-[11px] text-muted-foreground">{modelId}</div>}
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
