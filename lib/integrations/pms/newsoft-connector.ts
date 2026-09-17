/**
 * NewSoft DS normalized partner-bridge connector.
 * The configured endpoint is the clinic/partner bridge root; no synthetic records exist in runtime.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
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
type ResolvedAddress = { address: string; family: number };
type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

async function defaultResolveHost(hostname: string): Promise<ResolvedAddress[]> {
  if (isIP(hostname)) {
    return [{ address: hostname, family: isIP(hostname) }];
  }
  return lookup(hostname, { all: true, verbatim: true });
}

function isPrivateOrReservedIp(raw: string): boolean {
  const address = raw.split("%")[0]!.toLowerCase();
  const family = isIP(address);

  if (family === 4) {
    const octets = address.split(".").map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return true;
    const [a, b, c] = octets as [number, number, number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (family === 6) {
    if (address === "::" || address === "::1") return true;
    if (address.startsWith("fc") || address.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(address)) return true;
    if (address.startsWith("ff")) return true;
    if (address.startsWith("2001:db8")) return true;
    if (address.startsWith("::ffff:")) {
      const mapped = address.slice("::ffff:".length);
      return isPrivateOrReservedIp(mapped);
    }
    return false;
  }

  return true;
}

function productionAllowedHosts(): Set<string> {
  return new Set(
    String(process.env.PMS_BRIDGE_ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

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

  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly resolveHost: ResolveHost = defaultResolveHost,
  ) {}

  public getCapabilities(): PmsCapabilityModel {
    return { ...NEWSOFT_CAPABILITIES };
  }

  private parseAndValidateEndpoint(config: NewSoftConnectorConfig): URL {
    if (!config.clinicApiKey || !config.endpointUrl) {
      throw new Error("[NewSoft Auth] Missing required clinic API key or endpoint URL.");
    }

    let endpoint: URL;
    try {
      endpoint = new URL(config.endpointUrl);
    } catch {
      throw new Error("[NewSoft Security] Invalid PMS endpoint URL.");
    }

    if (endpoint.protocol !== "https:") {
      throw new Error("[NewSoft Security] Insecure HTTP endpoint rejected. HTTPS required.");
    }
    if (endpoint.username || endpoint.password) {
      throw new Error("[NewSoft Security] Endpoint userinfo is forbidden.");
    }

    const hostname = endpoint.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
      throw new Error("[NewSoft Security] Local PMS endpoint rejected.");
    }
    if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
      throw new Error("[NewSoft Security] Private/reserved PMS endpoint rejected.");
    }

    if (process.env.NODE_ENV === "production") {
      const allowed = productionAllowedHosts();
      if (allowed.size === 0) {
        throw new Error(
          "[NewSoft Security] PMS_BRIDGE_ALLOWED_HOSTS is required in production.",
        );
      }
      if (!allowed.has(hostname)) {
        throw new Error(
          `[NewSoft Security] PMS endpoint host "${hostname}" is not platform-approved.`,
        );
      }
    }

    return endpoint;
  }

  private async assertEndpointNetworkSafe(endpoint: URL): Promise<void> {
    let addresses: ResolvedAddress[];
    try {
      addresses = await this.resolveHost(endpoint.hostname);
    } catch {
      throw new Error("[NewSoft Security] PMS endpoint DNS resolution failed.");
    }
    if (addresses.length === 0) {
      throw new Error("[NewSoft Security] PMS endpoint resolved to no addresses.");
    }
    if (addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
      throw new Error(
        "[NewSoft Security] PMS endpoint resolves to a private/reserved network.",
      );
    }
  }

  private async request(
    config: NewSoftConnectorConfig,
    path: string,
    init?: RequestInit,
    query?: Record<string, string | undefined>,
  ): Promise<unknown> {
    const endpoint = this.parseAndValidateEndpoint(config);
    await this.assertEndpointNetworkSafe(endpoint);

    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${config.clinicApiKey}`);
    headers.set("X-Deskcomm-Tenant", config.tenantId);
    if (init?.body) headers.set("Content-Type", "application/json");

    const response = await this.fetchImpl(bridgeUrl(endpoint.toString(), path, query), {
      ...init,
      headers,
      redirect: "error",
      signal: init?.signal ?? AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(
        `[NewSoft HTTP] ${init?.method || "GET"} ${path} failed with ${response.status}`,
      );
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
    options?: { limit?: number; cursor?: string },
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
    options: { startDate: string; endDate: string },
  ): Promise<AdministrativeAppointment[]> {
    const payload = await this.request(config, "appointments", undefined, {
      start: options.startDate,
      end: options.endDate,
    });
    return asItems(payload).map((item) => sanitizeAdministrativeAppointment(item));
  }

  public async createAppointment(
    config: NewSoftConnectorConfig,
    appointment: Omit<AdministrativeAppointment, "externalId">,
  ): Promise<AdministrativeAppointment> {
    if (!config.appointmentWriteEnabled) {
      throw new Error(
        `[PMS Safety Policy] Appointment write operations are disabled for tenant "${config.tenantId}". Deskcomm operates in Read-Only coexistence mode.`,
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
    externalId: string,
  ): Promise<boolean> {
    if (!config.appointmentWriteEnabled) {
      throw new Error(
        `[PMS Safety Policy] Appointment cancellation is disabled for tenant "${config.tenantId}".`,
      );
    }
    await this.request(config, `appointments/${encodeURIComponent(externalId)}`, {
      method: "DELETE",
    });
    return true;
  }
}

export const newSoftProductionConnector = new NewSoftProductionConnector();
