/**
 * scripts/demo/lib/demo-pilot-7-data.ts
 *
 * Dataset generator for GTM Pilot #7 (300 Clinics: 100 CDMX, 100 GDL, 100 MTY).
 * Generates completely unique Mexican clinic records strictly disjoint from
 * Pilots 1, 2, 3, 4, 5, and 6.
 */

import type { MexicoCity, Pilot7ClinicRecord } from "@/types/demo-pilot-7";

const PREFIXES = [
  "OdontoClínica Especializada",
  "Red Dental Metropolitana",
  "Studio Dental Avanzado",
  "Clínica Dental Familiar",
  "Centro de Sonrisas",
  "OdontoSalud Integral",
  "Dental Care Premier",
  "Oral Boutique",
  "Grupo Médico Dental",
  "Instituto Odontológico",
];

const CDMX_ZONES = [
  "Tlalpan Centro", "Xochimilco Jardín", "Azcapotzalco", "Iztacalco Oriente", "Magdalena Contreras",
  "Cuajimalpa Real", "Venustiano Carranza", "Gustavo A. Madero", "San Simón", "Mixcoac Norte",
];

const GDL_ZONES = [
  "Tlaquepaque Poniente", "Tonalá Real", "El Salto Centro", "Huentitán", "Oblatos Jardín",
  "Tetlán Oriente", "La Tijera", "Miramar Zapopan", "Bugambilias Sur", "Santa Fe Tlajomulco",
];

const MTY_ZONES = [
  "San Nicolás Oriente", "Apodaca Industrial", "Guadalupe Real", "Santa Catarina Poniente", "García Premier",
  "Juárez Norte", "Escobedo Centro", "Cadereyta", "Pesquería", "Santiago Pueblo",
];

export function generatePilot7Clinics(): Pilot7ClinicRecord[] {
  const records: Pilot7ClinicRecord[] = [];
  const baseEpoch = Date.now() - 45 * 86400000;
  const iso = (ms: number) => new Date(ms).toISOString();

  const cityConfigs: Array<{ city: MexicoCity; zones: string[]; prefixId: string; phoneArea: string }> = [
    { city: "CDMX", zones: CDMX_ZONES, prefixId: "cdmx", phoneArea: "55" },
    { city: "Guadalajara", zones: GDL_ZONES, prefixId: "gdl", phoneArea: "33" },
    { city: "Monterrey", zones: MTY_ZONES, prefixId: "mty", phoneArea: "81" },
  ];

  for (const { city, zones, prefixId, phoneArea } of cityConfigs) {
    for (let pIdx = 0; pIdx < PREFIXES.length; pIdx++) {
      for (let zIdx = 0; zIdx < zones.length; zIdx++) {
        const index = pIdx * 10 + zIdx; // 0..99 per city
        const id = `p7-${prefixId}-${String(index + 1).padStart(3, "0")}`;
        const clinic = `${PREFIXES[pIdx]} ${zones[zIdx]}`;
        const chairs = 2 + ((pIdx + zIdx) % 5);
        const phone = `+52${phoneArea}${5000 + index}${1000 + ((index * 13) % 8900)}`;

        const createdMs = baseEpoch + index * 3600000;
        const timestamps: Record<string, string | undefined> = { outreach: iso(createdMs) };

        // Determine funnel stage distribution (matching calibrated rates across 100 per city)
        // 0..9: Closed Won (10 clinics)
        // 10..12: Closed Lost (3 clinics: 2 CFDI blocked, 1 local entity blocked)
        // 13..16: Proposal Sent stalled (4 clinics)
        // 17..18: Meeting Attended no proposal (2 clinics)
        // 19..19: Meeting Booked no-show (1 clinic)
        // 20..22: High Intent no meeting (3 clinics)
        // 23..33: Activated no high intent (11 clinics)
        // 34..41: Demo Requested no activation (8 clinics)
        // 42..61: Responded no demo request (20 clinics)
        // 62..99: Contacted no response (38 clinics)

        const record: Pilot7ClinicRecord = {
          id, clinic, city, chairs, whatsapp: phone, stage: "contacted", timestamps,
        };

        if (index < 62) {
          record.stage = "responded";
          timestamps.responded = iso(createdMs + 4 * 3600000);
        }
        if (index < 42) {
          record.stage = "demo_requested";
          timestamps.demoRequested = iso(createdMs + 8 * 3600000);
        }
        if (index < 34) {
          record.stage = "activated";
          timestamps.activated = iso(createdMs + 12 * 3600000);
        }
        if (index < 23) {
          record.stage = "high_intent";
          timestamps.highIntent = iso(createdMs + 16 * 3600000);
        }
        if (index < 19) {
          record.stage = "meeting_booked";
          timestamps.meetingBooked = iso(createdMs + 22 * 3600000);
        }
        if (index < 17) {
          record.stage = "meeting_attended";
          timestamps.meetingAttended = iso(createdMs + 40 * 3600000);
        }
        if (index < 13) {
          record.stage = "proposal_sent";
          timestamps.proposalSent = iso(createdMs + 48 * 3600000);
        }
        if (index >= 10 && index < 13) {
          record.stage = "closed_lost";
          timestamps.closedLost = iso(createdMs + 72 * 3600000);
          if (index === 10 || index === 11) {
            record.billingRoute = "D_cfdi_blocked";
            record.plan = index === 10 ? "starter" : "professional";
            record.mrr = record.plan === "starter" ? 890 : 1790;
          } else {
            record.billingRoute = "E_local_supplier_blocked";
            record.plan = "professional";
            record.mrr = 1790;
          }
        }
        if (index < 10) {
          record.stage = "closed_won";
          timestamps.closedWon = iso(createdMs + 60 * 3600000);

          // Plan mix: indices 0..3 Starter ($890), 4..9 Professional ($1,790) -> 40% Starter / 60% Pro
          const isStarter = index < 4;
          record.plan = isStarter ? "starter" : "professional";
          record.mrr = isStarter ? 890 : 1790;

          // Billing route distribution among won (10 per city = 30 total):
          // indices 0..3: Route A (no formal doc required) -> 4 * 3 = 12 total (40%)
          // indices 4..7: Route B (accepts foreign receipt directly) -> 4 * 3 = 12 total (40%)
          // indices 8..9: Route C (tax memo escalated -> accepted) -> 2 * 3 = 6 total (20%)
          if (index < 4) record.billingRoute = "A_no_document";
          else if (index < 8) record.billingRoute = "B_foreign_receipt_accepted";
          else record.billingRoute = "C_tax_memo_escalated";

          // Onboarding & time to first value
          const ttfv = index === 9 ? 52 : 18 + ((index * 3) % 18); // 9/10 within 48h = 90%
          record.timeToFirstValueHours = ttfv;
          record.firstValueWithin24h = ttfv <= 24;
          record.firstValueWithin48h = ttfv <= 48;
          record.humanSupportMinutes = 45 + ((index * 5) % 35); // 45 to 75 min

          // Cohort retention:
          // D7 active: 9 / 10 active (index 9 inactive)
          record.d7Active = index !== 9;
          // D14 active: 8 / 10 active (indices 8, 9 inactive)
          record.d14Active = index < 8;
          // D30 retained: 8 / 10 retained (indices 8, 9 churned)
          const isD30Retained = index < 8;
          record.d30Retained = isD30Retained;

          // D60: indices 0..4 have matured 60 days
          if (index < 5) {
            record.d60Retained = index < 4; // 4/5 retained = 80%
          }

          if (!isD30Retained) {
            record.churned = true;
            if (index === 8) {
              record.churnReason = "staff_adoption";
              record.churnExplanation = "La recepcionista principal renunció y el nuevo personal no fue capacitado en la agenda.";
            } else {
              record.churnReason = "low_usage";
              record.churnExplanation = "Baja afluencia de pacientes en el mes; decidieron pausar gastos fijos temporales.";
            }
          }
        }

        records.push(record);
      }
    }
  }

  return records;
}
