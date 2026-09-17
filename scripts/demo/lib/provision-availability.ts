/**
 * scripts/demo/lib/provision-availability.ts
 *
 * Provision team schedules and working hours for dental providers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_CLINIC_TIMEZONE } from "./types";

export function buildClinicScheduleWindows() {
  const weekdays = [1, 2, 3, 4, 5]; // Lunes a Viernes
  const windows = [];

  for (const dow of weekdays) {
    // 08:00 - 12:30
    windows.push({ dow, start: "08:00", end: "12:30" });
    // Almuerzo: 12:30 - 14:00
    // 14:00 - 18:00
    windows.push({ dow, start: "14:00", end: "18:00" });
  }

  // Sábado: 09:00 - 13:00
  windows.push({ dow: 6, start: "09:00", end: "13:00" });

  return windows;
}

export async function ensureClinicAvailability(
  admin: SupabaseClient,
  orgId: string,
  providerUserIds: string[],
): Promise<void> {
  const windows = buildClinicScheduleWindows();
  const schedule = {
    timezone: DEMO_CLINIC_TIMEZONE,
    windows,
  };

  for (const userId of providerUserIds) {
    const { error } = await admin.from("attendant_availability").upsert(
      {
        organization_id: orgId,
        user_id: userId,
        is_available: true,
        capacity: 10,
        schedule,
      } as never,
      { onConflict: "organization_id,user_id" },
    );

    if (error) {
      throw new Error(`Failed to set availability for user ${userId}: ${error.message}`);
    }
  }
}
