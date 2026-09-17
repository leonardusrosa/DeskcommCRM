/**
 * scripts/demo/integrations/types.ts
 *
 * Types for CRM Integration Framework.
 * Event-driven, fail-silent synchronization adapters for demo commercial data.
 */

export type CRMProvider = "hubspot" | "pipedrive" | "salesforce";

export type CRMEventType =
  | "lead_created"
  | "demo_activated"
  | "meeting_booked"
  | "deal_won"
  | "deal_lost";

export interface CRMLeadData {
  name: string;
  email: string;
  phone?: string;
  company: string;
  country?: string;
  vertical?: string;
  status?: string;
}

export interface CRMDealData {
  value: number;
  currency: string;
  plan: string;
  status: string;
}

export interface CRMEventPayload {
  tenantId: string;
  eventType: CRMEventType;
  lead: CRMLeadData;
  deal?: CRMDealData;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CRMSyncResult {
  provider: CRMProvider;
  success: boolean;
  externalRecordId?: string;
  error?: string;
  timestamp: string;
}
