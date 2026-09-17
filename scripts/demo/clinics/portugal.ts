/**
 * scripts/demo/clinics/portugal.ts
 *
 * Demo Clinic Definition — Clínica Saúde Lisboa 🇵🇹
 * Backed by the official dental profile for Portugal.
 */

import { portugalDentalProfile } from "../profiles/dental-clinic/portugal";
import { seedDemoProfile, cleanupDemoProfile } from "../profiles/engine";
import type { DemoClinicDefinition } from "./types";

export const portugalClinic: DemoClinicDefinition = {
  id: "portugal",
  name: `${portugalDentalProfile.flag} ${portugalDentalProfile.orgName}`,
  shortName: portugalDentalProfile.orgName,
  slug: portugalDentalProfile.slug,
  country: portugalDentalProfile.country,
  locale: portugalDentalProfile.language,
  timezone: portugalDentalProfile.timezone,
  ownerEmail: portugalDentalProfile.users[0]!.email,
  seed: (env, admin) => seedDemoProfile(portugalDentalProfile, env, admin),
  cleanup: (env, admin) => cleanupDemoProfile(portugalDentalProfile, env, admin),
};

export default portugalClinic;
