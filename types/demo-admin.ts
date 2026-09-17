import type { DemoLeadStatus } from "@/scripts/demo/lib/demo-leads";
import type { CommercialSignal } from "@/scripts/demo/lib/demo-score";

export interface AdminDemoItem {
  id: string;
  name: string;
  slug: string;
  country: string;
  vertical: string;
  score: number;
  scoreLevel: "low" | "medium" | "high";
  isHighIntent: boolean;
  signals: CommercialSignal[];
  lastActivity: string;
  expiresAt: string | null;
  conversionStatus: DemoLeadStatus;
  isActivated: boolean;
  nextAction: string;
  lastEvent: {
    name: string;
    createdAt: string;
  } | null;
  lead?: {
    id: string;
    name: string;
    email: string;
    company: string;
    whatsapp: string;
  } | null;
  createdAt: string;
}

export interface AdminDemosFilters {
  q?: string;
  country?: string;
  status?: DemoLeadStatus;
}
