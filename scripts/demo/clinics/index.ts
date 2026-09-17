/**
 * scripts/demo/clinics/index.ts
 *
 * Registry of available demo clinic configurations.
 * To add a new country or clinic, simply add its file in this directory and register it here.
 */

import { colombiaClinic } from "./colombia";
import { mexicoClinic } from "./mexico";
import { spainClinic } from "./spain";
import { portugalClinic } from "./portugal";
import type { DemoClinicDefinition } from "./types";

export * from "./types";

export const AVAILABLE_CLINICS: DemoClinicDefinition[] = [
  colombiaClinic,
  mexicoClinic,
  spainClinic,
  portugalClinic,
];

export function getClinicById(id: string): DemoClinicDefinition | undefined {
  return AVAILABLE_CLINICS.find((c) => c.id.toLowerCase() === id.toLowerCase());
}

export function getClinicBySlug(slug: string): DemoClinicDefinition | undefined {
  return AVAILABLE_CLINICS.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
}
