"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { hrefAnteriorOnboarding } from "@/lib/onboarding/anterior";
import type { PassoDoOnboarding } from "@/lib/onboarding/passos";

export function BackButton({ passos }: { passos: readonly PassoDoOnboarding[] }) {
  const pathname = usePathname();
  const href = hrefAnteriorOnboarding(pathname, passos);

  if (!href) return null;

  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href} aria-label="Voltar para a etapa anterior">
        ← Voltar
      </Link>
    </Button>
  );
}
