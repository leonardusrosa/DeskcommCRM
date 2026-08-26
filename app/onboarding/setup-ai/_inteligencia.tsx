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
  | { estado: "problema"; mensagem: string }
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
        | { feita: boolean; ok?: boolean; mensagem?: string; aindaVerificando?: boolean }
        | undefined;

      if (!p || !p.feita) return setProva({ estado: "nao_deu" });
      if (p.ok) return setProva({ estado: "ok" });
      setProva({ estado: "problema", mensagem: p.mensagem ?? "" });
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
        <div className="space-y-2">
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

          <div className="flex items-center gap-1.5 pt-1 text-xs">
            {prova?.estado === "conferindo" && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Conferindo se a chave tem crédito…
              </span>
            )}
            {(prova?.estado === "ok" || prova === null) && (
              <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ✓ conexão funcionando
              </span>
            )}
            {prova?.estado === "problema" && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                Aviso: {prova.mensagem}
              </span>
            )}
            {prova?.estado === "nao_deu" && (
              <span className="text-muted-foreground">
                Não foi possível testar o crédito agora.
              </span>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="self-start"
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
