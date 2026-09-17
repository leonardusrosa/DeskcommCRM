"use client";

import { useState, type FormEvent } from "react";
import type { DemoCountry } from "@/lib/demo/types";

interface CreatedDemo {
  ownerEmail: string;
  password: string;
  clinicName: string;
  expiresInHours: number;
  loginUrl: string;
}

export function useDemoRequest(initialCountry: DemoCountry = "CO") {
  const [country, setCountry] = useState<DemoCountry>(initialCountry);
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedDemo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, company: company.trim() || undefined }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to create demo.");
      setCreated(json.data as CreatedDemo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create demo.");
    } finally {
      setLoading(false);
    }
  };

  return { country, setCountry, company, setCompany, loading, created, error, submit };
}
