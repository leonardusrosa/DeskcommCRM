/**
 * scripts/demo/profiles/types.ts
 *
 * Domain types for sales demonstration profiles and scenario data.
 */

import type {
  DemoUserSpec,
  DemoServiceSpec,
  DemoStageSpec,
  DemoContactSpec,
} from "../lib/types";

export interface DemoScenario {
  title: string;
  description: string;
  keyHighlights: string[];
}

export interface DemoAppointmentDef {
  eventTypeSlug: string;
  patientName: string;
  providerKey: "owner" | "dentist1" | "dentist2";
  daysOffset: number;
  localHour: number;
  localMinute: number;
  durationMinutes: number;
  status: "confirmed" | "scheduled" | "completed";
  notes: string;
}

export interface DemoProfile {
  id: string;
  category: "dental-clinic";
  country: string;
  flag: string;
  orgName: string;
  legalName: string;
  slug: string;
  language: string;
  timezone: string;
  industry: string;
  scenario: DemoScenario;
  users: DemoUserSpec[];
  services: DemoServiceSpec[];
  pipeline: {
    name: string;
    slug: string;
    stages: DemoStageSpec[];
  };
  contacts: DemoContactSpec[];
  appointments: DemoAppointmentDef[];
}
