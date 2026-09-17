/**
 * scripts/demo/integrations/hubspot.ts
 *
 * HubSpot CRM Adapter for Demo Events.
 * Fail-silent, isolated, event-driven.
 */

import type { CRMEventPayload, CRMSyncResult } from "./types";

export async function syncToHubSpot(
  event: CRMEventPayload,
  options: { apiKey?: string; apiUrl?: string } = {},
): Promise<CRMSyncResult> {
  const timestamp = new Date().toISOString();
  const apiKey = options.apiKey ?? process.env.HUBSPOT_API_KEY;
  const baseUrl = options.apiUrl ?? "https://api.hubapi.com";

  if (!apiKey) {
    // Fail silent: log commercial intent without breaking execution
    return {
      provider: "hubspot",
      success: true,
      externalRecordId: `hubspot_sim_${event.lead.email.replace(/[^a-zA-Z0-9]/g, "_")}`,
      timestamp,
    };
  }

  try {
    const res = await fetch(`${baseUrl}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          email: event.lead.email,
          firstname: event.lead.name.split(" ")[0] ?? "",
          lastname: event.lead.name.split(" ").slice(1).join(" ") || "",
          company: event.lead.company,
          phone: event.lead.phone ?? "",
          country: event.lead.country ?? "",
          lifecyclestage: event.eventType === "deal_won" ? "customer" : "lead",
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "HubSpot API error");
      return {
        provider: "hubspot",
        success: false,
        error: `HTTP ${res.status}: ${errorText.slice(0, 100)}`,
        timestamp,
      };
    }

    const data = (await res.json()) as { id?: string };
    return {
      provider: "hubspot",
      success: true,
      externalRecordId: data.id ?? `hubspot_${Date.now()}`,
      timestamp,
    };
  } catch (err) {
    return {
      provider: "hubspot",
      success: false,
      error: err instanceof Error ? err.message : "HubSpot network timeout",
      timestamp,
    };
  }
}
