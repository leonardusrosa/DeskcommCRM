"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingDialog } from "./BookingDialog";

interface AppointmentItem {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  google_event_id?: string | null;
}

interface ContactAppointmentsCardProps {
  contactId?: string | null;
  leadId?: string | null;
  conversationId?: string | null;
  contactName?: string | null;
}

export function ContactAppointmentsCard({
  contactId,
  leadId,
  conversationId,
  contactName,
}: ContactAppointmentsCardProps) {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!contactId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/agenda/agendamentos?contact_id=${contactId}`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setAppointments(json.data);
      }
    } catch {
      // Falha silenciosa
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancel = async (id: string) => {
    try {
      setActionLoading(id);
      await fetch(`/api/v1/agenda/agendamentos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, cancellation_reason: "Cancelado pelo operador via painel" }),
      });
      fetchAppointments();
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      setActionLoading(id);
      await fetch(`/api/v1/agenda/agendamentos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "completed" }),
      });
      fetchAppointments();
    } finally {
      setActionLoading(null);
    }
  };

  const formatarDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
          Agendamentos
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => setDialogOpen(true)}
        >
          + Agendar
        </Button>
      </div>

      {loading ? (
        <div className="text-xs text-neutral-400 py-2 text-center">Carregando...</div>
      ) : appointments.length === 0 ? (
        <div className="text-xs text-neutral-500 py-2 text-center border border-dashed rounded-md">
          Nenhum compromisso agendado.
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs space-y-1.5 bg-neutral-50/50 dark:bg-neutral-900/50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[170px]">
                  {appt.title}
                </span>
                <Badge
                  variant={
                    appt.status === "confirmed"
                      ? "default"
                      : appt.status === "completed"
                      ? "secondary"
                      : "outline"
                  }
                  className="text-[10px] px-1.5 py-0 capitalize"
                >
                  {appt.status === "confirmed"
                    ? "Confirmado"
                    : appt.status === "completed"
                    ? "Concluído"
                    : appt.status === "cancelled"
                    ? "Cancelado"
                    : appt.status}
                </Badge>
              </div>

              <div className="text-neutral-500 flex items-center justify-between">
                <span>{formatarDataHora(appt.starts_at)}</span>
                {appt.google_event_id && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ● Google Sync
                  </span>
                )}
              </div>

              {appt.status === "confirmed" && (
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    disabled={actionLoading === appt.id}
                    onClick={() => handleCancel(appt.id)}
                    className="text-[11px] text-red-600 hover:text-red-700 dark:text-red-400 font-medium px-1.5 py-0.5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading === appt.id}
                    onClick={() => handleComplete(appt.id)}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium px-1.5 py-0.5"
                  >
                    Concluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <BookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contactId={contactId}
        leadId={leadId}
        conversationId={conversationId}
        defaultTitle={contactName ? `Reunião - ${contactName}` : undefined}
        onSuccess={fetchAppointments}
      />
    </div>
  );
}