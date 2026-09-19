"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemoCatalog } from "@/hooks/useDemoCatalog";

export function DemoCatalogList() {
  const { profiles, loading, error, reload } = useDemoCatalog();

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Cargando demos dentales…</div>;
  }

  if (error) {
    return (
      <div className="py-16 text-center text-sm">
        <p className="text-destructive">{error}</p>
        <button type="button" onClick={() => void reload()} className="mt-3 underline">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {profiles.map((profile) => (
        <Card key={profile.country} className="flex h-full flex-col">
          <CardHeader>
            <div className="mb-2 text-2xl" aria-hidden>{profile.flag}</div>
            <CardTitle>{profile.title}</CardTitle>
            <CardDescription>{profile.tagline}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{profile.description}</p>
            <div className="flex flex-wrap gap-2">
              {profile.highlights.map((item) => (
                <span key={item} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {item}
                </span>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Incluido en la demo
              </p>
              <ul className="space-y-1 text-sm">
                {profile.included.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <Link
              href={`/demo?country=${profile.country}`}
              className="mt-auto inline-flex h-11 items-center justify-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
            >
              Ver esta demo
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
