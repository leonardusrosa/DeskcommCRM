"use client";

import { useState } from "react";
import type { DemoCountry } from "@/lib/demo/types";

interface CreatedDemo {
  autoLogin: boolean;
  launchUrl: string;
  clinicName: string;
  country: DemoCountry;
  expiresInHours: number;
  fallbackCredentials?: {
    ownerEmail: string;
    password: string;
  };
}

export function useDemoRequest(initialCountry: DemoCountry = "CO") {
  const [country, setCountry] = useState<DemoCountry>(initialCountry);
  const [loadingCountry, setLoadingCountry] = useState<DemoCountry | null>(null);
  const [created, setCreated] = useState<CreatedDemo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const launch = async (nextCountry: DemoCountry) => {
    setCountry(nextCountry);
    setLoadingCountry(nextCountry);
    setCreated(null);
    setError(null);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: nextCountry }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to create demo.");

      const demo = json.data as CreatedDemo;
      setCreated(demo);
      if (demo.autoLogin) {
        window.sessionStorage.setItem(
          "synthetic_demo_context",
          JSON.stringify({
            country: demo.country,
            expiresAt: new Date(Date.now() + demo.expiresInHours * 60 * 60 * 1000).toISOString(),
          }),
        );
        window.location.assign(demo.launchUrl || "/app");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create demo.");
    } finally {
      setLoadingCountry(null);
    }
  };

  return { country, loadingCountry, created, error, launch };
}
