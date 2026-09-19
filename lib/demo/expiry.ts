export interface DemoSettingsShape {
  demo?: unknown;
  demo_expires_at?: unknown;
}

export function isExpiredDemoSettings(
  settings: unknown,
  now: number = Date.now(),
): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const record = settings as DemoSettingsShape;
  if (record.demo !== true || typeof record.demo_expires_at !== "string") return false;
  const expiresAt = Date.parse(record.demo_expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}
