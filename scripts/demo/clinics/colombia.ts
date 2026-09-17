/**
 * scripts/demo/clinics/colombia.ts
 *
 * Demo Clinic Definition — Clínica Sonrisa Bogotá 🇨🇴
 * Reuses the existing seed and cleanup implementations.
 */

import { runClinicSeed } from "../seed-demo-clinic-colombia";
import { runClinicCleanup } from "../cleanup-demo-clinic";
import {
  DEMO_CLINIC_NAME,
  DEMO_CLINIC_SLUG,
  DEMO_CLINIC_COUNTRY,
  DEMO_CLINIC_LOCALE,
  DEMO_CLINIC_TIMEZONE,
} from "../lib/types";
import type { DemoClinicDefinition } from "./types";

export const colombiaClinic: DemoClinicDefinition = {
  id: "colombia",
  name: `🇨🇴 ${DEMO_CLINIC_NAME}`,
  shortName: DEMO_CLINIC_NAME,
  slug: DEMO_CLINIC_SLUG,
  country: DEMO_CLINIC_COUNTRY,
  locale: DEMO_CLINIC_LOCALE,
  timezone: DEMO_CLINIC_TIMEZONE,
  ownerEmail: "laura@sonrisabogota.demo",
  seed: runClinicSeed,
  cleanup: runClinicCleanup,
};

export default colombiaClinic;
