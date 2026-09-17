/**
 * scripts/demo/clinics/mexico.ts
 *
 * Demo Clinic Definition — Clínica Dental México 🇲🇽
 * Backed by the official dental profile for Mexico.
 */

import { mexicoDentalProfile } from "../profiles/dental-clinic/mexico";
import { seedDemoProfile, cleanupDemoProfile } from "../profiles/engine";
import type { DemoClinicDefinition } from "./types";

export const mexicoClinic: DemoClinicDefinition = {
  id: "mexico",
  name: `${mexicoDentalProfile.flag} ${mexicoDentalProfile.orgName}`,
  shortName: mexicoDentalProfile.orgName,
  slug: mexicoDentalProfile.slug,
  country: mexicoDentalProfile.country,
  locale: mexicoDentalProfile.language,
  timezone: mexicoDentalProfile.timezone,
  ownerEmail: mexicoDentalProfile.users[0]!.email,
  seed: (env, admin) => seedDemoProfile(mexicoDentalProfile, env, admin),
  cleanup: (env, admin) => cleanupDemoProfile(mexicoDentalProfile, env, admin),
};

export default mexicoClinic;
