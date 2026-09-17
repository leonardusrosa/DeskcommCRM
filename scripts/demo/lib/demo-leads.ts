/**
 * scripts/demo/lib/demo-leads.ts
 *
 * Commercial Demo Leads Data Layer.
 * Manages commercial prospects requesting a live Deskcomm demo.
 * Strictly isolated: NEVER mixed with customer tenant CRM data (crm_leads / contacts).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_DEMO_DIR } from "./demo-session";

export type DemoLeadStatus =
  | "requested"
  | "demo_created"
  | "activated"
  | "engaged"
  | "meeting_booked"
  | "proposal_sent"
  | "converted"
  | "lost"
  | "active"
  | "qualified";

export const DEMO_LEAD_STAGES: DemoLeadStatus[] = [
  "requested",
  "demo_created",
  "activated",
  "engaged",
  "meeting_booked",
  "proposal_sent",
  "converted",
  "lost",
];

export interface DemoLead {
  id: string;
  name: string;
  company: string;
  country: string;
  vertical: string;
  email: string;
  whatsapp: string;
  demo_tenant_id: string;
  status: DemoLeadStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateDemoLeadInput {
  name: string;
  company: string;
  country: string;
  vertical?: string;
  email: string;
  whatsapp: string;
  demo_tenant_id: string;
  status?: DemoLeadStatus;
}

export const DEFAULT_DEMO_LEADS_FILE = path.resolve(DEFAULT_DEMO_DIR, "demo_leads.json");

/**
 * Creates a new commercial demo lead.
 * Persists locally in .demo/demo_leads.json and safely attempts Supabase if available.
 */
export async function createDemoLead(
  input: CreateDemoLeadInput,
  options: { customAdmin?: SupabaseClient; customFilePath?: string } = {},
): Promise<DemoLead> {
  const now = new Date().toISOString();
  const lead: DemoLead = {
    id: crypto.randomUUID ? crypto.randomUUID() : `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    company: input.company.trim(),
    country: input.country.toUpperCase().trim(),
    vertical: (input.vertical || "dental-clinic").trim(),
    email: input.email.toLowerCase().trim(),
    whatsapp: input.whatsapp.trim(),
    demo_tenant_id: input.demo_tenant_id,
    status: input.status || "demo_created",
    created_at: now,
    updated_at: now,
  };

  saveLeadLocally(lead, options.customFilePath || DEFAULT_DEMO_LEADS_FILE);

  if (options.customAdmin) {
    try {
      await options.customAdmin.from("demo_leads").insert(lead);
    } catch {
      // Ignored: Supabase table demo_leads might not exist in local schema
    }
  }

  return lead;
}

/**
 * Lists all commercial demo leads, optionally filtered by status or country.
 */
export function listDemoLeads(
  filters: { status?: DemoLeadStatus; country?: string } = {},
  customFilePath = DEFAULT_DEMO_LEADS_FILE,
): DemoLead[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    const raw = fs.readFileSync(customFilePath, "utf-8");
    const all = JSON.parse(raw) as DemoLead[];
    return all.filter((l) => {
      if (filters.status && l.status !== filters.status) return false;
      if (filters.country && l.country !== filters.country.toUpperCase()) return false;
      return true;
    });
  } catch {
    return [];
  }
}

/**
 * Finds a demo lead by its associated demo_tenant_id.
 */
export function findDemoLeadByTenantId(
  tenantId: string,
  customFilePath = DEFAULT_DEMO_LEADS_FILE,
): DemoLead | null {
  const leads = listDemoLeads({}, customFilePath);
  return leads.find((l) => l.demo_tenant_id === tenantId) || null;
}

/**
 * Updates status of a demo lead.
 */
export function updateDemoLeadStatus(
  idOrTenantId: string,
  newStatus: DemoLeadStatus,
  customFilePath = DEFAULT_DEMO_LEADS_FILE,
): DemoLead | null {
  if (!fs.existsSync(customFilePath)) return null;
  try {
    const raw = fs.readFileSync(customFilePath, "utf-8");
    const all = JSON.parse(raw) as DemoLead[];
    const match = all.find((l) => l.id === idOrTenantId || l.demo_tenant_id === idOrTenantId);
    if (!match) return null;

    match.status = newStatus;
    match.updated_at = new Date().toISOString();
    fs.writeFileSync(customFilePath, JSON.stringify(all, null, 2), "utf-8");
    return match;
  } catch {
    return null;
  }
}

function saveLeadLocally(lead: DemoLead, targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let list: DemoLead[] = [];
  if (fs.existsSync(targetFile)) {
    try {
      list = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    } catch {
      list = [];
    }
  }

  const existingIndex = list.findIndex((l) => l.id === lead.id || l.demo_tenant_id === lead.demo_tenant_id);
  if (existingIndex >= 0) {
    list[existingIndex] = lead;
  } else {
    list.push(lead);
  }

  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
