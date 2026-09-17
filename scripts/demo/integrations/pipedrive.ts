/**
 * scripts/demo/integrations/pipedrive.ts
 *
 * Pipedrive CRM Adapter for Demo Events.
 * Fail-silent, isolated, event-driven.
 */

import type { CRMEventPayload, CRMSyncResult } from "./types";

export async function syncToPipedrive(
  event: CRMEventPayload,
  options: { apiToken?: string; apiUrl?: string } = {},
): Promise<CRMSyncResult> {
  const timestamp = new Date().toISOString();
  const apiToken = options.apiToken ?? process.env.PIPEDRIVE_API_TOKEN;
  const baseUrl = options.apiUrl ?? "https://api.pipedrive.com/v1";

  if (!apiToken) {
    // Fail silent: simulate integration
    return {
      provider: "pipedrive",
      success: true,
      externalRecordId: `pipedrive_sim_${Date.now()}`,
      timestamp,
    };
  }

  try {
    const res = await fetch(`${baseUrl}/persons?api_token=${apiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: event.lead.name,
        email: [event.lead.email],
        phone: event.lead.phone ? [event.lead.phone] : [],
        org_name: event.lead.company,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Pipedrive API error");
      return {
        provider: "pipedrive",
        success: false,
        error: `HTTP ${res.status}: ${errorText.slice(0, 100)}`,
        timestamp,
      };
    }

    const data = (await res.json()) as { data?: { id?: number } };
    return {
      provider: "pipedrive",
      success: true,
      externalRecordId: data.data?.id ? String(data.data.id) : `pipe_${Date.now()}`,
      timestamp,
    };
  } catch (err) {
    return {
      provider: "pipedrive",
      success: false,
      error: err instanceof Error ? err.message : "Pipedrive timeout",
      timestamp,
    };
  }
}
