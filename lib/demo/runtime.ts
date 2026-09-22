import type { DemoCountry } from "./types";

export interface DemoSessionContext {
  country: DemoCountry;
  expiresAt: string;
}

const COUNTRIES = new Set<DemoCountry>(["CO", "MX", "ES", "PT"]);

export function isSyntheticDemoChannelMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const record = metadata as Record<string, unknown>;
  return record.demo === true && record.synthetic === true;
}

export function demoSessionContextFromSettings(settings: unknown): DemoSessionContext | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const record = settings as Record<string, unknown>;
  if (record.demo !== true) return null;

  const country = record.country;
  const expiresAt = record.demo_expires_at;
  if (typeof country !== "string" || !COUNTRIES.has(country as DemoCountry)) return null;
  if (typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))) return null;

  return {
    country: country as DemoCountry,
    expiresAt,
  };
}
