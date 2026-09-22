"use client";

import { useState, type FormEvent } from "react";
import type { DemoCountry } from "@/lib/demo/types";

interface DemoLaunch {
  clinicName: string;
  country: DemoCountry;
  syntheticData: true;
  expiresInHours: number;
  launchUrl: string;
}

export function useDemoRequest(initialCountry: DemoCountry = "CO") {
  const [country, setCountry] = useState<DemoCountry>(initialCountry);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launch = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to create demo.");

      const data = json.data as DemoLaunch;
      if (!data.launchUrl?.startsWith("/")) throw new Error("Invalid demo launch destination.");

      // The POST already established the httpOnly Supabase session cookie.
      // A normal navigation is all that remains; no credential reaches JS.
      window.location.assign(data.launchUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create demo.");
      setLoading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await launch();
  };

  return { country, setCountry, loading, error, launch, submit };
}
