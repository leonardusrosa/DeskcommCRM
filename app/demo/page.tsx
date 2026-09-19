import type { Metadata } from "next";
import Link from "next/link";
import { DemoRequestForm } from "@/components/demo/DemoRequestForm";
import { demoProvisioningEnabled } from "@/lib/demo/safety";
import { branding } from "@/lib/branding";
import type { DemoCountry } from "@/lib/demo/types";
import { traduzir } from "@/lib/i18n/dicionario";

export function generateMetadata(): Metadata {
  const { name } = branding();
  return {
    title: "Demo dental",
    description: `Prueba ${name} con un entorno dental sintético localizado para Colombia, México, España o Portugal.`,
  };
}

const VALID_COUNTRIES = new Set<DemoCountry>(["CO", "MX", "ES", "PT"]);

export default async function DemoPage({
  searchParams,
}: {
  searchParams?: Promise<{ country?: string }>;
}) {
  const params = await searchParams;
  const candidate = (params?.country || "CO").toUpperCase() as DemoCountry;
  const country = VALID_COUNTRIES.has(candidate) ? candidate : "CO";
  const idioma = country === "PT" ? "pt-PT" : "es";
  const t = (texto: string) => traduzir(texto, idioma);
  const { name: brandName } = branding();

  return (
    <main className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-2 lg:px-8">
        <section className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {t("Demonstração dentária sintética")}
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {t("Veja como o")} {brandName} {t("funciona na recepção de uma clínica dentária")}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t("Explore conversas fictícias de WhatsApp, pacientes sintéticos, oportunidades comerciais e uma agenda com vários profissionais. A demonstração mostra funções reais do MVP sem sugerir integrações ou módulos clínicos que a plataforma não oferece.")}
          </p>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md border p-4"><strong>Inbox</strong><br />{t("Conversas sintéticas de recepção")}</div>
            <div className="rounded-md border p-4"><strong>CRM</strong><br />{t("Funil de tratamentos e acompanhamento")}</div>
            <div className="rounded-md border p-4"><strong>Agenda</strong><br />{t("Serviços, especialistas e agendamentos")}</div>
            <div className="rounded-md border p-4"><strong>{t("Mercado")}</strong><br />{t("CO, MX, ES e PT localizados")}</div>
          </div>
          <Link href="/demo/catalog" className="inline-flex text-sm font-medium text-accent hover:underline">
            {t("Comparar os quatro ambientes →")}
          </Link>
        </section>
        <DemoRequestForm initialCountry={country} provisioningEnabled={demoProvisioningEnabled()} />
      </div>
    </main>
  );
}
