import type { DemoCountry } from "./types";

export interface DentalDemoCatalogCard {
  country: DemoCountry;
  countryName: string;
  flag: string;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  included: string[];
}

export const DENTAL_DEMO_CATALOG: DentalDemoCatalogCard[] = [
  {
    country: "CO",
    countryName: "Colombia",
    flag: "🇨🇴",
    title: "Clínica Dental — Colombia",
    tagline: "Recepción por WhatsApp, seguimiento comercial y agenda odontológica",
    description:
      "Entorno sintético preparado para mostrar el flujo completo desde una consulta por WhatsApp hasta la cita y el seguimiento en CRM.",
    highlights: ["Bogotá · COP · +57", "Equipo de recepción + odontólogos", "Datos 100% sintéticos"],
    included: ["Inbox WhatsApp de demostración", "Pipeline dental", "Agenda multi-profesional", "Servicios odontológicos"],
  },
  {
    country: "MX",
    countryName: "México",
    flag: "🇲🇽",
    title: "Clínica Dental — México",
    tagline: "Prospectos, tratamientos y agenda para equipos odontológicos",
    description:
      "Demo sintética localizada para México con conversaciones, contactos, oportunidades y citas listas para recorrer durante una presentación.",
    highlights: ["CDMX · MXN · +52", "Flujo de tratamientos", "Datos 100% sintéticos"],
    included: ["Inbox WhatsApp de demostración", "Pipeline dental", "Agenda multi-profesional", "Servicios odontológicos"],
  },
  {
    country: "ES",
    countryName: "España",
    flag: "🇪🇸",
    title: "Clínica Dental — España",
    tagline: "Atención, oportunidades comerciales y citas en un único flujo",
    description:
      "Entorno sintético para enseñar cómo recepción y especialistas comparten conversaciones, oportunidades y agenda sin convertir Deskcomm en historia clínica.",
    highlights: ["Madrid · EUR · +34", "Equipo multi-especialista", "Datos 100% sintéticos"],
    included: ["Inbox WhatsApp de demostración", "Pipeline dental", "Agenda nativa", "Seguimiento comercial"],
  },
  {
    country: "PT",
    countryName: "Portugal",
    flag: "🇵🇹",
    title: "Clínica Dentária — Portugal",
    tagline: "Receção, contactos e agenda para equipas de medicina dentária",
    description:
      "Ambiente sintético em português europeu para demonstrar atendimento por WhatsApp, acompanhamento comercial e agenda sem substituir o software clínico.",
    highlights: ["Lisboa · EUR · +351", "Vocabulário pt-PT", "Dados 100% sintéticos"],
    included: ["Inbox WhatsApp de demonstração", "Pipeline dentário", "Agenda multi-profissional", "Serviços dentários"],
  },
];

export function getCatalogCard(country: string): DentalDemoCatalogCard | null {
  return DENTAL_DEMO_CATALOG.find((card) => card.country === country.toUpperCase()) || null;
}
