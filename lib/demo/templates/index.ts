import { colombiaDentalProfile } from "./colombia";
import { mexicoDentalProfile } from "./mexico";
import { portugalDentalProfile } from "./portugal";
import { spainDentalProfile } from "./spain";
import type { DentalDemoTemplate, DemoCountry } from "../types";

export const DENTAL_DEMO_TEMPLATES: DentalDemoTemplate[] = [
  colombiaDentalProfile,
  mexicoDentalProfile,
  spainDentalProfile,
  portugalDentalProfile,
];

export function getDentalDemoTemplate(country: string): DentalDemoTemplate | null {
  const normalized = country.toUpperCase() as DemoCountry;
  return DENTAL_DEMO_TEMPLATES.find((template) => template.country === normalized) || null;
}
