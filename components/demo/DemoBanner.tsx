"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function remainingLabel(expiresAt: string): string {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function DemoBanner({
  country,
  expiresAt,
}: {
  country: string;
  expiresAt: string;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = useMemo(() => remainingLabel(expiresAt), [expiresAt, tick]);

  return (
    <div className="border-b border-accent/20 bg-accent-soft px-4 py-2 text-xs text-foreground">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold">Synthetic Demo · {country}</span>
        <span className="text-muted-foreground">Fictional data · expires in {remaining}</span>
        <nav className="ml-auto flex flex-wrap items-center gap-3 font-medium">
          <Link href="/app/inbox" className="hover:text-accent">Inbox</Link>
          <Link href="/app/crm" className="hover:text-accent">CRM</Link>
          <Link href="/app/agenda" className="hover:text-accent">Agenda</Link>
          <Link href="/demo" className="text-accent hover:underline">Switch market</Link>
        </nav>
      </div>
    </div>
  );
}
