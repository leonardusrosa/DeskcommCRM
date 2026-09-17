/**
 * scripts/demo/lib/demo-gesden-track.ts
 *
 * Track B: Gesden vendor certification dossier and interim export/import ledger.
 * Manages Henry Schein One partner onboarding questionnaire, commercial ledger,
 * and interim export_import_v1 workflow while vendor certification is pending.
 */

import type { GesdenVendorDossier } from "@/types/demo-pilot-11";

export const GESDEN_PARTNER_QUESTIONNAIRE = [
  {
    question: "Is Gesden G5 covered by an integration partner/API program?",
    answer:
      "Sim, através do Programa de Integradores Homologados Henry Schein One / Infomed Espanha, que fornece SDK e middleware local autenticado.",
    confirmed: true,
  },
  {
    question: "Is patient/contact read available?",
    answer: "Sim, leitura administrativa autorizada via SDK local e exportação estruturada XML.",
    confirmed: true,
  },
  {
    question: "Is appointment read available?",
    answer: "Sim, leitura da agenda para fins de confirmação e envio de notificações.",
    confirmed: true,
  },
  {
    question: "Is appointment create/update available?",
    answer: "Restrito ao Nível 2 de homologação de parceiros com auditoria de integridade médica.",
    confirmed: false,
  },
  {
    question: "What authentication mechanism is used?",
    answer: "Chave de parceiro corporativo + token de instalação local emitido pela Henry Schein.",
    confirmed: true,
  },
  {
    question: "Is local middleware required?",
    answer: "Sim, para as versões Gesden G5 Desktop locais em Microsoft SQL Server.",
    confirmed: true,
  },
  {
    question: "Is a cloud relay available?",
    answer: "Apenas para clientes migrados para a solução Gesden One (Cloud).",
    confirmed: true,
  },
  {
    question: "What security certifications are required?",
    answer: "Acordo formal de tratamento de dados (DPA) RGPD e certificação técnica de segurança.",
    confirmed: true,
  },
  {
    question: "What commercial/vendor fees apply?",
    answer: "Taxa anual de certificação de parceiro e suporte técnico a integradores.",
    confirmed: true,
  },
  {
    question: "Is there a sandbox or test license?",
    answer: "Disponibilizado após assinatura do memorando de parceria com a Henry Schein Espanha.",
    confirmed: true,
  },
  {
    question: "What geographic rights cover Spain/Portugal?",
    answer: "Cobertura ibérica completa sob a divisão Henry Schein One Iberia.",
    confirmed: true,
  },
  {
    question: "What release/version compatibility guarantees exist?",
    answer: "Garantia de retrocompatibilidade para versões G5 (v5.6 a v5.8).",
    confirmed: true,
  },
];

export function getGesdenVendorDossier(): GesdenVendorDossier {
  return {
    vendorName: "Infomed / Henry Schein One Iberia",
    targetProduct: "Gesden G5 Desktop",
    partnerProgramAvailable: true,
    officialApiConfirmed: false, // Desktop uses local partner middleware SDK, not open public REST API
    questionnaireAnswered: true,
    localMiddlewareRequired: true,
    cloudRelayAvailable: false,
    partnerStatus: "PARTNER_PROCESS_PENDING",
    interimPath: "EXPORT_IMPORT_V1",
    clinicsWaiting: 13,
    mrrWaitingEur: 297,
    manualMinutesPerWeek: 195,
  };
}

export function evaluateGesdenInterimBurden(clinicsWaiting: number): {
  weeklyOperatorMinutesTotal: number;
  monthlyHoursTotal: number;
  unblockedMrrPotentialEur: number;
} {
  const weeklyPerClinic = 195;
  const totalWeeklyMin = clinicsWaiting * weeklyPerClinic;
  return {
    weeklyOperatorMinutesTotal: totalWeeklyMin,
    monthlyHoursTotal: parseFloat(((totalWeeklyMin * 4.2) / 60).toFixed(1)),
    unblockedMrrPotentialEur: clinicsWaiting * 99,
  };
}
