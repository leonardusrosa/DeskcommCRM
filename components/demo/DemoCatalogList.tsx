"use client";

import Link from "next/link";
import { useDemoCatalog } from "@/hooks/useDemoCatalog";

export function DemoCatalogList() {
  const {
    profiles,
    categories,
    selectedCategory,
    setSelectedCategory,
    loading,
    error,
    refetch,
  } = useDemoCatalog();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Cargando catálogo de ambientes demo…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center max-w-md mx-auto">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => void refetch()}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`text-xs px-4 py-2 rounded-full font-medium transition-colors ${
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Todas las Especialidades
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {profile.category}
                  </span>
                  <h3 className="text-lg font-bold mt-2">{profile.name}</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded border border-border bg-muted font-mono uppercase">
                  {profile.defaultCountry}
                </span>
              </div>

              <p className="text-sm text-foreground font-medium">{profile.tagline}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{profile.description}</p>

              {/* Highlights */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {profile.highlights.map((h) => (
                  <span
                    key={h}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-muted/70 text-muted-foreground"
                  >
                    ✓ {h}
                  </span>
                ))}
              </div>

              {/* Sample Features */}
              <div className="pt-2 border-t border-border/50">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Módulos Incluidos:
                </span>
                <ul className="mt-1 space-y-1 text-xs text-foreground">
                  {profile.sampleFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <span className="text-primary">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href={`/demo?vertical=${profile.vertical}&country=${profile.defaultCountry}`}
                className="block w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm text-center shadow-sm hover:bg-primary/90 transition-colors"
              >
                Solicitar este Entorno Demo →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
