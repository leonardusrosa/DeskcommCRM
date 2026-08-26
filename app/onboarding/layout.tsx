import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { loadOnboardingState } from "@/app/actions/onboarding/_shared";
import { BackButton } from "./_components/BackButton";
import { Stepper } from "./_components/Stepper";
import { SkipToEnd } from "./_components/SkipToEnd";
import { branding } from "@/lib/branding";
import { passosVisiveis } from "@/lib/onboarding/passos";
import { env } from "@/lib/env";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const { state, onboardedAt } = await loadOnboardingState(activeOrg.orgId);
  if (onboardedAt) redirect("/app/inbox");

  // Uma única lista governa ordem, progresso e navegação anterior. Assim, um
  // passo opcional desligado (ex.: Nuvemshop) também some do botão Voltar.
  const passosDoWizard = passosVisiveis({ lojaLigada: env.NUVEMSHOP_ENABLED });
  const passos = passosDoWizard.map((p) => ({
    segmento: p.segmento,
    rotulo: p.rotulo,
    cumprido: p.cumprido(state),
  }));

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{branding().name}</p>
            <h1 className="text-lg font-semibold tracking-tight">{activeOrg.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <BackButton passos={passosDoWizard} />
            {isDev ? <SkipToEnd /> : null}
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-2">
          <Stepper passos={passos} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
