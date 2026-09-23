"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { traduzir } from "@/lib/i18n/dicionario";

const DEMO_CONTEXT_KEY = "synthetic_demo_context";
const DEMO_TOUR_KEY = "synthetic_demo_tour_state";

interface DemoContext {
  country: string;
}

interface TourState {
  status: "active" | "completed" | "skipped";
  step: number;
}

interface TourStep {
  route: string;
  title: string;
  body: string;
  action: string;
}

function clampStep(step: number, total: number): number {
  return Math.min(Math.max(step, 0), Math.max(total - 1, 0));
}

export function DemoTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [context, setContext] = useState<DemoContext | null>(null);
  const [tourState, setTourState] = useState<TourState | null>(null);

  const idioma = context?.country === "PT" ? "pt-PT" : "es";
  const t = (texto: string) => traduzir(texto, idioma);

  const steps: TourStep[] = [
      {
        route: "/app/inbox",
        title: t("Inbox da clínica"),
        body: t("Abra uma conversa fictícia e veja como a equipe atende pelo WhatsApp."),
        action: t("Abrir Inbox"),
      },
      {
        route: "/app/crm",
        title: t("Funil de tratamentos"),
        body: t("Acompanhe as oportunidades e veja como os pacientes avançam pelo CRM."),
        action: t("Abrir CRM"),
      },
      {
        route: "/app/agenda",
        title: t("Agenda da equipe"),
        body: t("Veja os agendamentos sintéticos distribuídos entre os profissionais da clínica."),
        action: t("Abrir Agenda"),
      },
      {
        route: "/app/team",
        title: t("Equipe da clínica"),
        body: t("Conheça os operadores sintéticos e como o atendimento é dividido entre funções."),
        action: t("Abrir Equipe"),
      },
  ];

  useEffect(() => {
    try {
      const rawContext = window.sessionStorage.getItem(DEMO_CONTEXT_KEY);
      if (!rawContext) return;

      const parsedContext = JSON.parse(rawContext) as DemoContext;
      setContext(parsedContext);

      const rawTour = window.sessionStorage.getItem(DEMO_TOUR_KEY);
      if (!rawTour) {
        const initial: TourState = { status: "active", step: 0 };
        window.sessionStorage.setItem(DEMO_TOUR_KEY, JSON.stringify(initial));
        setTourState(initial);
        return;
      }

      const parsedTour = JSON.parse(rawTour) as TourState;
      setTourState(parsedTour);
    } catch {
      window.sessionStorage.removeItem(DEMO_TOUR_KEY);
    }
  }, []);

  const persist = (next: TourState) => {
    window.sessionStorage.setItem(DEMO_TOUR_KEY, JSON.stringify(next));
    setTourState(next);
  };

  if (!context || !tourState || tourState.status !== "active") return null;

  const stepIndex = clampStep(tourState.step, steps.length);
  const step = steps[stepIndex]!;
  const onTargetRoute = pathname === step.route || pathname.startsWith(`${step.route}/`);
  const isLast = stepIndex === steps.length - 1;

  const goNext = () => {
    if (!onTargetRoute) {
      router.push(step.route);
      return;
    }

    if (isLast) {
      persist({ status: "completed", step: stepIndex });
      return;
    }

    const nextIndex = stepIndex + 1;
    persist({ status: "active", step: nextIndex });
    router.push(steps[nextIndex]!.route);
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    const previousIndex = stepIndex - 1;
    persist({ status: "active", step: previousIndex });
    router.push(steps[previousIndex]!.route);
  };

  const skip = () => {
    persist({ status: "skipped", step: stepIndex });
  };

  return (
    <aside
      className="fixed bottom-4 right-4 z-[60] w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-background p-4 shadow-lg"
      aria-label={t("Tour da demonstração")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            {t("Tour da demonstração")} · {stepIndex + 1}/{steps.length}
          </p>
          <h2 className="mt-2 text-base font-semibold">{step.title}</h2>
        </div>
        <button
          type="button"
          onClick={skip}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("Pular tour")}
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goBack}
          disabled={stepIndex === 0}
        >
          {t("Voltar")}
        </Button>
        <Button type="button" size="sm" onClick={goNext}>
          {!onTargetRoute
            ? step.action
            : isLast
              ? t("Explorar livremente")
              : t("Próximo")}
        </Button>
      </div>
    </aside>
  );
}
