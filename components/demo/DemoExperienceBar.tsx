"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { DemoCountry } from "@/lib/demo/types";

interface DemoExperienceBarProps {
  country: DemoCountry;
  expiresAt: string;
  clinicName: string;
}

const MARKET: Record<DemoCountry, { flag: string; label: string }> = {
  CO: { flag: "🇨🇴", label: "Colombia" },
  MX: { flag: "🇲🇽", label: "México" },
  ES: { flag: "🇪🇸", label: "España" },
  PT: { flag: "🇵🇹", label: "Portugal" },
};

const COPY = {
  es: {
    synthetic: "Demo sintética",
    expires: "Expira en",
    expired: "Expirando…",
    explore: "Explora la demo",
    inbox: "Inbox",
    inboxDesc: "Lee una conversación",
    crm: "CRM",
    crmDesc: "Mueve un paciente por el embudo",
    agenda: "Agenda",
    agendaDesc: "Revisa las citas",
    switch: "Cambiar mercado",
    fresh: "Nueva demo",
  },
  pt: {
    synthetic: "Demonstração sintética",
    expires: "Expira em",
    expired: "A expirar…",
    explore: "Explore a demonstração",
    inbox: "Inbox",
    inboxDesc: "Veja uma conversa",
    crm: "CRM",
    crmDesc: "Mova um paciente no funil",
    agenda: "Agenda",
    agendaDesc: "Veja os agendamentos",
    switch: "Mudar mercado",
    fresh: "Nova demonstração",
  },
} as const;

function remainingLabel(expiresAt: string, now: number): string | null {
  const remaining = Date.parse(expiresAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours + "h " + String(minutes).padStart(2, "0") + "m";
}

export function DemoExperienceBar({ country, expiresAt, clinicName }: DemoExperienceBarProps) {
  const pathname = usePathname();
  const [now, setNow] = useState(() => Date.now());
  const market = MARKET[country];
  const copy = country === "PT" ? COPY.pt : COPY.es;
  const remaining = useMemo(() => remainingLabel(expiresAt, now), [expiresAt, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const steps = [
    { href: "/app/inbox", label: copy.inbox, description: copy.inboxDesc },
    { href: "/app/kanban", label: copy.crm, description: copy.crmDesc },
    { href: "/app/agenda", label: copy.agenda, description: copy.agendaDesc },
  ] as const;

  return (
    <div className="border-b bg-accent-soft/60 px-3 py-2 text-sm md:px-5">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden>{market.flag}</span>
          <span className="font-semibold">{copy.synthetic}</span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <span className="hidden max-w-[280px] truncate text-muted-foreground sm:inline">
            {clinicName}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {remaining ? copy.expires + " " + remaining : copy.expired}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="hidden text-xs font-medium text-muted-foreground lg:inline">
            {copy.explore}:
          </span>
          {steps.map((step) => {
            const active = pathname === step.href || pathname.startsWith(step.href + "/");
            return (
              <Link
                key={step.href}
                href={step.href}
                title={step.description}
                className={
                  active
                    ? "rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
                    : "rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium hover:bg-background"
                }
              >
                {step.label}
              </Link>
            );
          })}
          <Link
            href="/demo"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {copy.switch}
          </Link>
          <Link
            href={"/demo?country=" + country}
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {copy.fresh}
          </Link>
        </div>
      </div>
    </div>
  );
}
