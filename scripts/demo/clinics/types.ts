/**
 * scripts/demo/clinics/types.ts
 *
 * Definition contract for demo clinic modules.
 * Adding support for a new country or region requires only creating
 * a new clinic definition in this folder and registering it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoSeedSummary } from "../lib/types";

export interface DemoClinicDefinition {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  country: string;
  locale: string;
  timezone: string;
  ownerEmail: string;
  seed: (
    customEnv?: Record<string, string | undefined>,
    customAdmin?: SupabaseClient,
  ) => Promise<DemoSeedSummary>;
  cleanup: (
    customEnv?: Record<string, string | undefined>,
    customAdmin?: SupabaseClient,
  ) => Promise<{ deleted: boolean; tenantId?: string }>;
}
