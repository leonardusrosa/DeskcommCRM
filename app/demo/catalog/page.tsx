import type { Metadata } from "next";
import Link from "next/link";
import { DemoCatalogList } from "@/components/demo/DemoCatalogList";

export const metadata: Metadata = {
  title: "Demos dentales por país — Deskcomm",
  description: "Entornos sintéticos de Deskcomm para clínicas dentales en Colombia, México, España y Portugal.",
};

export default function DemoCatalogPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-10 px-5 py-12 md:px-8">
      <header className="max-w-3xl space-y-4">
        <Link href="/demo" className="text-sm text-accent hover:underline">← Demo Deskcomm</Link>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Dental vertical</p>
        <h1 className="text-4xl font-bold tracking-tight">El mismo Deskcomm, preparado para cada mercado</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Cada entorno usa únicamente datos sintéticos y enseña el flujo MVP real:
          recepción por WhatsApp, contactos, pipeline comercial y agenda multi-profesional.
          No incluye historia clínica, odontogramas ni integraciones PMS simuladas.
        </p>
      </header>
      <DemoCatalogList />
    </main>
  );
}
