"use client";

import { ExternalLink, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProvedorSuportado } from "@/lib/ai/pontos/provedores";

interface Props {
  provedorInfo: ProvedorSuportado | undefined;
  temChaveOrg: boolean;
  last4Org: string | null;
  editMode: boolean;
  setEditMode: (val: boolean) => void;
  apiKey: string;
  setApiKey: (val: string) => void;
  baseUrl: string;
  setBaseUrl: (val: string) => void;
  setTesteSucesso: (val: boolean | null) => void;
}

export function TrocarCerebroCredenciais({
  provedorInfo,
  temChaveOrg,
  last4Org,
  editMode,
  setEditMode,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  setTesteSucesso,
}: Props) {
  const nomeProvedor = provedorInfo?.rotulo ?? "Provedor";

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chave de API (BYOK)
        </Label>
        {temChaveOrg && !editMode && (
          <Badge
            variant="outline"
            className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 gap-1"
          >
            <Check className="h-3 w-3" />
            Configurada {last4Org ? `••••${last4Org}` : ""}
          </Badge>
        )}
      </div>

      {temChaveOrg && !editMode ? (
        <div className="flex items-center justify-between pt-1 gap-2">
          <p className="text-xs text-muted-foreground">
            Esta empresa já possui uma chave configurada para {nomeProvedor}.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs shrink-0"
            onClick={() => {
              setEditMode(true);
              setApiKey("");
            }}
          >
            Atualizar chave
          </Button>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="modal_api_key" className="text-xs font-medium">
                Chave de API {temChaveOrg ? "(Nova chave para substituir)" : "(Obrigatória)"}
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
              placeholder={`Cole aqui sua chave da ${nomeProvedor}`}
              autoComplete="off"
            />
          </div>

          {temChaveOrg && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setEditMode(false);
                setApiKey("");
              }}
            >
              ← Manter chave configurada {last4Org ? `(••••${last4Org})` : ""}
            </Button>
          )}

          {provedorInfo?.aceitaEndpointProprio && (
            <div className="space-y-1.5 pt-1">
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
      )}
    </div>
  );
}
