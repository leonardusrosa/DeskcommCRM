"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemoRequest } from "@/hooks/useDemoRequest";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import type { DemoCountry } from "@/lib/demo/types";

const COUNTRIES: Array<{ code: DemoCountry; label: string; flag: string }> = [
  { code: "CO", label: "Colombia", flag: "🇨🇴" },
  { code: "MX", label: "México", flag: "🇲🇽" },
  { code: "ES", label: "España", flag: "🇪🇸" },
  { code: "PT", label: "Portugal", flag: "🇵🇹" },
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
  const pt = state.country === "PT";

  if (state.created) {
    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{pt ? "Demonstração preparada" : "Demo preparada"}</CardTitle>
          <CardDescription>
            {pt
              ? `Este ambiente contém apenas dados sintéticos e expira em ${state.created.expiresInHours} horas.`
              : `Este ambiente contiene únicamente datos sintéticos y expira en ${state.created.expiresInHours} horas.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <p><strong>{pt ? "Clínica" : "Clínica"}:</strong> {state.created.clinicName}</p>
            <p><strong>{pt ? "Utilizador" : "Usuario"}:</strong> <code>{state.created.ownerEmail}</code></p>
            <p><strong>{pt ? "Palavra-passe temporária" : "Contraseña temporal"}:</strong> <code>{state.created.password}</code></p>
          </div>
          <Button asChild className="w-full">
            <Link href={state.created.loginUrl}>{pt ? `Abrir ${brandName}` : `Abrir ${brandName}`}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{pt ? "Criar um ambiente dentário de demonstração" : "Crear un entorno dental de demostración"}</CardTitle>
        <CardDescription>
          {pt
            ? "Inbox, CRM e agenda com pacientes e conversas fictícias. Não são utilizados dados de clientes reais."
            : "Inbox, CRM y agenda con pacientes y conversaciones ficticias. No se utilizan datos de clientes reales."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!provisioningEnabled ? (
          <div className="space-y-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p>
              {pt
                ? "O catálogo está disponível para apresentação. A criação automática de ambientes está desativada nesta instalação."
                : "El catálogo está disponible para presentación. La creación automática de entornos está desactivada en esta instalación."}
            </p>
            <p>{pt ? "Um operador só pode ativá-la no ambiente isolado de demonstrações." : "Un operador puede habilitarla únicamente en el entorno de demos aislado."}</p>
          </div>
        ) : (
          <form onSubmit={state.submit} className="space-y-5">
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <div className="space-y-2">
              <Label>{pt ? "País da demonstração" : "País de la demo"}</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COUNTRIES.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => state.setCountry(item.code)}
                    className={
                      state.country === item.code
                        ? "rounded-md border border-accent bg-accent-soft p-3 text-sm font-medium"
                        : "rounded-md border p-3 text-sm hover:bg-muted/50"
                    }
                  >
                    <span className="mr-1">{item.flag}</span>{item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-company">{pt ? "Nome da clínica (opcional)" : "Nombre de la clínica (opcional)"}</Label>
              <Input
                id="demo-company"
                value={state.company}
                onChange={(event) => state.setCompany(event.target.value)}
                placeholder={pt ? "Clínica Dentária Central" : "Clínica Dental Central"}
                maxLength={120}
              />
            </div>
            <Button type="submit" className="w-full" disabled={state.loading}>
              {state.loading ? (pt ? "A preparar ambiente…" : "Preparando ambiente…") : (pt ? "Criar demonstração sintética" : "Crear demo sintética")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
