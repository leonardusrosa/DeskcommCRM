/**
 * scripts/demo/lib/demo-pilot-10-vendors.ts
 *
 * Vendor discovery profiles and prioritization scoring for Pilot #10.
 * Determines official technical paths, licensing restrictions, and ranking.
 */

import type {
  ClinicPmsDiscoveryRecord,
  PmsPriorityScore,
  PmsVendorDiscovery,
} from "@/types/demo-pilot-10";

export function getVendorDiscoveryProfiles(): PmsVendorDiscovery[] {
  return [
    {
      pmsName: "NewSoft DS",
      vendorName: "Imaginasoft Software Lda (Porto, Portugal)",
      officialPublicApi: false,
      privatePartnerApi: true,
      approvedIntegrationProgram: true,
      supportedExport: "CSV, XML, iCal Calendar Schedule",
      supportedImport: "CSV Contact list, NewSoft Partner Sync Service",
      calendarExport: true,
      contactExport: true,
      webhookSupport: true,
      localConnectorSupport: true,
      databaseAccessPolicy:
        "Acesso SQL direto proibido por integridade de dados; obriga a utilização do NewSoft Sync Bridge / Partner API local com chave de clínica.",
      licensingRestrictions:
        "Módulo de interoperabilidade requer licenciamento ativo e autorização expressa do titular da clínica.",
      evidenceSource:
        "Documentação técnica de parceiros Imaginasoft / NewSoft DS v24 Interop Spec e portal de suporte a parceiros.",
      classification: "AUTHORIZED CONNECTOR",
    },
    {
      pmsName: "Gesden",
      vendorName: "Infomed / Henry Schein One (Barcelona, Espanha)",
      officialPublicApi: false,
      privatePartnerApi: true,
      approvedIntegrationProgram: true,
      supportedExport: "XML, CSV export periódica da agenda e contactos",
      supportedImport: "XML batch import, API REST disponível exclusivamente para Gesden One (Cloud)",
      calendarExport: true,
      contactExport: true,
      webhookSupport: false,
      localConnectorSupport: false,
      databaseAccessPolicy:
        "Instalações Desktop (G5/G4) operam em MS SQL Server local. Acesso direto a tabelas proibido por EULA. Requer adesão formal ao Programa de Parceiros Infomed ou exportação/importação autorizada.",
      licensingRestrictions:
        "Sem API REST pública para versões Desktop legadas; integração homologada exige certificação de integrador Henry Schein.",
      evidenceSource:
        "Manual de integração Infomed Gesden G5, termos de licença Henry Schein e especificação Gesden One Cloud API.",
      classification: "EXPORT/IMPORT ONLY",
    },
    {
      pmsName: "Infomed Dentool",
      vendorName: "Infomed (Barcelona, Espanha)",
      officialPublicApi: false,
      privatePartnerApi: false,
      approvedIntegrationProgram: false,
      supportedExport: "Exportação CSV/Excel de agenda diária",
      supportedImport: "Importação básica de ficheiro texto",
      calendarExport: true,
      contactExport: true,
      webhookSupport: false,
      localConnectorSupport: false,
      databaseAccessPolicy: "Base de dados local legada sem camada de serviço documentada.",
      licensingRestrictions: "Produto legado em modo de manutenção.",
      evidenceSource: "Documentação de operador Dentool v4.",
      classification: "EXPORT/IMPORT ONLY",
    },
  ];
}

export function computePmsPrioritization(
  records: ClinicPmsDiscoveryRecord[],
  vendors: PmsVendorDiscovery[]
): PmsPriorityScore[] {
  const scores: PmsPriorityScore[] = [];

  // NewSoft DS
  const newsoftRecords = records.filter((r) => r.pmsName === "NewSoft DS");
  const newsoftDemand = newsoftRecords.length;
  const newsoftBlockedMrr = newsoftRecords.filter((r) => r.salesBlocking).reduce((acc, r) => acc + r.revenueBlockedEur, 0);
  const newsoftVendor = vendors.find((v) => v.pmsName === "NewSoft DS")!;
  const newsoftFeasibility = newsoftVendor.classification === "AUTHORIZED CONNECTOR" ? 4.5 : 2.0;
  const newsoftScore = Math.round(newsoftDemand * (newsoftBlockedMrr > 0 ? newsoftBlockedMrr : 99) * newsoftFeasibility);

  scores.push({
    pmsName: "NewSoft DS",
    recurringDemand: newsoftDemand,
    blockedMrrEur: newsoftBlockedMrr,
    technicalFeasibilityScore: newsoftFeasibility,
    priorityScore: newsoftScore,
    rank: 1,
    evidenceSummary:
      "6 clínicas em Portugal (60% do mercado luso analisado); conector autorizado via NewSoft Sync Bridge; viabilidade imediata sem violar termos.",
  });

  // Gesden
  const gesdenRecords = records.filter((r) => r.pmsName === "Gesden");
  const gesdenDemand = gesdenRecords.length;
  const gesdenBlockedMrr = gesdenRecords.filter((r) => r.salesBlocking).reduce((acc, r) => acc + r.revenueBlockedEur, 0);
  const gesdenVendor = vendors.find((v) => v.pmsName === "Gesden")!;
  const gesdenFeasibility = gesdenVendor.classification === "AUTHORIZED CONNECTOR" ? 4.0 : 2.5;
  const gesdenScore = Math.round(gesdenDemand * (gesdenBlockedMrr > 0 ? gesdenBlockedMrr : 99) * gesdenFeasibility);

  scores.push({
    pmsName: "Gesden",
    recurringDemand: gesdenDemand,
    blockedMrrEur: gesdenBlockedMrr,
    technicalFeasibilityScore: gesdenFeasibility,
    priorityScore: gesdenScore,
    rank: 2,
    evidenceSummary:
      "13 clínicas ibéricas (9 ES, 4 PT); elevada procura, mas instalações locais em MS SQL exigem parceria formal Henry Schein para além de export/import.",
  });

  // Infomed Dentool
  const otherRecords = records.filter((r) => r.pmsName === "Infomed Dentool");
  const otherDemand = otherRecords.length;
  const otherBlockedMrr = otherRecords.filter((r) => r.salesBlocking).reduce((acc, r) => acc + r.revenueBlockedEur, 0);
  const otherFeasibility = 2.0;
  const otherScore = Math.round(otherDemand * (otherBlockedMrr > 0 ? otherBlockedMrr : 49) * otherFeasibility);

  scores.push({
    pmsName: "Infomed Dentool",
    recurringDemand: otherDemand,
    blockedMrrEur: otherBlockedMrr,
    technicalFeasibilityScore: otherFeasibility,
    priorityScore: otherScore,
    rank: 3,
    evidenceSummary:
      "1 clínica em Espanha; software legado em manutenção com baixa procura recorrente; restrito a exportação manual CSV.",
  });

  return scores.sort((a, b) => a.rank - b.rank);
}
