"use client";

import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProvedorSuportado } from "@/lib/ai/pontos/provedores";

interface Props {
  provedorInfo: ProvedorSuportado | undefined;
  temChaveInstalacao: boolean;
  temChaveOrg: boolean;
  temChaveDisponivel: boolean;
  customKeyMode: boolean;
  setCustomKeyMode: (val: boolean) => void;
  apiKey: string;
  setApiKey: (val: string) => void;
  baseUrl: string;
  setBaseUrl: (val: string) => void;
  setTesteSucesso: (val: boolean | null) => void;
}

export function TrocarCerebroCredenciais({
  provedorInfo,
  temChaveInstalacao,
  temChaveOrg,
  temChaveDisponivel,
  customKeyMode,
  setCustomKeyMode,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  setTesteSucesso,
}: Props) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Credencial de Acesso
        </Label>
        {temChaveInstalacao && !customKeyMode && (
          <Badge variant="secondary" className="text-[11px] font-normal">
            Chave da instalação disponível
          </Badge>
        )}
        {temChaveOrg && !customKeyMode && !temChaveInstalacao && (
          <Badge
            variant="outline"
            className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400"
          >
            Chave BYOK salva nesta empresa
          </Badge>
        )}
      </div>

      {temChaveDisponivel && !customKeyMode ? (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">
            {temChaveOrg
              ? "Esta empresa já possui uma chave BYOK configurada para este provedor."
              : "Usando a chave padrão configurada na instalação do Deskcomm."}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary underline-offset-4 hover:underline"
            onClick={() => setCustomKeyMode(true)}
          >
            Usar uma chave de API própria (BYOK)
          </Button>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="modal_api_key" className="text-xs">
                Chave de API {temChaveDisponivel ? "(Substituir)" : "(Obrigatória)"}
              </Label>
              {provedorInfo?.ondePegarAChave && (
                <a
                  href={provedorInfo.ondePegarAChave}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Obter chave <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              id="modal_api_key"
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTesteSucesso(null);
              }}
              placeholder="Cole aqui a sua chave de API"
              autoComplete="off"
            />
          </div>

          {temChaveDisponivel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setCustomKeyMode(false);
                setApiKey("");
              }}
            >
              ← Voltar para chave padrão
            </Button>
          )}
        </div>
      )}

      {provedorInfo?.aceitaEndpointProprio && (
        <div className="space-y-1.5 pt-2">
          <Label htmlFor="modal_base_url" className="text-xs text-muted-foreground">
            Endpoint / Base URL customizada (opcional)
          </Label>
          <Input
            id="modal_base_url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.exemplo.com/v1"
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}
