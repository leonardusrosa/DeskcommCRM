"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemoRequest } from "@/hooks/useDemoRequest";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import type { DemoCountry } from "@/lib/demo/types";
import { traduzir } from "@/lib/i18n/dicionario";

const COUNTRIES: Array<{ code: DemoCountry; label: string; flag: string; meta: string }> = [
  { code: "CO", label: "Colombia", flag: "🇨🇴", meta: "COP · Español" },
  { code: "MX", label: "México", flag: "🇲🇽", meta: "MXN · Español" },
  { code: "ES", label: "España", flag: "🇪🇸", meta: "EUR · Español" },
  { code: "PT", label: "Portugal", flag: "🇵🇹", meta: "EUR · Português" },
];

export function DemoRequestForm({
  initialCountry = "CO",
  provisioningEnabled,
}: {
  initialCountry?: DemoCountry;
  provisioningEnabled: boolean;
}) {
  const state = useDemoRequest(initialCountry);
  const { name: brandName } = useMarcaDaInstalacao();
  const idioma = state.country === "PT" ? "pt-PT" : "es";
  const t = (texto: string) => traduzir(texto, idioma);

  if (state.created && !state.created.autoLogin && state.created.fallbackCredentials) {
    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{t("Demonstração preparada")}</CardTitle>
          <CardDescription>
            {t("O acesso automático não pôde ser concluído. Use estas credenciais temporárias para entrar.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <p><strong>{t("Clínica")}:</strong> {state.created.clinicName}</p>
            <p><strong>{t("Usuário")}:</strong> <code>{state.created.fallbackCredentials.ownerEmail}</code></p>
            <p><strong>{t("Senha temporária")}:</strong> <code>{state.created.fallbackCredentials.password}</code></p>
          </div>
          <Button asChild className="w-full">
            <Link href={state.created.launchUrl}>{t("Abrir")} {brandName}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{t("Escolha um mercado e entre na demonstração")}</CardTitle>
        <CardDescription>
          {t("Sem cadastro, sem conectar WhatsApp e sem dados reais. Criamos uma clínica sintética e abrimos o sistema automaticamente.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!provisioningEnabled ? (
          <div className="space-y-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p>{t("O catálogo está disponível para apresentação. A criação automática de ambientes está desativada nesta instalação.")}</p>
            <p>{t("Um operador só pode ativá-la no ambiente isolado de demonstrações.")}</p>
          </div>
        ) : (
          <>
            {state.error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {state.error}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {COUNTRIES.map((item) => {
                const loading = state.loadingCountry === item.code;
                const disabled = state.loadingCountry !== null;
                return (
                  <button
                    key={item.code}
                    type="button"
                    disabled={disabled}
                    onClick={() => void state.launch(item.code)}
                    className="group rounded-lg border p-4 text-left transition hover:border-accent hover:bg-accent-soft disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-3xl" aria-hidden>{item.flag}</span>
                      <span className="text-xs font-medium text-accent">
                        {loading ? t("Preparando…") : "→"}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                  </button>
                );
              })}
            </div>

            {state.loadingCountry && (
              <div className="rounded-lg border bg-muted/20 p-4 text-sm" aria-live="polite">
                <p className="font-medium">{t("Preparando seu ambiente de demonstração…")}</p>
                <div className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-2">
                  <span>✓ {t("Clínica e equipe")}</span>
                  <span>✓ {t("Funil de CRM")}</span>
                  <span>✓ {t("Conversas sintéticas")}</span>
                  <span>✓ {t("Agenda e pacientes fictícios")}</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("Assim que estiver pronto, abriremos")} {brandName} {t("automaticamente.")}
                </p>
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {t("Cada ambiente é isolado, contém somente dados sintéticos e expira automaticamente em 48 horas.")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
