"use client";

import * as React from "react";
import { Brain, Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROTULOS_DE_RACIOCINIO,
  type NivelDeRaciocinio,
} from "@/lib/ai/raciocinio/tipos";

interface TrocarCerebroRaciocinioProps {
  supportsReasoning: boolean;
  supportedEfforts: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function TrocarCerebroRaciocinio({
  supportsReasoning,
  supportedEfforts,
  value,
  onChange,
  disabled = false,
}: TrocarCerebroRaciocinioProps) {
  if (!supportsReasoning || supportedEfforts.length === 0) {
    return null;
  }

  const selectedValue = value || "auto";
  const currentEffort = value as NivelDeRaciocinio | null;
  const showCostHint = currentEffort && ROTULOS_DE_RACIOCINIO[currentEffort]?.aumentaConsumo;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <Label htmlFor="select-reasoning-effort" className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
          Esforço de raciocínio
        </Label>
        <span className="text-[11px] text-muted-foreground">
          {selectedValue === "auto" ? "Automático" : (ROTULOS_DE_RACIOCINIO[currentEffort!]?.rotulo ?? selectedValue)}
        </span>
      </div>

      <Select
        value={selectedValue}
        onValueChange={(val) => onChange(val === "auto" ? null : val)}
        disabled={disabled}
      >
        <SelectTrigger id="select-reasoning-effort" className="h-9 text-xs bg-background">
          <SelectValue placeholder="Escolha o esforço de raciocínio" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto" className="text-xs">
            <div className="flex flex-col text-left">
              <span className="font-medium">Automático (Padrão)</span>
              <span className="text-[11px] text-muted-foreground">
                Usa o comportamento de raciocínio padrão do modelo
              </span>
            </div>
          </SelectItem>

          {supportedEfforts.map((effortKey) => {
            const rotuloInfo = ROTULOS_DE_RACIOCINIO[effortKey as NivelDeRaciocinio];
            const nomeExibicao = rotuloInfo?.rotulo ?? effortKey;
            const descExibicao = rotuloInfo?.descricao ?? "";

            return (
              <SelectItem key={effortKey} value={effortKey} className="text-xs">
                <div className="flex flex-col text-left">
                  <span className="font-medium">{nomeExibicao}</span>
                  {descExibicao && (
                    <span className="text-[11px] text-muted-foreground">
                      {descExibicao}
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {showCostHint && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/90 pl-0.5">
          <Info className="h-3 w-3 text-muted-foreground shrink-0" />
          <span>Mais raciocínio pode aumentar latência e consumo de tokens.</span>
        </p>
      )}
    </div>
  );
}
