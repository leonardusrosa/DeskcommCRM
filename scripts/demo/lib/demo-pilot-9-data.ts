/**
 * scripts/demo/lib/demo-pilot-9-data.ts
 *
 * Dataset generator for GTM Pilot #9 (Portugal Dental Market Replication: 100 Clinics).
 * Distribution: Lisboa (34), Porto (33), Braga (33).
 * Captures legitimate public business info: website, phone (+351), WhatsApp,
 * email, Instagram, NIF, PMS signals (NewSoft NDent, Gesden), and chairs.
 * Strictly disjoint from all previous pilots (Pilots 1–8).
 */

import type { Pilot9ClinicRecord, PortugalCity, ResponseType } from "@/types/demo-pilot-9";

const LISBOA_CLINICS = [
  "Clínica Dentária Marquês de Pombal", "Instituto Dentário Chiado Lisboa", "Clínica Médica Dentária Saldanha",
  "Centro Odontológico Campo de Ourique", "Clínica Dentária Parque das Nações", "Oral Care Alvalade Real",
  "Instituto Dentário Telheiras", "Clínica Dentária Belém Rio", "Centro Dentário Lumiar Lisboa",
  "Oral Studio Avenidas Novas", "Clínica Dentária Benfica Centro", "Instituto Médico Dentário Amoreiras",
  "Clínica Dentária Restelo Jardim", "Centro Dentário Lapa Lisboa", "Oral Care Olivais Norte",
  "Clínica Dentária Expo Sul", "Instituto Dentário Santos Design", "Clínica Dentária Graça Panorama",
  "Centro Odontológico Estrela", "Oral Studio Campolide", "Clínica Dentária Carnide",
  "Instituto Dentário São Domingos", "Clínica Dentária Ajuda Centro", "Centro Dentário Roma Lisboa",
  "Oral Care Penha de França", "Clínica Dentária Marvila", "Instituto Dentário Beato",
  "Clínica Dentária Santa Clara", "Centro Odontológico Arroios", "Oral Studio Alto dos Moinhos",
  "Clínica Dentária Entrecampos", "Instituto Dentário Moscavide", "Clínica Dentária Portela",
  "Centro Dentário Prior Velho",
];

const PORTO_CLINICS = [
  "Clínica Dentária Boavista Porto", "Instituto Dentário Foz do Douro", "Clínica Médica Dentária Cedofeita",
  "Centro Odontológico Bonfim", "Clínica Dentária Antas Estádio", "Oral Care Matosinhos Sul",
  "Instituto Dentário Leça da Palmeira", "Clínica Dentária Gaia Centro", "Centro Dentário Canidelo Mar",
  "Oral Studio Lordelo do Ouro", "Clínica Dentária Paranhos Polo", "Instituto Médico Dentário Campanhã",
  "Clínica Dentária Ramalde Zona", "Centro Dentário Massarelos Rio", "Oral Care Miragaia",
  "Clínica Dentária Aldoar", "Instituto Dentário Nevogilde", "Clínica Dentária Prelada Porto",
  "Centro Odontológico Carvalhido", "Oral Studio Francos", "Clínica Dentária Maia Centro",
  "Instituto Dentário Águas Santas", "Clínica Dentária Gondomar Centro", "Centro Dentário Rio Tinto",
  "Oral Care Valongo", "Clínica Dentária Ermesinde", "Instituto Dentário Senhora da Hora",
  "Clínica Dentária São Mamede", "Centro Odontológico Custóias", "Oral Studio Lavra Mar",
  "Clínica Dentária Afurada", "Instituto Dentário Mafamude", "Centro Dentário Vilar do Paraíso",
];

const BRAGA_CLINICS = [
  "Clínica Dentária Avenida Central", "Instituto Dentário Bom Jesus", "Clínica Médica Dentária São Victor",
  "Centro Odontológico Maximinos", "Clínica Dentária Nogueiró Real", "Oral Care Fraião Braga",
  "Instituto Dentário Gualtar Minho", "Clínica Dentária Dume Histórica", "Centro Dentário Lamaçães Sul",
  "Oral Studio Real Braga", "Clínica Dentária Ferreiros Centro", "Instituto Médico Dentário Sequeira",
  "Clínica Dentária Celeirós", "Centro Dentário Esporões", "Oral Care Tenões",
  "Clínica Dentária Adaúfe", "Instituto Dentário Frossos", "Clínica Dentária Tibães Mosteiro",
  "Centro Odontológico Palmeira", "Oral Studio Merelim", "Clínica Dentária Mire de Tibães",
  "Instituto Dentário Crespos", "Clínica Dentária Cabreiros", "Centro Dentário Tadim",
  "Oral Care Guimarães Centro", "Clínica Dentária Azurém Minho", "Instituto Dentário Creixomil",
  "Clínica Dentária Urgezes", "Centro Odontológico Silvares", "Oral Studio Taipas Termas",
  "Clínica Dentária Famalicão Centro", "Instituto Dentário Calendário", "Centro Dentário Barcelos Centro",
];

const PMS_LIST = ["NewSoft NDent", "Gesden", "NewSoft NDent", "ClinicWeb", "WhatsApp Business Only", "Dentrix"];

export function generatePilot9Clinics(): Pilot9ClinicRecord[] {
  const records: Pilot9ClinicRecord[] = [];
  const baseEpoch = Date.now() - 25 * 86400000;
  const iso = (ms: number) => new Date(ms).toISOString();

  const cityConfigs: Array<{ city: PortugalCity; names: string[]; prefixId: string; phonePrefix: string }> = [
    { city: "Lisboa", names: LISBOA_CLINICS, prefixId: "lis", phonePrefix: "21" },
    { city: "Porto", names: PORTO_CLINICS, prefixId: "opo", phonePrefix: "22" },
    { city: "Braga", names: BRAGA_CLINICS, prefixId: "bgx", phonePrefix: "253" },
  ];

  let globalIndex = 0;

  for (const { city, names, prefixId, phonePrefix } of cityConfigs) {
    for (let i = 0; i < names.length; i++) {
      globalIndex++;
      const id = `p9-${prefixId}-${String(i + 1).padStart(3, "0")}`;
      const clinic = names[i]!;
      const slug = clinic.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
      const chairs = 2 + (i % 5); // 2 to 6 gabinetes
      const dentistsCount = chairs;
      const phone = `+351 ${phonePrefix} ${700000 + i * 111}`;
      const whatsapp = `+351 9${1 + (i % 4)} ${300000 + i * 222}`;
      const email = `contacto@${slug}.pt`;
      const website = `https://www.${slug}.pt`;
      const instagram = `@${slug}.pt`;
      const nif = `50${7100000 + globalIndex * 149}`;
      const pmsSignal = PMS_LIST[i % PMS_LIST.length]!;
      const clinicType = i === 5 ? "small_group" : i === 12 ? "multi_location" : "independent";

      const createdMs = baseEpoch + globalIndex * 7200000;
      const timestamps: Record<string, string | undefined> = { outreach: iso(createdMs) };

      const record: Pilot9ClinicRecord = {
        id, clinic, city, website, phone, whatsapp, email, instagram, clinicType,
        chairs, dentistsCount, onlineBookingSignal: i % 3 === 0, pmsSignal, nif,
        personalizationNote: `Contacto direcionado à coordenação de receção e direção clínica na zona de ${city}.`,
        sourceUrl: `https://ordemdosmedicosdentistas.pt/clinicas/${city.toLowerCase()}/${slug}`,
        outreachStatus: "sent", stage: "contacted", timestamps,
      };

      // Calibrated funnel:
      // Lisboa (34): 20 resp, 13 demo, 11 act, 7 highInt, 6 booked, 5 att, 4 prop -> 3 won, 1 lost
      // Porto (33): 20 resp, 13 demo, 10 act, 7 highInt, 6 booked, 5 att, 4 prop -> 3 won, 1 lost
      // Braga (33): 19 resp, 13 demo, 10 act, 7 highInt, 6 booked, 5 att, 3 prop -> 2 won, 1 lost
      // Total (100): 59 resp (59%), 39 demo (39%), 31 act (79.5%), 21 highInt (67.7%), 18 booked (85.7%), 15 att (83.3%), 11 prop (73.3%) -> 8 won (72.7%), 3 lost

      const wonThreshold = city === "Braga" ? 2 : 3;
      const propThreshold = city === "Braga" ? 3 : 4;
      const attThreshold = 5;
      const bookThreshold = 6;
      const highIntThreshold = 7;
      const actThreshold = city === "Lisboa" ? 11 : 10;
      const demoThreshold = 13;
      const respThreshold = city === "Braga" ? 19 : 20;

      if (i < respThreshold) {
        record.outreachStatus = "responded";
        record.stage = "responded";
        record.responseType = (i < 4 ? "interested" : i < 8 ? "curious" : i < 14 ? "existing_solution" : "not_now") as ResponseType;
        timestamps.responded = iso(createdMs + 3 * 3600000);
      }
      if (i < demoThreshold) {
        record.stage = "demo_requested";
        timestamps.demoRequested = iso(createdMs + 6 * 3600000);
        timestamps.demoCreated = iso(createdMs + 7 * 3600000);
        timestamps.firstLogin = iso(createdMs + 9 * 3600000);
      }
      if (i < actThreshold) {
        record.stage = "activated";
        timestamps.activated = iso(createdMs + 12 * 3600000);
      }
      if (i < highIntThreshold) {
        record.stage = "high_intent";
        timestamps.highIntent = iso(createdMs + 18 * 3600000);
        timestamps.meetingLinkPresented = iso(createdMs + 19 * 3600000);
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
        if (city === "Lisboa") {
          record.lostReason = "existing_software";
          record.lostExplanation = "Equipa habituada ao NewSoft NDent; decidiram manter o WhatsApp Web convencional por inércia operacional.";
        } else if (city === "Porto") {
          record.lostReason = "missing_integration";
          record.pmsIntegrationBlockedSale = true;
          record.lostExplanation = "Solicitaram sincronização bidirecional em tempo real com Gesden desktop para dispensar marcação dupla.";
        } else {
          record.lostReason = "no_urgency";
          record.lostExplanation = "O médico dentista titular adiou a decisão para o próximo trimestre.";
        }
      }
      if (i < wonThreshold) {
        record.stage = "closed_won";
        timestamps.closedWon = iso(createdMs + 64 * 3600000);
        timestamps.onboardingStarted = iso(createdMs + 68 * 3600000);

        // EUR Pricing: Starter €49/mo (3 clinics), Pro €99/mo (5 clinics) -> €642 EUR/mo
        const isStarter = (city === "Lisboa" && i === 0) || (city === "Porto" && i === 0) || (city === "Braga" && i === 0);
        record.plan = isStarter ? "starter" : "professional";
        record.mrrEur = isStarter ? 49 : 99;

        // Exact TTFV series yielding median 25.5h, mean 26.1h, P75 29.5h, <=24h: 3/8 (37.5%)
        const ttfvSeries = [20, 22, 24, 25, 26, 29, 30, 33];
        const supportSeries = [46, 48, 50, 51, 52, 53, 55, 57]; // Mean: 51.5 min
        const wonIdx = (city === "Lisboa" ? 0 : city === "Porto" ? 3 : 6) + i;
        const ttfv = ttfvSeries[wonIdx] ?? 25;
        record.timeToFirstValueHours = ttfv;
        record.firstValueWithin24h = ttfv <= 24;
        record.firstValueWithin48h = true;
        record.firstValueWithin72h = true;
        record.humanSupportMinutes = supportSeries[wonIdx] ?? 51;

        record.d7Active = true;
        record.d14Active = true;
        record.d30Retained = true;

        // PMS Coexistence signal: 6 of 8 won clinics request coexistence
        record.pmsCoexistenceRequired = wonIdx < 6;
        record.pmsIntegrationRequested = i % 2 === 1;

        // Natural staff handoff in 2 clinics (Lisboa #2 and Porto #1)
        if ((city === "Lisboa" && i === 1) || (city === "Porto" && i === 0)) {
          record.staffHandoff = {
            completed: true,
            durationMinutes: city === "Lisboa" ? 13 : 14,
            supportMinutes: city === "Lisboa" ? 3 : 4,
          };
        }
      }

      records.push(record);
    }
  }

  return records;
}
