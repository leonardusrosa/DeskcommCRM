"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { traduzir } from "@/lib/i18n/dicionario";

interface DemoContext {
  country: string;
  expiresAt: string;
}

function remainingLabel(expiresAt: string): string {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function DemoBanner() {
  const [context, setContext] = useState<DemoContext | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("synthetic_demo_context");
      if (raw) setContext(JSON.parse(raw) as DemoContext);
    } catch {
      window.sessionStorage.removeItem("synthetic_demo_context");
    }

    const id = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = context ? remainingLabel(context.expiresAt) : "";
  void tick;

  if (!context) return null;

  const idioma = context.country === "PT" ? "pt-PT" : "es";
  const t = (texto: string) => traduzir(texto, idioma);
  const restartTour = () => {
    window.sessionStorage.setItem(
      "synthetic_demo_tour_state",
      JSON.stringify({ status: "active", step: 0 }),
    );
    window.location.assign("/app/inbox");
  };

  return (
    <div className="border-b border-accent/20 bg-accent-soft px-4 py-2 text-xs text-foreground">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold">Synthetic Demo · {context.country}</span>
        <span className="text-muted-foreground">Fictional data · expires in {remaining}</span>
        <nav className="ml-auto flex flex-wrap items-center gap-3 font-medium">
          <Link href="/app/inbox" className="hover:text-accent">Inbox</Link>
          <Link href="/app/crm" className="hover:text-accent">CRM</Link>
          <Link href="/app/agenda" className="hover:text-accent">Agenda</Link>
          <button type="button" onClick={restartTour} className="hover:text-accent">
            {t("Reiniciar visita guiada")}
          </button>
          <Link href="/demo" className="text-accent hover:underline">Switch market</Link>
        </nav>
      </div>
    </div>
  );
}
