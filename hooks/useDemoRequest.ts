"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface DemoFormState {
  name: string;
  company: string;
  country: string;
  vertical: string;
  email: string;
  whatsapp: string;
}

const INITIAL_FORM: DemoFormState = {
  name: "",
  company: "",
  country: "CO",
  vertical: "dental-clinic",
  email: "",
  whatsapp: "",
};

export function useDemoRequest() {
  const router = useRouter();
  const [formData, setFormData] = useState<DemoFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const updateField = (field: keyof DemoFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const submitDemoRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No fue posible generar el entorno de demostración.");
      }

      if (data.credentials) {
        setCreatedCredentials(data.credentials);
      }

      // Small delay so users see confirmation or immediate redirect
      setTimeout(() => {
        router.push(data.redirectUrl || "/login");
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    loading,
    error,
    createdCredentials,
    updateField,
    submitDemoRequest,
  };
}
