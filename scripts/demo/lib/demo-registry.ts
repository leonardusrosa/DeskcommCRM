/**
 * scripts/demo/lib/demo-registry.ts
 *
 * Demo Tenant Registry & Lifecycle Management.
 * Manages active demo registrations, archival, ownership transfers, and lifecycle status.
 * Strictly isolated: operates only in demo environments (.demo/demo_registry.json).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { assertDemoEnvironmentSafety } from "./guards";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type DemoRegistryStatus = "active" | "archived" | "expired" | "converted";

export interface DemoOwnershipTransfer {
  previousOwner: string;
  newOwner: string;
  transferredAt: string;
  transferredBy?: string;
  reason?: string;
}

export interface DemoRegistryRecord {
  id: string;
  tenantId: string;
  name: string;
  vertical: string;
  country: string;
  ownerEmail: string;
  status: DemoRegistryStatus;
  createdAt: string;
  expiresAt: string;
  archivedAt?: string;
  archivedReason?: string;
  transferHistory: DemoOwnershipTransfer[];
}

export interface RegisterDemoInput {
  tenantId: string;
  name: string;
  vertical?: string;
  country?: string;
  ownerEmail: string;
  expiresInDays?: number;
}

export const DEFAULT_REGISTRY_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_registry.json",
);

export function registerDemo(
  input: RegisterDemoInput,
  customFilePath = DEFAULT_REGISTRY_FILE,
  customEnv?: Record<string, string | undefined>,
): DemoRegistryRecord {
  assertDemoEnvironmentSafety(customEnv);

  const days = input.expiresInDays ?? 7;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const record: DemoRegistryRecord = {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    name: input.name,
    vertical: input.vertical || "dental-clinic",
    country: (input.country || "CO").toUpperCase(),
    ownerEmail: input.ownerEmail,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt,
    transferHistory: [],
  };

  const all = listAllRegistryDemos(customFilePath);
  const existingIdx = all.findIndex((r) => r.tenantId === input.tenantId);
  if (existingIdx >= 0) {
    all[existingIdx] = record;
  } else {
    all.push(record);
  }
  saveRegistry(all, customFilePath);

  return record;
}

export function archiveDemo(
  tenantId: string,
  reason = "Demo period completed",
  customFilePath = DEFAULT_REGISTRY_FILE,
  customEnv?: Record<string, string | undefined>,
): DemoRegistryRecord | null {
  assertDemoEnvironmentSafety(customEnv);

  const all = listAllRegistryDemos(customFilePath);
  const match = all.find((r) => r.tenantId === tenantId);
  if (!match) return null;

  match.status = "archived";
  match.archivedAt = new Date().toISOString();
  match.archivedReason = reason;

  saveRegistry(all, customFilePath);
  return match;
}

export function transferDemoOwnership(
  tenantId: string,
  newOwnerEmail: string,
  options: { transferredBy?: string; reason?: string; customFilePath?: string; customEnv?: Record<string, string | undefined> } = {},
): DemoRegistryRecord | null {
  assertDemoEnvironmentSafety(options.customEnv);
  const targetFile = options.customFilePath ?? DEFAULT_REGISTRY_FILE;

  const all = listAllRegistryDemos(targetFile);
  const match = all.find((r) => r.tenantId === tenantId);
  if (!match) return null;

  const transfer: DemoOwnershipTransfer = {
    previousOwner: match.ownerEmail,
    newOwner: newOwnerEmail,
    transferredAt: new Date().toISOString(),
    transferredBy: options.transferredBy,
    reason: options.reason,
  };

  match.ownerEmail = newOwnerEmail;
  match.transferHistory.push(transfer);

  saveRegistry(all, targetFile);
  return match;
}

export function listActiveDemos(customFilePath = DEFAULT_REGISTRY_FILE): DemoRegistryRecord[] {
  return listAllRegistryDemos(customFilePath).filter((r) => r.status === "active");
}

export function listAllRegistryDemos(customFilePath = DEFAULT_REGISTRY_FILE): DemoRegistryRecord[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoRegistryRecord[];
  } catch {
    return [];
  }
}

function saveRegistry(list: DemoRegistryRecord[], targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
