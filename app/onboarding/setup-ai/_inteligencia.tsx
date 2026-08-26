"use client";

import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Cpu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ProvedorSuportado } from "@/lib/ai/pontos/provedores";
import { ROTULOS_DE_RACIOCINIO, type NivelDeRaciocinio } from "@/lib/ai/raciocinio/tipos";
import { TrocarCerebroDialog, type ModeloOption } from "./_trocar-cerebro-dialog";

export interface EstadoDaChave {
  origem: "org" | "nenhuma";
  provedor: string;
  modelo: string;
  raciocinio?: string | null;
  suportaRaciocinio?: boolean;
  rotulo: string;
  final: string | null;
}

type Prova =
  | { estado: "conferindo" }
  | { estado: "ok" }
  | {
      estado: "problema";
      codigo?: string;
      titulo: string;
      mensagem: string;
      acaoSugerida?: string;
    }
  | { estado: "nao_deu" };

interface Props {
  inicial: EstadoDaChave;
  provedores: readonly ProvedorSuportado[];
  modelos: ModeloOption[];
  chavesDaOrg: Record<string, string>; // provider -> last4
}

export function InteligenciaDele({
  inicial,
  provedores,
  modelos,
  chavesDaOrg: chavesIniciais,
}: Props) {
  const [chave, setChave] = useState<EstadoDaChave>(inicial);
  const [chavesDaOrg, setChavesDaOrg] = useState<Record<string, string>>(chavesIniciais);
  const [prova, setProva] = useState<Prova | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const temChave = chave.origem !== "nenhuma";

  const modeloAtualObj = useMemo(() => {
    return modelos.find((m) => m.provider === chave.provedor && m.model_id === chave.modelo);
  }, [modelos, chave.provedor, chave.modelo]);

  const isFreeModel = Boolean(chave.modelo && chave.modelo.toLowerCase().endsWith("-free"));
  const suportaRaciocinio = Boolean(modeloAtualObj?.supports_reasoning ?? chave.suportaRaciocinio);

  const rotuloRaciocinio = useMemo(() => {
    if (!suportaRaciocinio) return null;
    if (!chave.raciocinio || chave.raciocinio === "auto") return "Automático";
    const r = ROTULOS_DE_RACIOCINIO[chave.raciocinio as NivelDeRaciocinio];
    return r ? r.rotulo.split(" (")[0] : chave.raciocinio;
  }, [suportaRaciocinio, chave.raciocinio]);

  const conferirConexao = async () => {
    if (!temChave) return;
    setProva({ estado: "conferindo" });
    try {
      const r = await fetch("/api/v1/system/instalacao?provar=1");
      const corpo = r.ok ? await r.json() : null;
      const p = corpo?.data?.prova as
        | {
            feita: boolean;
            ok?: boolean;
            codigo?: string;
            titulo?: string;
            mensagem?: string;
            acaoSugerida?: string;
          }
        | undefined;

      if (!p || !p.feita) return setProva({ estado: "nao_deu" });
      if (p.ok) return setProva({ estado: "ok" });
      setProva({
        estado: "problema",
        codigo: p.codigo,
        titulo: p.titulo || "Aviso do Provedor",
        mensagem: p.mensagem || "Não foi possível validar o crédito do modelo selecionado.",
        acaoSugerida: p.acaoSugerida,
      });
    } catch {
      setProva({ estado: "nao_deu" });
    }
  };

  useEffect(() => {
    if (!temChave) return;
    void conferirConexao();
  }, [chave.provedor, chave.modelo, temChave]);

  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold leading-none tracking-tight">
              O cérebro dele
            </h3>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {chave.rotulo || chave.provedor}
              </span>
              {chave.final ? (
                <span className="text-xs text-muted-foreground">(final ••••{chave.final})</span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                modelo: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{chave.modelo || "padrão"}</code>
              </span>
              {isFreeModel && (
                <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                  Free
                </Badge>
              )}
              {suportaRaciocinio && (
                <>
                  <span>•</span>
                  <span>
                    raciocínio: <strong className="font-medium text-foreground">{rotuloRaciocinio}</strong>
                  </span>
                </>
              )}
              <span>•</span>
              <Badge variant="outline" className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                {chave.final ? `Chave ativa (••••${chave.final})` : "Chave da empresa ativa"}
              </Badge>
            </div>
          </div>

          <div className="pt-1 text-xs">
            {prova?.estado === "conferindo" && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Conferindo se a chave tem crédito…
              </span>
            )}
            {(prova?.estado === "ok" || prova === null) && (
              <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ✓ conexão funcionando
              </span>
            )}
            {prova?.estado === "nao_deu" && (
              <span className="text-muted-foreground">
                Não foi possível testar o crédito agora.
              </span>
            )}
            {prova?.estado === "problema" && (
              <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <div className="font-semibold text-amber-900 dark:text-amber-200">
                      {prova.titulo}
                    </div>
                    <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                      {prova.mensagem}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={conferirConexao}
                        className="h-6 px-2 text-[11px] bg-background/80 hover:bg-background"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Tentar novamente
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setDialogOpen(true)}
                        className="h-6 px-2 text-[11px]"
                      >
                        Trocar modelo
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="self-start shrink-0"
        >
          Trocar cérebro
        </Button>
      </div>

      <TrocarCerebroDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentProvider={chave.provedor}
        currentModel={chave.modelo}
        currentReasoningEffort={chave.raciocinio}
        provedores={provedores}
        modelos={modelos}
        chavesDaOrg={chavesDaOrg}
        onSuccess={(resultado) => {
          setChave({
            origem: resultado.origem,
            provedor: resultado.provedor,
            modelo: resultado.modelo,
            raciocinio: resultado.raciocinio,
            rotulo: resultado.rotulo,
            final: resultado.final,
          });
          if (resultado.final) {
            setChavesDaOrg((prev) => ({
              ...prev,
              [resultado.provedor]: resultado.final!,
            }));
          }
          setProva({ estado: "conferindo" });
          setTimeout(() => {
            void conferirConexao();
          }, 1000);
        }}
      />
    </section>
  );
}
