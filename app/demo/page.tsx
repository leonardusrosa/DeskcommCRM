import type { Metadata } from "next";
import Link from "next/link";
import { DemoRequestForm } from "@/components/demo/DemoRequestForm";
import { demoProvisioningEnabled } from "@/lib/demo/safety";
import type { DemoCountry } from "@/lib/demo/types";

export const metadata: Metadata = {
  title: "Demo dental — Deskcomm",
  description: "Prueba Deskcomm con un entorno dental sintético localizado para Colombia, México, España o Portugal.",
};

const VALID_COUNTRIES = new Set<DemoCountry>(["CO", "MX", "ES", "PT"]);

export default async function DemoPage({
  searchParams,
}: {
  searchParams?: Promise<{ country?: string }>;
}) {
  const params = await searchParams;
  const candidate = (params?.country || "CO").toUpperCase() as DemoCountry;
  const country = VALID_COUNTRIES.has(candidate) ? candidate : "CO";

  return (
    <main className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-2 lg:px-8">
        <section className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Demo dental sintética
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Mira cómo funciona Deskcomm en la recepción de una clínica dental
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Recorre conversaciones ficticias de WhatsApp, pacientes sintéticos, oportunidades
            comerciales y una agenda con varios profesionales. La demo muestra funciones reales
            del MVP sin afirmar integraciones o módulos clínicos que Deskcomm no ofrece.
          </p>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md border p-4"><strong>Inbox</strong><br />Conversaciones sintéticas de recepción</div>
            <div className="rounded-md border p-4"><strong>CRM</strong><br />Pipeline de tratamientos y seguimiento</div>
            <div className="rounded-md border p-4"><strong>Agenda</strong><br />Servicios, especialistas y citas</div>
            <div className="rounded-md border p-4"><strong>Mercado</strong><br />CO, MX, ES y PT localizados</div>
          </div>
          <Link href="/demo/catalog" className="inline-flex text-sm font-medium text-accent hover:underline">
            Comparar los cuatro entornos →
          </Link>
        </section>
        <DemoRequestForm initialCountry={country} provisioningEnabled={demoProvisioningEnabled()} />
      </div>
    </main>
  );
}
