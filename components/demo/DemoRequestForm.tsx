"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemoRequest } from "@/hooks/useDemoRequest";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import type { DemoCountry } from "@/lib/demo/types";

const COUNTRIES: Array<{
  code: DemoCountry;
  label: string;
  flag: string;
  detail: string;
}> = [
  { code: "CO", label: "Colombia", flag: "🇨🇴", detail: "Español · COP · Bogotá" },
  { code: "MX", label: "México", flag: "🇲🇽", detail: "Español · MXN · Ciudad de México" },
  { code: "ES", label: "España", flag: "🇪🇸", detail: "Español · EUR · Madrid" },
  { code: "PT", label: "Portugal", flag: "🇵🇹", detail: "Português · EUR · Lisboa" },
];

const COPY = {
  es: {
    title: "Elige un mercado",
    description:
      "Entra directamente en una clínica dental sintética ya poblada. Sin registro y sin conectar WhatsApp.",
    button: "Abrir demo",
    preparing: "Preparando tu espacio de demostración…",
    preparingDescription: "Estamos creando una clínica aislada con datos ficticios.",
    clinic: "Clínica y equipo",
    crm: "Pipeline y contactos",
    inbox: "Conversaciones",
    agenda: "Agenda",
    opening: "Abriendo Deskcomm…",
    synthetic: "Solo datos sintéticos · expira automáticamente en 48 h",
  },
  pt: {
    title: "Escolha um mercado",
    description:
      "Entre diretamente numa clínica dentária sintética já preenchida. Sem registo e sem ligar o WhatsApp.",
    button: "Abrir demonstração",
    preparing: "A preparar o seu ambiente de demonstração…",
    preparingDescription: "Estamos a criar uma clínica isolada com dados fictícios.",
    clinic: "Clínica e equipa",
    crm: "Funil e contactos",
    inbox: "Conversas",
    agenda: "Agenda",
    opening: "A abrir o Deskcomm…",
    synthetic: "Apenas dados sintéticos · expira automaticamente em 48 h",
  },
} as const;

export function DemoRequestForm({
  initialCountry = "CO",
  provisioningEnabled,
}: {
  initialCountry?: DemoCountry;
  provisioningEnabled: boolean;
}) {
  const state = useDemoRequest(initialCountry);
  const { name: brandName } = useMarcaDaInstalacao();
  const copy = state.country === "PT" ? COPY.pt : COPY.es;
  const selected = COUNTRIES.find((item) => item.code === state.country)!;

  if (state.loading) {
    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{copy.preparing}</CardTitle>
          <CardDescription>{copy.preparingDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-md border bg-muted/20 p-4 text-sm">
            {[copy.clinic, copy.crm, copy.inbox, copy.agenda].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span aria-hidden className="text-accent">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-sm font-medium text-muted-foreground">{copy.opening}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!provisioningEnabled ? (
          <div className="space-y-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p>Demo provisioning is disabled on this installation.</p>
          </div>
        ) : (
          <form onSubmit={state.submit} className="space-y-5">
            {state.error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {COUNTRIES.map((item) => {
                const active = state.country === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => state.setCountry(item.code)}
                    className={
                      active
                        ? "rounded-md border border-accent bg-accent-soft p-4 text-left ring-1 ring-accent"
                        : "rounded-md border p-4 text-left transition-colors hover:bg-muted/50"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>{item.flag}</span>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </button>
                );
              })}
            </div>

            <Button type="submit" className="h-12 w-full">
              {copy.button}: {selected.flag} {selected.label}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {copy.synthetic} · {brandName}
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
