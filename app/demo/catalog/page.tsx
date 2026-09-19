import type { Metadata } from "next";
import Link from "next/link";
import { DemoCatalogList } from "@/components/demo/DemoCatalogList";
import { branding } from "@/lib/branding";

export function generateMetadata(): Metadata {
  const { name } = branding();
  return {
    title: "Demos dentales por país",
    description: `Entornos sintéticos de ${name} para clínicas dentales en Colombia, México, España y Portugal.`,
  };
}

export default function DemoCatalogPage() {
  const { name: brandName } = branding();
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-10 px-5 py-12 md:px-8">
      <header className="max-w-3xl space-y-4">
        <Link href="/demo" className="text-sm text-accent hover:underline">← Demo {brandName}</Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Dental vertical</p>
        <h1 className="text-4xl font-bold tracking-tight">El mismo {brandName}, preparado para cada mercado</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Cada entorno usa únicamente datos sintéticos y enseña el flujo MVP real:
          recepción por WhatsApp, contactos, seguimiento comercial y agenda multi-profesional.
          No incluye módulos clínicos ni integraciones PMS simuladas.
        </p>
      </header>
      <DemoCatalogList />
    </main>
  );
}
