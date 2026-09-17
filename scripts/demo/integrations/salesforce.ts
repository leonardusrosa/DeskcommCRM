/**
 * scripts/demo/integrations/salesforce.ts
 *
 * Salesforce CRM Adapter for Demo Events.
 * Fail-silent, isolated, event-driven.
 */

import type { CRMEventPayload, CRMSyncResult } from "./types";

export async function syncToSalesforce(
  event: CRMEventPayload,
  options: { accessToken?: string; instanceUrl?: string } = {},
): Promise<CRMSyncResult> {
  const timestamp = new Date().toISOString();
  const accessToken = options.accessToken ?? process.env.SALESFORCE_ACCESS_TOKEN;
  const instanceUrl = options.instanceUrl ?? process.env.SALESFORCE_INSTANCE_URL;

  if (!accessToken || !instanceUrl) {
    // Fail silent: simulate integration
    return {
      provider: "salesforce",
      success: true,
      externalRecordId: `sf_sim_00Q${Math.random().toString(36).slice(2, 12)}`,
      timestamp,
    };
  }

  try {
    const res = await fetch(`${instanceUrl}/services/data/v58.0/sobjects/Lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        FirstName: event.lead.name.split(" ")[0] ?? "",
        LastName: event.lead.name.split(" ").slice(1).join(" ") || "Lead",
        Company: event.lead.company,
        Email: event.lead.email,
        Phone: event.lead.phone ?? "",
        Country: event.lead.country ?? "",
        Status: event.eventType === "deal_won" ? "Closed - Converted" : "Open - Not Contacted",
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Salesforce error");
      return {
        provider: "salesforce",
        success: false,
        error: `HTTP ${res.status}: ${errorText.slice(0, 100)}`,
        timestamp,
      };
    }

    const data = (await res.json()) as { id?: string };
    return {
      provider: "salesforce",
      success: true,
      externalRecordId: data.id ?? `sf_${Date.now()}`,
      timestamp,
    };
  } catch (err) {
    return {
      provider: "salesforce",
      success: false,
      error: err instanceof Error ? err.message : "Salesforce timeout",
      timestamp,
    };
  }
}
