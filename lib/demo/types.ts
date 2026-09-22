export type DemoCountry = "CO" | "MX" | "ES" | "PT";

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
  stageSlug: string;
  interest: string;
  tags: string[];
  status?: "new" | "lost" | "won";
  conversationMessages: Array<{
    direction: "inbound" | "outbound";
    body: string;
    hoursAgo: number;
  }>;
}

export interface DemoAppointmentSpec {
  eventTypeSlug: string;
  patientName: string;
  providerKey: "owner" | "dentist1" | "dentist2";
  daysOffset: number;
  localHour: number;
  localMinute: number;
  durationMinutes: number;
  status: "confirmed" | "pending" | "scheduled" | "completed";
  notes: string;
}

export interface DentalDemoTemplate {
  id: string;
  country: DemoCountry;
  countryName: string;
  flag: string;
  orgName: string;
  legalName: string;
  slug: string;
  locale: "es" | "pt-PT";
  timezone: string;
  currency: "COP" | "MXN" | "EUR";
  scenario: {
    title: string;
    description: string;
    keyHighlights: string[];
  };
  users: DemoUserSpec[];
  services: DemoServiceSpec[];
  pipeline: {
    name: string;
    slug: string;
    stages: DemoStageSpec[];
  };
  contacts: DemoContactSpec[];
  appointments: DemoAppointmentSpec[];
}

export interface DemoProvisionSummary {
  tenantId: string;
  slug: string;
  clinicName: string;
  country: DemoCountry;
  ownerEmail: string;
  ownerUserId: string;
}
