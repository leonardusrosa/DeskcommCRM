"use client";

import { useState } from "react";

export interface BookingFormState {
  name: string;
  email: string;
  whatsapp: string;
  company: string;
  date: string;
  time: string;
  topic: string;
  tenantId?: string;
}

export interface BookingConfirmation {
  date: string;
  time: string;
  topic: string;
  meetUrl: string;
  leadName: string;
  company: string;
}

const AVAILABLE_SLOTS = [
  "09:00",
  "10:30",
  "14:00",
  "15:30",
  "17:00",
];

export function useDemoBooking() {
  const [formData, setFormData] = useState<BookingFormState>(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;
    return {
      name: "",
      email: "",
      whatsapp: "",
      company: "",
      date: tomorrow,
      time: "10:30",
      topic: "Demostración completa y WhatsApp",
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  const updateField = (field: keyof BookingFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const submitBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/demo/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo agendar la reunión.");
      }

      setConfirmation(data.meetingDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agendar cita.");
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    loading,
    error,
    confirmation,
    availableSlots: AVAILABLE_SLOTS,
    updateField,
    submitBooking,
  };
}
