/**
 * scripts/demo/clinics/spain.ts
 *
 * Demo Clinic Definition — Clínica Sonrisa Madrid 🇪🇸
 * Backed by the official dental profile for Spain.
 */

import { spainDentalProfile } from "../profiles/dental-clinic/spain";
import { seedDemoProfile, cleanupDemoProfile } from "../profiles/engine";
import type { DemoClinicDefinition } from "./types";

export const spainClinic: DemoClinicDefinition = {
  id: "spain",
  name: `${spainDentalProfile.flag} ${spainDentalProfile.orgName}`,
  shortName: spainDentalProfile.orgName,
  slug: spainDentalProfile.slug,
  country: spainDentalProfile.country,
  locale: spainDentalProfile.language,
  timezone: spainDentalProfile.timezone,
  ownerEmail: spainDentalProfile.users[0]!.email,
  seed: (env, admin) => seedDemoProfile(spainDentalProfile, env, admin),
  cleanup: (env, admin) => cleanupDemoProfile(spainDentalProfile, env, admin),
};

export default spainClinic;
