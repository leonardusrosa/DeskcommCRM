import type { Metadata } from "next";
import Link from "next/link";
import { DemoCatalogList } from "@/components/demo/DemoCatalogList";
import { branding } from "@/lib/branding";
import { traduzir } from "@/lib/i18n/dicionario";
import type { DemoCountry } from "@/lib/demo/types";

export function generateMetadata(): Metadata {
  const { name } = branding();
  return {
    title: "Demos dentales por país",
    description: `Entornos sintéticos de ${name} para clínicas dentales en Colombia, México, España y Portugal.`,
  };
}

export default async function DemoCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<{ country?: string }>;
}) {
  const params = await searchParams;
  const candidate = (params?.country || "").toUpperCase() as DemoCountry;
  const idioma = candidate === "PT" ? "pt-PT" : "es";
  const t = (texto: string) => traduzir(texto, idioma);
  const { name: brandName } = branding();

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-10 px-5 py-12 md:px-8">
      <header className="max-w-3xl space-y-4">
        <Link href="/demo" className="text-sm text-accent hover:underline">← {t("Voltar para demo")}</Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Dental vertical</p>
        <h1 className="text-4xl font-bold tracking-tight">
          {t("O mesmo")} {brandName}, {t("preparado para cada mercado")}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {t("Cada ambiente usa apenas dados sintéticos e mostra o fluxo MVP real: recepção por WhatsApp, contatos, acompanhamento comercial e agenda multi-profissional. Não inclui módulos clínicos nem integrações PMS simuladas.")}
        </p>
      </header>
      <DemoCatalogList />
    </main>
  );
}
