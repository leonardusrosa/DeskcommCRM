"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ProvedorSuportado } from "@/lib/ai/pontos/provedores";
import { salvarConfiguracaoIa } from "@/app/actions/onboarding/salvarConfiguracaoIa";
import { testarConexaoIa } from "@/app/actions/onboarding/testarConexaoIa";
import { TrocarCerebroCredenciais } from "./_trocar-cerebro-credenciais";
import { TrocarCerebroRaciocinio } from "./_trocar-cerebro-raciocinio";

export interface ModeloOption {
  provider: string;
  model_id: string;
  display_name: string;
  supports_tools: boolean;
  supports_vision: boolean;
  supports_reasoning?: boolean;
  reasoning_efforts_supported?: string[];
  reasoning_effort_default?: string | null;
  input_price_per_million_cents: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProvider: string;
  currentModel: string;
  currentReasoningEffort?: string | null;
  currentOrigem: "org" | "instalacao" | "nenhuma";
  provedores: readonly ProvedorSuportado[];
  modelos: ModeloOption[];
  chavesDeInstalacao: string[];
  chavesDaOrg: string[];
  onSuccess: (res: {
    provedor: string;
    modelo: string;
    raciocinio: string | null;
    origem: "org" | "instalacao";
    rotulo: string;
    final: string | null;
  }) => void;
}

export function TrocarCerebroDialog({
  open,
  onOpenChange,
  currentProvider,
  currentModel,
  currentReasoningEffort = null,
  provedores,
  modelos,
  chavesDeInstalacao,
  chavesDaOrg,
  onSuccess,
}: Props) {
  const [selectedProvider, setSelectedProvider] = useState(currentProvider);
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [reasoningEffort, setReasoningEffort] = useState<string | null>(currentReasoningEffort);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [customKeyMode, setCustomKeyMode] = useState(false);
  const [testando, setTestando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [testeSucesso, setTesteSucesso] = useState<boolean | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedProvider(currentProvider);
      setSelectedModel(currentModel);
      setReasoningEffort(currentReasoningEffort ?? null);
      setApiKey("");
      setBaseUrl("");
      setCustomKeyMode(false);
      setTesteSucesso(null);
    }
  }, [open, currentProvider, currentModel, currentReasoningEffort]);

  const provedorInfo = useMemo(() => {
    return provedores.find((p) => p.id === selectedProvider) ?? provedores[0];
  }, [provedores, selectedProvider]);

  const modelosDoProvedor = useMemo(() => {
    return modelos.filter((m) => m.provider === selectedProvider);
  }, [modelos, selectedProvider]);

  const modeloSelecionadoObj = useMemo(() => {
    return modelosDoProvedor.find((m) => m.model_id === selectedModel);
  }, [modelosDoProvedor, selectedModel]);

  useEffect(() => {
    if (!modelosDoProvedor.some((m) => m.model_id === selectedModel)) {
      if (modelosDoProvedor[0]) setSelectedModel(modelosDoProvedor[0].model_id);
    }
  }, [selectedProvider, modelosDoProvedor, selectedModel]);

  useEffect(() => {
    if (modeloSelecionadoObj) {
      if (!modeloSelecionadoObj.supports_reasoning) {
        setReasoningEffort(null);
      } else if (
        reasoningEffort &&
        !modeloSelecionadoObj.reasoning_efforts_supported?.includes(reasoningEffort)
      ) {
        setReasoningEffort(null);
      }
    }
  }, [modeloSelecionadoObj, reasoningEffort]);

  const temChaveDisponivel = chavesDeInstalacao.includes(selectedProvider) || chavesDaOrg.includes(selectedProvider);

  const handleTestar = async () => {
    setTestando(true);
    setTesteSucesso(null);
    try {
      const res = await testarConexaoIa({
        provider: selectedProvider,
        model_id: selectedModel,
        reasoning_effort: reasoningEffort,
        api_key: apiKey.trim() || undefined,
        base_url: baseUrl.trim() || undefined,
      });
      if (res.ok) {
        setTesteSucesso(true);
        toast.success("Conexão testada com sucesso!");
      } else {
        setTesteSucesso(false);
        toast.error(res.erro);
      }
    } catch {
      setTesteSucesso(false);
      toast.error("Erro ao testar conexão.");
    } finally {
      setTestando(false);
    }
  };

  const handleSalvar = async () => {
    if (!temChaveDisponivel && apiKey.trim().length < 8) {
      toast.error("Por favor, insira uma chave de API válida para este provedor.");
      return;
    }

    setSalvando(true);
    try {
      const res = await salvarConfiguracaoIa({
        provider: selectedProvider,
        model_id: selectedModel,
        reasoning_effort: reasoningEffort,
        api_key: apiKey.trim() || undefined,
        base_url: baseUrl.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.erro);
        return;
      }

      toast.success(`Cérebro atualizado para ${res.rotulo} (${res.modelo})!`);
      onSuccess(res);
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar configuração.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Trocar cérebro do atendente
          </DialogTitle>
          <DialogDescription>
            Escolha o provedor de IA e o modelo que governará o raciocínio deste atendente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="modal_provider_select">Provedor de IA</Label>
            <select
              id="modal_provider_select"
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setTesteSucesso(null);
              }}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {provedores.map((p) => (
                <option key={p.id} value={p.id}>{p.rotulo}</option>
              ))}
            </select>
            {provedorInfo && <p className="mt-1 text-xs text-muted-foreground">{provedorInfo.quandoUsar}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="modal_model_select">Modelo do Provedor</Label>
            {modelosDoProvedor.length > 0 ? (
              <select
                id="modal_model_select"
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setTesteSucesso(null);
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {modelosDoProvedor.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.display_name || m.model_id}{m.supports_tools ? " (Tools ✓)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="modal_model_select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder="Identificador do modelo (ex: deepseek-v4-flash)"
              />
            )}
          </div>

          <TrocarCerebroRaciocinio
            supportsReasoning={Boolean(modeloSelecionadoObj?.supports_reasoning)}
            supportedEfforts={modeloSelecionadoObj?.reasoning_efforts_supported ?? []}
            value={reasoningEffort}
            onChange={setReasoningEffort}
            disabled={salvando || testando}
          />

          <TrocarCerebroCredenciais
            provedorInfo={provedorInfo}
            temChaveInstalacao={chavesDeInstalacao.includes(selectedProvider)}
            temChaveOrg={chavesDaOrg.includes(selectedProvider)}
            temChaveDisponivel={temChaveDisponivel}
            customKeyMode={customKeyMode}
            setCustomKeyMode={setCustomKeyMode}
            apiKey={apiKey}
            setApiKey={setApiKey}
            baseUrl={baseUrl}
            setBaseUrl={setBaseUrl}
            setTesteSucesso={setTesteSucesso}
          />
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testando || salvando}
            onClick={handleTestar}
            className="gap-1.5"
          >
            {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : testeSucesso === true ? <Check className="h-4 w-4 text-emerald-600" /> : null}
            Testar conexão
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={salvando} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={salvando || (!temChaveDisponivel && apiKey.trim().length < 8)}
              onClick={handleSalvar}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
