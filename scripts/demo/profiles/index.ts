/**
 * scripts/demo/profiles/index.ts
 *
 * Demo Profiles Registry.
 * Central access point for all sales demo profiles and scenarios.
 */

import { colombiaDentalProfile } from "./dental-clinic/colombia";
import { mexicoDentalProfile } from "./dental-clinic/mexico";
import { spainDentalProfile } from "./dental-clinic/spain";
import { portugalDentalProfile } from "./dental-clinic/portugal";
import type { DemoProfile } from "./types";

export * from "./types";
export * from "./engine";

export const DENTAL_CLINIC_PROFILES: DemoProfile[] = [
  colombiaDentalProfile,
  mexicoDentalProfile,
  spainDentalProfile,
  portugalDentalProfile,
];

export const ALL_DEMO_PROFILES: DemoProfile[] = [
  ...DENTAL_CLINIC_PROFILES,
];

export function getProfileById(id: string): DemoProfile | undefined {
  return ALL_DEMO_PROFILES.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

export function getProfileBySlug(slug: string): DemoProfile | undefined {
  return ALL_DEMO_PROFILES.find((p) => p.slug.toLowerCase() === slug.toLowerCase());
}
