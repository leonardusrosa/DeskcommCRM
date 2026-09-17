/**
 * scripts/demo/lib/demo-pilot-10-data.ts
 *
 * Compact dataset generator for GTM Pilot #10 (Iberia PMS Coexistence: 20 Clinics).
 * Evaluates real paying/proposal-stage clinics across Spain (10) and Portugal (10).
 * Captures raw clinic wording, baseline duplicate entry, and commercial intent.
 */

import type { ClinicPmsDiscoveryRecord, PmsName } from "@/types/demo-pilot-10";

interface ClinicSeedConfig {
  id: string;
  name: string;
  country: "Spain" | "Portugal";
  city: string;
  pms: PmsName;
  version: string;
  cloud?: boolean;
  users: number;
  appts: number;
  baseMin: number;
  postMin: number;
  req: boolean;
  block: boolean;
  blockedEur?: number;
  risk: "low" | "medium" | "high";
  workflow: string;
  wording: string;
  intent: [boolean, boolean, boolean, boolean, boolean]; // [noInt, contact, calRead, calWrite, fullSync]
}

const CLINIC_SEEDS: ClinicSeedConfig[] = [
  // Spain (10 Clinics)
  {
    id: "p10-es-001", name: "Clínica Dental Gran Vía Madrid", country: "Spain", city: "Madrid",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 2, appts: 120, baseMin: 190, postMin: 35,
    req: true, block: false, risk: "medium",
    workflow: "Lectura de agenda Gesden hacia Deskcomm para disparar recordatorios WhatsApp automáticos.",
    wording: "No podemos cambiar Gesden porque tenemos 10 años de historiales aquí. Necesitamos que Deskcomm lea la agenda.",
    intent: [true, true, true, true, false],
  },
  {
    id: "p10-es-002", name: "Centro Odontológico Salamanca Centro", country: "Spain", city: "Madrid",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 3, appts: 160, baseMin: 240, postMin: 40,
    req: true, block: false, risk: "low",
    workflow: "Sincronización unidireccional de citas del día para seguimiento y confirmación.",
    wording: "Si las chicas tienen que mirar dos pantallas todo el día, antes o después cometerán un error.",
    intent: [true, true, true, true, false],
  },
  {
    id: "p10-es-003", name: "Dental Studio Chamberí", country: "Spain", city: "Madrid",
    pms: "Gesden", version: "Gesden One (Cloud)", cloud: true, users: 2, appts: 95, baseMin: 140, postMin: 25,
    req: true, block: false, risk: "low",
    workflow: "Lectura API de huecos libres para que el bot sugiera horarios reales.",
    wording: "Usamos la versión nube de Gesden, si se pudiera conectar por API sería perfecto.",
    intent: [true, true, true, true, false],
  },
  {
    id: "p10-es-004", name: "Institut Dental Passeig de Gràcia", country: "Spain", city: "Barcelona",
    pms: "Gesden", version: "G5 Desktop (v5.6)", users: 3, appts: 175, baseMin: 210, postMin: 45,
    req: true, block: false, risk: "medium",
    workflow: "Importación de contactos nuevos desde Deskcomm a Gesden y lectura de citas.",
    wording: "Lo que más tiempo nos quita es escribir nombre, teléfono y DNI dos veces por cada paciente nuevo.",
    intent: [true, true, true, true, false],
  },
  {
    id: "p10-es-005", name: "Clínica Dental Eixample Dret", country: "Spain", city: "Barcelona",
    pms: "Infomed Dentool", version: "Dentool v4 Desktop", users: 2, appts: 110, baseMin: 160, postMin: 30,
    req: true, block: false, risk: "low",
    workflow: "Lectura de citas para recordatorios automáticos 24h antes.",
    wording: "Con que Deskcomm sepa qué pacientes vienen mañana para mandarles el WhatsApp nos basta.",
    intent: [false, true, true, true, false],
  },
  {
    id: "p10-es-006", name: "Centre Odontològic Sarrià", country: "Spain", city: "Barcelona",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 2, appts: 130, baseMin: 180, postMin: 35,
    req: true, block: false, risk: "low",
    workflow: "Coexistencia visual: Gesden manda en la cita, Deskcomm en el mensaje.",
    wording: "Gesden es el corazón médico. No toquen los historiales, solo ayúdennos con la agenda.",
    intent: [false, false, true, true, false],
  },
  {
    id: "p10-es-007", name: "Clínica Dental Colón Valencia", country: "Spain", city: "Valencia",
    pms: "Gesden", version: "G5 Desktop (v5.7)", users: 2, appts: 105, baseMin: 175, postMin: 30,
    req: true, block: false, risk: "low",
    workflow: "Lectura periódica del calendario para disparar avisos sin duplicar citas.",
    wording: "Queremos evitar que la recepcionista pase 2 horas cada tarde enviando recordatorios a mano.",
    intent: [false, true, true, true, false],
  },
  {
    id: "p10-es-008", name: "Centro Odontológico Ruzafa", country: "Spain", city: "Valencia",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 2, appts: 125, baseMin: 195, postMin: 40,
    req: true, block: false, risk: "low",
    workflow: "Lectura de citas y actualización de estado 'Confirmado por WhatsApp'.",
    wording: "Si Deskcomm lee la agenda de Gesden y nos ahorra la doble entrada, nos quedamos a largo plazo.",
    intent: [false, true, true, true, false],
  },
  {
    id: "p10-es-009", name: "Clínica Dental Retiro Norte", country: "Spain", city: "Madrid",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 2, appts: 140, baseMin: 220, postMin: 45,
    req: true, block: true, blockedEur: 99, risk: "high",
    workflow: "Sincronización de citas de Gesden para no requerir doble agenda.",
    wording: "No contratamos en su momento porque la recepcionista se negó a llevar dos agendas.",
    intent: [false, false, true, true, false],
  },
  {
    id: "p10-es-010", name: "Dental Studio Gràcia Barcelona", country: "Spain", city: "Barcelona",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 3, appts: 155, baseMin: 230, postMin: 45,
    req: true, block: true, blockedEur: 99, risk: "high",
    workflow: "Lectura de citas para recordatorios y creación de cita en Gesden desde Deskcomm.",
    wording: "Sin sincronización con Gesden es imposible. El doctor titular no autoriza el gasto si hay que reescribir citas.",
    intent: [false, false, false, true, true],
  },

  // Portugal (10 Clinics)
  {
    id: "p10-pt-001", name: "Clínica Dentária Marquês de Pombal", country: "Portugal", city: "Lisboa",
    pms: "NewSoft DS", version: "NewSoft NDent v24", users: 2, appts: 135, baseMin: 180, postMin: 35,
    req: true, block: false, risk: "low",
    workflow: "Leitura da agenda do NewSoft para envio automático de lembretes e seguimento.",
    wording: "O NewSoft gere todo o consultório. Se o Deskcomm puder ler as consultas do dia, poupa-nos horas.",
    intent: [false, true, true, true, false],
  },
  {
    id: "p10-pt-002", name: "Instituto Dentário Chiado Lisboa", country: "Portugal", city: "Lisboa",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 2, appts: 115, baseMin: 165, postMin: 30,
    req: true, block: false, risk: "low",
    workflow: "Leitura de agenda para automatizar confirmações por WhatsApp.",
    wording: "Usamos o Gesden em Portugal há anos. Não pretendemos mudar de software clínico.",
    intent: [false, false, true, true, false],
  },
  {
    id: "p10-pt-003", name: "Clínica Médica Dentária Saldanha", country: "Portugal", city: "Lisboa",
    pms: "NewSoft DS", version: "NewSoft NDent v24", users: 3, appts: 170, baseMin: 215, postMin: 40,
    req: true, block: false, risk: "medium",
    workflow: "Sincronização de contactos de pacientes e leitura de agenda.",
    wording: "Trabalhamos com o NewSoft há mais de 8 anos. A integração de contactos facilitaria imenso.",
    intent: [false, true, true, true, false],
  },
  {
    id: "p10-pt-004", name: "Clínica Dentária Boavista Porto", country: "Portugal", city: "Porto",
    pms: "NewSoft DS", version: "NewSoft NDent v24", users: 2, appts: 145, baseMin: 190, postMin: 35,
    req: true, block: false, risk: "low",
    workflow: "Leitura de marcações para Deskcomm disparar mensagens com antecedência de 48h e 24h.",
    wording: "O NewSoft não tem boa comunicação por WhatsApp. Se o Deskcomm for a camada de conversa, é ideal.",
    intent: [false, true, true, true, false],
  },
  {
    id: "p10-pt-005", name: "Instituto Dentário Foz do Douro", country: "Portugal", city: "Porto",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 2, appts: 110, baseMin: 155, postMin: 30,
    req: true, block: false, risk: "low",
    workflow: "Coexistência de leitura: Deskcomm consulta marcações e não altera prontuários.",
    wording: "Tudo o que seja clínico fica no Gesden. O Deskcomm deve ser só para comunicação e lembretes.",
    intent: [false, false, true, true, false],
  },
  {
    id: "p10-pt-006", name: "Clínica Médica Dentária Cedofeita", country: "Portugal", city: "Porto",
    pms: "NewSoft DS", version: "NewSoft NDent v24", users: 3, appts: 160, baseMin: 200, postMin: 40,
    req: true, block: false, risk: "low",
    workflow: "Importação e reconciliação de contactos pelo número de telemóvel.",
    wording: "Perdemos muito tempo a apontar telefones em papel para depois lançar no NewSoft.",
    intent: [false, true, true, true, false],
  },
  {
    id: "p10-pt-007", name: "Clínica Dentária Avenida Central", country: "Portugal", city: "Braga",
    pms: "NewSoft DS", version: "NewSoft NDent v24", users: 2, appts: 120, baseMin: 170, postMin: 30,
    req: true, block: false, risk: "low",
    workflow: "Leitura de agenda diária para lista de transmissão/lembretes.",
    wording: "Queremos manter o NewSoft como base e o Deskcomm para atender e marcar no WhatsApp.",
    intent: [false, false, true, true, false],
  },
  {
    id: "p10-pt-008", name: "Instituto Dentário Bom Jesus", country: "Portugal", city: "Braga",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 2, appts: 100, baseMin: 150, postMin: 30,
    req: false, block: false, risk: "low",
    workflow: "Trabalham com duas janelas sem urgência imediata de ponte técnica.",
    wording: "Estamos habituadas a usar duas janelas no computador, mas se houver leitura de agenda aceitamos.",
    intent: [true, false, true, false, false],
  },
  {
    id: "p10-pt-009", name: "Clínica Médica Dentária São Victor", country: "Portugal", city: "Braga",
    pms: "NewSoft DS", version: "NewSoft NDent v24", users: 2, appts: 130, baseMin: 185, postMin: 35,
    req: true, block: true, blockedEur: 99, risk: "high",
    workflow: "Leitura e inserção autorizada de marcações no NewSoft.",
    wording: "O médico dentista titular só autoriza a subscrição se garantirmos que a receção não faz trabalho duplicado.",
    intent: [false, false, true, true, false],
  },
  {
    id: "p10-pt-010", name: "Centro Odontológico Bonfim", country: "Portugal", city: "Porto",
    pms: "Gesden", version: "G5 Desktop (v5.8)", users: 3, appts: 150, baseMin: 215, postMin: 40,
    req: true, block: true, blockedEur: 99, risk: "high",
    workflow: "Sincronização bidirecional em tempo real para dispensar marcação dupla.",
    wording: "Solicitaram sincronização bidirecional em tempo real com Gesden desktop para dispensar marcação dupla.",
    intent: [false, false, false, false, true],
  },
];

export function generatePilot10DiscoveryRecords(): ClinicPmsDiscoveryRecord[] {
  return CLINIC_SEEDS.map((s) => ({
    id: s.id,
    clinicName: s.name,
    country: s.country,
    city: s.city,
    pmsName: s.pms,
    pmsVersion: s.version,
    deployment: s.cloud ? "cloud" : "desktop_local",
    sourceOfTruthPatientIdentity: "PMS",
    sourceOfTruthAppointments: "PMS",
    sourceOfTruthClinicalRecord: "PMS",
    sourceOfTruthBilling: "PMS",
    receptionUsersCount: s.users,
    appointmentsPerWeek: s.appts,
    duplicateEntryWorkflow: s.workflow,
    baselineDuplicateEntryMinutesPerWeek: s.baseMin,
    postBridgeDuplicateEntryMinutesPerWeek: s.postMin,
    integrationRequested: s.req,
    salesBlocking: s.block,
    exactRequestedWorkflow: s.workflow,
    rawClinicWording: s.wording,
    revenueBlockedEur: s.blockedEur ?? 0,
    churnRisk: s.risk,
    commercialIntent: {
      wouldBuyWithoutIntegration: s.intent[0],
      wouldBuyWithContactSync: s.intent[1],
      wouldBuyWithCalendarRead: s.intent[2],
      wouldBuyWithCalendarWrite: s.intent[3],
      requiresFullBidirectionalSync: s.intent[4],
    },
  }));
}
