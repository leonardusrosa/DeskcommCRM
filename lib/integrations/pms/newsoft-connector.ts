/**
 * NewSoft DS normalized partner-bridge connector.
 * The configured endpoint is the clinic/partner bridge root; no synthetic records exist in runtime.
 */

import {
  sanitizeAdministrativeAppointment,
  sanitizeAdministrativeContact,
} from "./clinical-guard";
import { NEWSOFT_CAPABILITIES } from "./capabilities";
import type {
  AdministrativeAppointment,
  AdministrativeContact,
  PmsCapabilityModel,
  PmsProviderName,
} from "./types";

export interface NewSoftConnectorConfig {
  tenantId: string;
  endpointUrl: string;
  clinicApiKey: string;
  appointmentWriteEnabled?: boolean;
}

type FetchLike = typeof fetch;

function bridgeUrl(base: string, path: string, query?: Record<string, string | undefined>): string {
  const root = base.endsWith("/") ? base : `${base}/`;
  const url = new URL(path.replace(/^\//, ""), root);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

function asItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidate = record.items ?? record.data ?? record.results;
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }
  throw new Error("[NewSoft Contract] Expected an array or {items|data|results: []} response");
}

export class NewSoftProductionConnector {
  public readonly providerName: PmsProviderName = "newsoft_ds";

  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  public getCapabilities(): PmsCapabilityModel {
    return { ...NEWSOFT_CAPABILITIES };
  }

  private assertConfig(config: NewSoftConnectorConfig): void {
    if (!config.clinicApiKey || !config.endpointUrl) {
      throw new Error("[NewSoft Auth] Missing required clinic API key or endpoint URL.");
    }
    if (!config.endpointUrl.startsWith("https://")) {
      throw new Error("[NewSoft Security] Insecure HTTP endpoint rejected. HTTPS required.");
    }
  }

  private async request(
    config: NewSoftConnectorConfig,
    path: string,
    init?: RequestInit,
    query?: Record<string, string | undefined>
  ): Promise<unknown> {
    this.assertConfig(config);
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${config.clinicApiKey}`);
    headers.set("X-Deskcomm-Tenant", config.tenantId);
    if (init?.body) headers.set("Content-Type", "application/json");

    const response = await this.fetchImpl(bridgeUrl(config.endpointUrl, path, query), {
      ...init,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`[NewSoft HTTP] ${init?.method || "GET"} ${path} failed with ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  public async testConnection(config: NewSoftConnectorConfig): Promise<boolean> {
    await this.request(config, "health");
    return true;
  }

  public async fetchContacts(
    config: NewSoftConnectorConfig,
    options?: { limit?: number; cursor?: string }
  ): Promise<AdministrativeContact[]> {
    const limit = Math.min(options?.limit ?? 100, 250);
    const payload = await this.request(config, "contacts", undefined, {
      limit: String(limit),
      cursor: options?.cursor,
    });
    return asItems(payload).map((item) => sanitizeAdministrativeContact(item));
  }

  public async fetchAppointments(
    config: NewSoftConnectorConfig,
    options: { startDate: string; endDate: string }
  ): Promise<AdministrativeAppointment[]> {
    const payload = await this.request(config, "appointments", undefined, {
      start: options.startDate,
      end: options.endDate,
    });
    return asItems(payload).map((item) => sanitizeAdministrativeAppointment(item));
  }

  public async createAppointment(
    config: NewSoftConnectorConfig,
    appointment: Omit<AdministrativeAppointment, "externalId">
  ): Promise<AdministrativeAppointment> {
    this.assertConfig(config);
    if (!config.appointmentWriteEnabled) {
      throw new Error(
        `[PMS Safety Policy] Appointment write operations are disabled for tenant "${config.tenantId}". Deskcomm operates in Read-Only coexistence mode.`
      );
    }

    const safeInput = sanitizeAdministrativeAppointment({ ...appointment, externalId: "pending" });
    const payload = await this.request(config, "appointments", {
      method: "POST",
      body: JSON.stringify({ ...safeInput, externalId: undefined }),
    });
    if (!payload || typeof payload !== "object") {
      throw new Error("[NewSoft Contract] Appointment create returned an invalid payload");
    }
    return sanitizeAdministrativeAppointment(payload as Record<string, unknown>);
  }

  public async cancelAppointment(
    config: NewSoftConnectorConfig,
    externalId: string
  ): Promise<boolean> {
    this.assertConfig(config);
    if (!config.appointmentWriteEnabled) {
      throw new Error(
        `[PMS Safety Policy] Appointment cancellation is disabled for tenant "${config.tenantId}".`
      );
    }
    await this.request(config, `appointments/${encodeURIComponent(externalId)}`, { method: "DELETE" });
    return true;
  }
}

export const newSoftProductionConnector = new NewSoftProductionConnector();
