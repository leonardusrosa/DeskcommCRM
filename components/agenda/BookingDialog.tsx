"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SlotItem {
  inicio: string;
  fim: string;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string | null;
  leadId?: string | null;
  conversationId?: string | null;
  defaultTitle?: string;
  onSuccess?: () => void;
}

export function BookingDialog({
  open,
  onOpenChange,
  contactId,
  leadId,
  conversationId,
  defaultTitle = "Reunião de Alinhamento",
  onSuccess,
}: BookingDialogProps) {
  const hoje = new Date().toISOString().split("T")[0] || "";
  const [dataSel, setDataSel] = useState<string>(hoje);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [slotSel, setSlotSel] = useState<SlotItem | null>(null);
  const [titulo, setTitulo] = useState<string>(defaultTitle);
  const [notas, setNotas] = useState<string>("");
  const [carregandoSlots, setCarregandoSlots] = useState<boolean>(false);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !dataSel) return;
    let ativo = true;

    async function buscarSlots() {
      setCarregandoSlots(true);
      setErro(null);
      setSlotSel(null);
      try {
        const de = new Date(`${dataSel}T00:00:00.000Z`).toISOString();
        const ate = new Date(`${dataSel}T23:59:59.999Z`).toISOString();
        const res = await fetch(`/api/v1/agenda/horarios-livres?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`);
        const json = await res.json();
        if (ativo && res.ok && Array.isArray(json.data)) {
          setSlots(json.data.map((s: { inicio: string; fim: string }) => ({ inicio: s.inicio, fim: s.fim })));
        } else if (ativo) {
          setSlots([]);
        }
      } catch {
        if (ativo) setErro("Erro ao carregar horários disponíveis");
      } finally {
        if (ativo) setCarregandoSlots(false);
      }
    }

    buscarSlots();
    return () => {
      ativo = false;
    };
  }, [open, dataSel]);

  const handleConfirmar = async () => {
    if (!slotSel || !titulo.trim()) return;

    try {
      setSalvando(true);
      setErro(null);

      const res = await fetch("/api/v1/agenda/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId || undefined,
          lead_id: leadId || undefined,
          conversation_id: conversationId || undefined,
          title: titulo.trim(),
          starts_at: slotSel.inicio,
          ends_at: slotSel.fim,
          notes: notas.trim() || undefined,
          location_kind: "in_person",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Falha ao confirmar agendamento");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao agendar");
    } finally {
      setSalvando(false);
    }
  };

  const formatarHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Agendar Compromisso</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {erro && (
            <div className="p-2.5 rounded text-xs bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 border border-red-200 dark:border-red-900">
              {erro}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="booking-title" className="text-xs">Título</Label>
            <Input
              id="booking-title"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Demonstração do Produto"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="booking-date" className="text-xs">Data</Label>
            <Input
              id="booking-date"
              type="date"
              min={hoje}
              value={dataSel}
              onChange={(e) => setDataSel(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Horários Livres</Label>
            {carregandoSlots ? (
              <div className="text-xs text-neutral-500 py-3 text-center">Consultando disponibilidade...</div>
            ) : slots.length === 0 ? (
              <div className="text-xs text-neutral-500 py-3 text-center border rounded-md border-dashed">
                Nenhum horário livre nesta data.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 border rounded-md">
                {slots.map((s) => {
                  const label = formatarHora(s.inicio);
                  const isSel = slotSel?.inicio === s.inicio;
                  return (
                    <button
                      key={s.inicio}
                      type="button"
                      onClick={() => setSlotSel(s)}
                      className={`text-xs py-1.5 px-2 rounded font-medium transition-colors ${
                        isSel
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                          : "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="booking-notes" className="text-xs">Observações (opcional)</Label>
            <Textarea
              id="booking-notes"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Detalhes da pauta ou informações adicionais"
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!slotSel || !titulo.trim() || salvando}
            onClick={handleConfirmar}
          >
            {salvando ? "Agendando..." : "Confirmar Agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}