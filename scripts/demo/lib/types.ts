/**
 * scripts/demo/lib/types.ts
 *
 * Types, interfaces, and constants for the Colombia Dental Clinic demo seed.
 */

export const DEMO_CLINIC_SLUG = "clinica-sonrisa-bogota";
export const DEMO_CLINIC_NAME = "Clínica Sonrisa Bogotá";
export const DEMO_CLINIC_COUNTRY = "CO";
export const DEMO_CLINIC_LOCALE = "es";
export const DEMO_CLINIC_TIMEZONE = "America/Bogota";
export const DEMO_CLINIC_INDUSTRY = "Dental Clinic";

export interface DemoClinicConfig {
  slug: string;
  name: string;
  country: string;
  locale: string;
  timezone: string;
  industry: string;
  isDemo: boolean;
}

export interface DemoUserSpec {
  key: "owner" | "operator" | "dentist1" | "dentist2";
  name: string;
  email: string;
  role: "admin" | "agent";
  isProvider: boolean;
  title: string;
}

export interface DemoServiceSpec {
  name: string;
  slug: string;
  durationMinutes: number;
  description: string;
  color?: string;
}

export interface DemoStageSpec {
  name: string;
  slug: string;
  position: number;
  isWon?: boolean;
  isLost?: boolean;
}

export interface DemoContactSpec {
  name: string;
  phoneNumber: string;
  email: string;
  status: "new" | "lost" | "won";
  stageSlug: string;
  interest: string;
  tags: string[];
  lostReason?: string;
  conversationMessages: Array<{
    direction: "inbound" | "outbound";
    body: string;
    hoursAgo: number;
  }>;
}

export interface DemoSeedSummary {
  tenantId: string;
  tenantName: string;
  slug: string;
  locale: string;
  timezone: string;
  users: Array<{ id: string; email: string; name: string; role: string }>;
  services: Array<{ id: string; name: string; durationMinutes: number }>;
  contacts: Array<{ id: string; name: string; phone: string; stage: string }>;
  appointments: Array<{
    id: string;
    title: string;
    patient: string;
    provider: string;
    startsAt: string;
    status: string;
  }>;
}
