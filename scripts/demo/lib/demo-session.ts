/**
 * scripts/demo/lib/demo-session.ts
 *
 * Local demo session manager and credential generator.
 * Stores ephemeral demo credentials locally in .demo/session.json.
 */

import fs from "node:fs";
import path from "node:path";

export interface DemoSession {
  tenant: string;
  email: string;
  password: string;
  clinicName?: string;
  country?: string;
  createdAt?: string;
}

export const DEFAULT_DEMO_DIR = path.resolve(process.cwd(), ".demo");
export const DEFAULT_SESSION_PATH = path.resolve(DEFAULT_DEMO_DIR, "session.json");

/**
 * Generates an ephemeral demo password formatted like ClinicDemo-XXXX (e.g. ClinicDemo-8472).
 * Length is guaranteed >= 8 characters to pass security requirements.
 */
export function generateDemoPassword(prefix = "ClinicDemo"): string {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomSuffix}`;
}

/**
 * Saves the active demo session into .demo/session.json.
 */
export function saveDemoSession(
  session: DemoSession,
  customPath = DEFAULT_SESSION_PATH,
): void {
  const targetDir = path.dirname(customPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const payload: DemoSession = {
    tenant: session.tenant,
    email: session.email,
    password: session.password,
    clinicName: session.clinicName,
    country: session.country,
    createdAt: session.createdAt || new Date().toISOString(),
  };

  fs.writeFileSync(customPath, JSON.stringify(payload, null, 2), "utf-8");
}

/**
 * Loads the current demo session from .demo/session.json.
 * Returns null if the session file does not exist or is malformed.
 */
export function loadDemoSession(
  customPath = DEFAULT_SESSION_PATH,
): DemoSession | null {
  if (!fs.existsSync(customPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(customPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.tenant || !parsed.email) {
      return null;
    }
    return parsed as DemoSession;
  } catch {
    return null;
  }
}

/**
 * Clears the active demo session file.
 */
export function clearDemoSession(customPath = DEFAULT_SESSION_PATH): boolean {
  if (fs.existsSync(customPath)) {
    fs.unlinkSync(customPath);
    return true;
  }
  return false;
}
