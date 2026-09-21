"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import {
  renderGoogleReviewMessage,
  type CommercialFeatures,
} from "@/lib/crm/commercial-features";

export function CommercialFeaturesForm({ initial }: { initial: CommercialFeatures }) {
  const [form, setForm] = useState<CommercialFeatures>(initial);
  const [saved, setSaved] = useState<CommercialFeatures>(initial);
  const [isPending, startTransition] = useTransition();

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const reviewPreview = renderGoogleReviewMessage(form);

  function save() {
    startTransition(async () => {
      try {
        const response = await apiClient.patch<{ data: CommercialFeatures }>(
          "/api/v1/settings/commercial-features",
          form,
        );
        const next = response.data;
        setForm(next);
        setSaved(next);
        toast.success("Recursos comerciais salvos.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não consegui salvar os recursos comerciais.");
      }
    });
  }

  return (
    <section className="max-w-3xl space-y-4 border-t pt-6" aria-labelledby="recursos-comerciais">
      <div>
        <h2 id="recursos-comerciais" className="text-lg font-semibold">
          Recursos comerciais
        </h2>
        <p className="text-sm text-muted-foreground">
          Reputação, assistência ao vendedor e regras do agendamento nativo. Credenciais externas não ficam aqui.
        </p>
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Google Review Lite</h3>
            <p className="text-xs text-muted-foreground">
              Prepara um pedido de avaliação com o link direto do Google. O atendente revisa antes de enviar;
              não há filtro por satisfação nem texto de avaliação escrito pela IA.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={form.google_review.enabled}
              disabled={isPending}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  google_review: { ...current.google_review, enabled: e.target.checked },
                }))
              }
            />
            Ativo
          </label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="google-review-url">Link direto de avaliação</Label>
          <Input
            id="google-review-url"
            type="url"
            placeholder="https://g.page/r/.../review"
            value={form.google_review.review_url}
            disabled={isPending}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                google_review: { ...current.google_review, review_url: e.target.value },
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Use o link que abre diretamente a tela de avaliação do perfil da empresa.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="google-review-message">Mensagem</Label>
          <textarea
            id="google-review-message"
            rows={9}
            value={form.google_review.message_template}
            disabled={isPending}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                google_review: { ...current.google_review, message_template: e.target.value },
              }))
            }
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Use <code>{"{{google_review_url}}"}</code> onde o link deve aparecer.
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-1 text-xs font-medium">Prévia para o atendente</div>
          <div className="whitespace-pre-wrap text-xs text-muted-foreground">{reviewPreview}</div>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">CRM AI Copilot</h3>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              read-only
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            O primeiro recurso já existe no Inbox: a IA sugere uma resposta usando o agente publicado e o contexto
            do cliente, mas não envia nem altera o CRM. A expansão vai acrescentar resumo, próximo passo e consultas
            ao CRM mantendo revisão humana antes de qualquer mutação.
          </p>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Agendamento nativo</h3>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Google Calendar
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            O CRM será a interface de agendamento e o Google Calendar será a fonte de disponibilidade/eventos.
            Estes campos já definem as regras do booking; conectar a conta Google e consultar horários livres entra
            na etapa OAuth, sem Cal.com no v1.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="booking-duration">Duração padrão (min)</Label>
            <Input
              id="booking-duration"
              type="number"
              min={10}
              max={240}
              value={form.booking.slot_duration_minutes}
              disabled={isPending}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  booking: { ...current.booking, slot_duration_minutes: Number(e.target.value) },
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-buffer">Intervalo entre horários (min)</Label>
            <Input
              id="booking-buffer"
              type="number"
              min={0}
              max={240}
              value={form.booking.buffer_minutes}
              disabled={isPending}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  booking: { ...current.booking, buffer_minutes: Number(e.target.value) },
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-horizon">Antecedência máxima (dias)</Label>
            <Input
              id="booking-horizon"
              type="number"
              min={1}
              max={365}
              value={form.booking.booking_horizon_days}
              disabled={isPending}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  booking: { ...current.booking, booking_horizon_days: Number(e.target.value) },
                }))
              }
            />
          </div>
        </div>

        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Ainda não conecta uma conta Google nem cria eventos. Tokens OAuth nunca serão gravados em
          <code> organizations.settings</code>; a conexão terá armazenamento próprio e criptografado.
        </p>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={isPending || !dirty}>
          {isPending ? "Salvando…" : "Salvar recursos comerciais"}
        </Button>
        {dirty ? <span className="text-xs text-muted-foreground">Há mudanças não salvas.</span> : null}
      </div>
    </section>
  );
}
