/**
 * scripts/demo/status.ts
 *
 * Demo Summary Command for Deskcomm Demo Intelligence.
 * Displays status, metrics, age, and expiration for all active demo environments.
 *
 * Usage:
 *   pnpm demo:status
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertDemoEnvironmentSafety } from "./lib/guards";

export interface DemoStatusItem {
  id: string;
  name: string;
  slug: string;
  country?: string;
  usersCount: number;
  contactsCount: number;
  appointmentsCount: number;
  createdAgo: string;
  expiresIn: string;
}

export interface StatusOptions {
  customEnv?: Record<string, string | undefined>;
  customAdmin?: SupabaseClient;
  silent?: boolean;
}

export async function getDemoStatus(options: StatusOptions = {}): Promise<DemoStatusItem[]> {
  // Safety guard: blocks production
  const { supabaseUrl, serviceRoleKey } = assertDemoEnvironmentSafety(options.customEnv);
  const admin =
    options.customAdmin ??
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  // Query demo organizations
  const { data: orgs, error: fetchErr } = await admin
    .from("organizations")
    .select("id, slug, display_name, settings, created_at, onboarded_at");

  if (fetchErr) {
    throw new Error(`Failed to query organizations: ${fetchErr.message}`);
  }

  const allOrgs = (orgs || []) as Array<{
    id: string;
    slug: string;
    display_name: string;
    settings?: Record<string, unknown>;
    created_at?: string;
    onboarded_at?: string;
  }>;

  // Filter for demo tenants only
  const demoOrgs = allOrgs.filter((org) => {
    const s = org.settings || {};
    return Boolean(s.demo || s.is_demo || org.slug.startsWith("clinica-"));
  });

  const results: DemoStatusItem[] = [];

  for (const org of demoOrgs) {
    // 1. Users count
    const { count: usersCount } = await admin
      .from("user_organizations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id);

    // 2. Contacts count
    const { count: contactsCount } = await admin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id);

    // 3. Appointments count
    const { count: appointmentsCount } = await admin
      .from("calendar_appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id);

    const s = org.settings || {};
    const createdAt = org.created_at || org.onboarded_at || new Date().toISOString();
    const expiresAt = (s.demo_expires_at as string) || undefined;

    results.push({
      id: org.id,
      name: org.display_name,
      slug: org.slug,
      country: (s.country as string) || undefined,
      usersCount: usersCount || 0,
      contactsCount: contactsCount || 0,
      appointmentsCount: appointmentsCount || 0,
      createdAgo: formatCreatedAgo(createdAt),
      expiresIn: formatExpiresIn(expiresAt, createdAt),
    });
  }

  if (!options.silent) {
    printDemoStatus(results);
  }

  return results;
}

function printDemoStatus(items: DemoStatusItem[]): void {
  console.info("Active demos:\n");

  if (items.length === 0) {
    console.info("None found. Run 'pnpm demo' to provision a demo environment.\n");
    return;
  }

  items.forEach((item, index) => {
    console.info(`${item.name}\n`);
    console.info("Users:");
    console.info(`${item.usersCount}\n`);
    console.info("Contacts:");
    console.info(`${item.contactsCount}\n`);
    console.info("Appointments:");
    console.info(`${item.appointmentsCount}\n`);
    console.info("Created:");
    console.info(`${item.createdAgo}\n`);
    console.info("Expires:");
    console.info(`${item.expiresIn}\n`);

    if (index < items.length - 1) {
      console.info("-----------------------------------\n");
    }
  });
}

export function formatCreatedAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMinutes < 5) return "Just now";
  if (diffHours < 1) return `${diffMinutes} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export function formatExpiresIn(expiresStr?: string, createdStr?: string): string {
  let targetDate: Date;
  if (expiresStr) {
    targetDate = new Date(expiresStr);
  } else if (createdStr) {
    targetDate = new Date(new Date(createdStr).getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    return "7 days";
  }

  const diffMs = targetDate.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";

  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));

  if (diffDays >= 1) return `${diffDays} days`;
  return `${diffHours} hours`;
}

if (require.main === module) {
  getDemoStatus().catch((err) => {
    console.error(`\n❌ Error en demo:status:`, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
