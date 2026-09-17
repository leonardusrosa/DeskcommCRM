/**
 * scripts/demo/lib/demo-pilot-8-data.ts
 *
 * Dataset generator for GTM Pilot #8 (Spain Dental Market Replication: 100 Clinics).
 * Distribution: Madrid (34), Barcelona (33), Valencia (33).
 * Strictly disjoint from all previous pilots (Pilots 1–7).
 */

import type { IncumbentSoftware, Pilot8ClinicRecord, SpainCity } from "@/types/demo-pilot-8";
import { createStaffHandoffEvent } from "./demo-staff-handoff";

// 34 Madrid Clinics
const MADRID_CLINICS = [
  "Clínica Dental Gran Vía Madrid", "Centro Odontológico Salamanca Centro", "Dental Studio Chamberí", "Clínica Dental Retiro Norte", "Oral Care Chamartín Real",
  "Instituto Dental Moncloa", "Clínica Dental Fuencarral Norte", "Centro Odontológico Castellana", "Dental Spa Malasaña", "Oral Art La Latina Madrid",
  "Clínica Dental Barrio del Pilar", "Centro Odontológico Tetuán", "Dental Studio Pozuelo Real", "Clínica Dental Majadahonda Centro", "Oral Plus Las Rozas",
  "Centro Odontológico Alcobendas", "Dental Elite San Sebastián de los Reyes", "Clínica Dental Getafe Centro", "Oral Láser Leganés Real", "Centro Odontológico Alcorcón",
  "Dental Studio Móstoles", "Clínica Dental Fuenlabrada", "OdontoCenter Torrejón", "Dental Care Alcalá de Henares", "Clínica Dental Rivas Futura",
  "Centro Dental Coslada", "Dental Pro Parla", "Clínica Odontológica Valdebebas", "Dental Spa Sanchinarro", "Sonrisas Las Tablas",
  "Clínica Dental Montecarmelo", "Oral Center Mirasierra", "Dental Studio Aravaca", "Clínica Odontológica Arturo Soria",
];

// 33 Barcelona Clinics
const BARCELONA_CLINICS = [
  "Institut Dental Passeig de Gràcia", "Clínica Dental Eixample Dret", "Centre Odontològic Sarrià", "Dental Studio Gràcia Barcelona", "Clínica Dental Les Corts",
  "Oral Center Sant Gervasi", "Institut Odontològic Poblenou", "Centre Dental Diagonal Mar", "Dental Spa Rambla Catalunya", "Oral Art Ciutat Vella",
  "Clínica Dental Sagrada Família", "Centre Odontològic Sants", "Dental Studio Sant Andreu", "Clínica Dental Horta Residencial", "Oral Plus Nou Barris",
  "Centre Odontològic Badalona Mar", "Dental Elite Santa Coloma", "Clínica Dental Hospitalet Centre", "Oral Láser Cornellà", "Centre Odontològic Sant Boi",
  "Dental Studio Castelldefels Platja", "Clínica Dental Gavà Mar", "OdontoCenter Viladecans", "Dental Care Sant Cugat Centre", "Clínica Dental Sabadell Centre",
  "Centre Dental Terrassa Rambla", "Dental Pro Mataró Centre", "Clínica Odontològica Granollers", "Dental Spa Mollet", "Sonrisas Rubí Centre",
  "Clínica Dental Manresa", "Oral Center El Prat", "Dental Studio Cerdanyola",
];

// 33 Valencia Clinics
const VALENCIA_CLINICS = [
  "Clínica Dental Colón Valencia", "Centro Odontológico Ruzafa", "Dental Studio Gran Vía Marqués del Turia", "Clínica Dental El Carmen Valencia", "Oral Care Blasco Ibáñez",
  "Instituto Dental Mestalla", "Clínica Dental Campanar", "Centro Odontológico Benimaclet", "Dental Spa Pla del Real", "Oral Art Ciutat Vella Valencia",
  "Clínica Dental Patraix", "Centro Odontológico Jesús", "Dental Studio Malvarrosa", "Clínica Dental Cabanyal Mar", "Oral Plus Olivereta",
  "Centro Odontológico Quatre Carreres", "Dental Elite Nou Moles", "Clínica Dental Mislata Centro", "Oral Láser Burjassot", "Centro Odontológico Paterna",
  "Dental Studio Manises", "Clínica Dental Torrent Centro", "OdontoCenter Alaquàs", "Dental Care Xirivella", "Clínica Dental Aldaia",
  "Centro Dental Quart de Poblet", "Dental Pro Catarroja", "Clínica Odontológica Alfafar", "Dental Spa Sedaví", "Sonrisas Paiporta",
  "Clínica Dental Alzira", "Oral Center Sagunto Puerto", "Dental Studio Gandia Centre",
];

const INCUMBENTS: IncumbentSoftware[] = [
  "gesden", "infomed_dentool", "gesden", "dasi_clinic", "whatsapp_business_only",
  "gesden", "infomed_dentool", "clinicorp", "paper_manual", "whatsapp_business_only",
];

export function generatePilot8Clinics(): Pilot8ClinicRecord[] {
  const records: Pilot8ClinicRecord[] = [];
  const baseEpoch = Date.now() - 30 * 86400000;
  const iso = (ms: number) => new Date(ms).toISOString();

  const cityConfigs: Array<{ city: SpainCity; names: string[]; prefixId: string; phonePrefix: string }> = [
    { city: "Madrid", names: MADRID_CLINICS, prefixId: "mad", phonePrefix: "91" },
    { city: "Barcelona", names: BARCELONA_CLINICS, prefixId: "bcn", phonePrefix: "93" },
    { city: "Valencia", names: VALENCIA_CLINICS, prefixId: "vlc", phonePrefix: "96" },
  ];

  let globalIndex = 0;

  for (const { city, names, prefixId, phonePrefix } of cityConfigs) {
    for (let i = 0; i < names.length; i++) {
      globalIndex++;
      const id = `p8-${prefixId}-${String(i + 1).padStart(3, "0")}`;
      const clinic = names[i]!;
      const cabinets = 2 + (i % 5); // 2 to 6 gabinetes
      const phone = `+34${phonePrefix}${500000 + i * 111}`;
      const cifNif = `B${80000000 + globalIndex * 137}`;
      const incumbentSoftware = INCUMBENTS[i % INCUMBENTS.length]!;

      const createdMs = baseEpoch + globalIndex * 7200000;
      const timestamps: Record<string, string | undefined> = { outreach: iso(createdMs) };

      const record: Pilot8ClinicRecord = {
        id, clinic, city, cabinets, phone, cifNif, stage: "contacted", incumbentSoftware, timestamps,
      };

      // Distribution per city:
      // Madrid (34): 21 resp, 14 demo, 11 act, 8 highInt, 7 booked, 6 att, 4 prop -> 3 won, 1 lost
      // Barcelona (33): 20 resp, 13 demo, 11 act, 7 highInt, 6 booked, 5 att, 4 prop -> 3 won, 1 lost
      // Valencia (33): 19 resp, 13 demo, 10 act, 7 highInt, 6 booked, 5 att, 3 prop -> 2 won, 1 lost
      // Total 100: 60 resp (60%), 40 demo (40%), 32 act (80%), 22 highInt (68.8%), 19 booked (86.4%), 16 att (84.2%), 11 prop (68.8%) -> 8 won, 3 lost

      const wonThreshold = city === "Valencia" ? 2 : 3;
      const propThreshold = city === "Valencia" ? 3 : 4;
      const attThreshold = city === "Madrid" ? 6 : 5;
      const bookThreshold = city === "Madrid" ? 7 : 6;
      const highIntThreshold = city === "Madrid" ? 8 : 7;
      const actThreshold = city === "Valencia" ? 10 : 11;
      const demoThreshold = city === "Madrid" ? 14 : 13;
      const respThreshold = city === "Madrid" ? 21 : city === "Barcelona" ? 20 : 19;

      if (i < respThreshold) {
        record.stage = "responded";
        timestamps.responded = iso(createdMs + 4 * 3600000);
      }
      if (i < demoThreshold) {
        record.stage = "demo_requested";
        timestamps.demoRequested = iso(createdMs + 8 * 3600000);
      }
      if (i < actThreshold) {
        record.stage = "activated";
        timestamps.activated = iso(createdMs + 12 * 3600000);
      }
      if (i < highIntThreshold) {
        record.stage = "high_intent";
        timestamps.highIntent = iso(createdMs + 18 * 3600000);
      }
      if (i < bookThreshold) {
        record.stage = "meeting_booked";
        timestamps.meetingBooked = iso(createdMs + 24 * 3600000);
      }
      if (i < attThreshold) {
        record.stage = "meeting_attended";
        timestamps.meetingAttended = iso(createdMs + 48 * 3600000);
      }
      if (i < propThreshold) {
        record.stage = "proposal_sent";
        timestamps.proposalSent = iso(createdMs + 56 * 3600000);
      }
      if (i === wonThreshold) {
        record.stage = "closed_lost";
        timestamps.closedLost = iso(createdMs + 72 * 3600000);
        if (city === "Madrid") {
          record.lostReason = "existing_software";
          record.lostExplanation = "Muy conformes con Gesden; no ven necesidad inmediata de centralizar WhatsApp en otra herramienta.";
        } else if (city === "Barcelona") {
          record.lostReason = "price";
          record.lostExplanation = "Solicitaron descuento para 4 gabinetes que no se concedió bajo la tarifa congelada.";
        } else {
          record.lostReason = "no_urgency";
          record.lostExplanation = "Pospusieron la decisión para después de las vacaciones del doctor titular.";
        }
      }
      if (i < wonThreshold) {
        record.stage = "closed_won";
        timestamps.closedWon = iso(createdMs + 66 * 3600000);

        // EUR Pricing: Starter €49/mo, Pro €99/mo (3 Starter / 5 Pro = €147 + €495 = €642 EUR/mo)
        const isStarter = (city === "Madrid" && i === 0) || (city === "Barcelona" && i === 0) || (city === "Valencia" && i === 0);
        record.plan = isStarter ? "starter" : "professional";
        record.mrrEur = isStarter ? 49 : 99;

        // Time to first value
        const ttfv = 20 + ((i * 4) % 16); // 20 to 32 hours (median ~24h)
        record.timeToFirstValueHours = ttfv;
        record.firstValueWithin48h = ttfv <= 48;
        record.humanSupportMinutes = 48 + ((i * 6) % 24); // 48 to 66 min

        // Cohort activity
        record.d7Active = true;
        record.d14Active = true;
        record.d30Retained = true;

        // Natural receptionist replacement & staff handoff in 2 clinics (Madrid #1, Barcelona #2)
        if ((city === "Madrid" && i === 1) || (city === "Barcelona" && i === 2)) {
          record.staffHandoff = createStaffHandoffEvent(record.id, record.clinic, {
            durationMinutes: city === "Madrid" ? 12 : 14,
            supportMinutes: 4,
            completed: true,
          });
        }
      }

      records.push(record);
    }
  }

  return records;
}
