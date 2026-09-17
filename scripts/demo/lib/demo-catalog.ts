/**
 * scripts/demo/lib/demo-catalog.ts
 *
 * Demo Profiles Marketplace Catalog.
 * Curates specialized vertical industry environments for prospective clients.
 */

export interface DemoCatalogProfile {
  id: string;
  name: string;
  vertical: string;
  category: "Odontología" | "Estética & Salud" | "Veterinaria" | "Medicina General";
  tagline: string;
  description: string;
  defaultCountry: string;
  recommendedPlan: "starter" | "professional" | "enterprise";
  highlights: string[];
  sampleFeatures: string[];
}

export const DEMO_CATALOG_PROFILES: DemoCatalogProfile[] = [
  {
    id: "profile_dental_specialist",
    name: "Clínica Odontológica Especializada",
    vertical: "dental-clinic",
    category: "Odontología",
    tagline: "Ortodoncia, implantología y estética dental",
    description: "Ambiente preconfigurado con agenda multiespecialista, confirmación automática de citas por WhatsApp y presupuestos odontológicos.",
    defaultCountry: "CO",
    recommendedPlan: "professional",
    highlights: ["4 odontólogos", "2 sillones clínicos", "Recordatorios WhatsApp"],
    sampleFeatures: ["Google Calendar sincronizado", "Pipeline de ortodoncia", "Ficha clínica"],
  },
  {
    id: "profile_aesthetic_dermatology",
    name: "Centro de Estética & Dermatología",
    vertical: "aesthetic-clinic",
    category: "Estética & Salud",
    tagline: "Tratamientos faciales, corporales y medicina láser",
    description: "Flujos comerciales diseñados para paquetes estéticos de alta recurrencia, control de sesiones y seguimiento post-procedimiento.",
    defaultCountry: "MX",
    recommendedPlan: "enterprise",
    highlights: ["Tratamientos en paquete", "Seguimiento fotográfico", "Pagos por sesión"],
    sampleFeatures: ["Agenda de aparatología", "Encuestas de satisfacción", "Campañas de fidelización"],
  },
  {
    id: "profile_veterinary_care",
    name: "Hospital Veterinario & Urgencias",
    vertical: "veterinary",
    category: "Veterinaria",
    tagline: "Medicina canina, felina y cirugías programadas",
    description: "Control integrado de recordatorios de vacunación, hospitalización y citas preventivas para animales de compañía.",
    defaultCountry: "ES",
    recommendedPlan: "professional",
    highlights: ["Calendario de vacunación", "Mascotas vinculadas", "Emergencias"],
    sampleFeatures: ["Historial por mascota", "Notificaciones de desparasitación", "Agenda por sala"],
  },
  {
    id: "profile_medical_polyclinic",
    name: "Policlínico Médico Multidisciplinar",
    vertical: "medical-center",
    category: "Medicina General",
    tagline: "Consultas médicas, análisis clínicos y fisioterapia",
    description: "Gestión avanzada multiconsultorio para centros médicos con alta afluencia de pacientes y derivaciones internas.",
    defaultCountry: "BR",
    recommendedPlan: "enterprise",
    highlights: ["Múltiples consultorios", "Turnos por especialista", "Multi-recepción"],
    sampleFeatures: ["Recepción digital", "Bloqueos de agenda médica", "Teleconsulta integrada"],
  },
];

export function listDemoCatalogProfiles(): DemoCatalogProfile[] {
  return DEMO_CATALOG_PROFILES;
}

export function getDemoCatalogProfile(id: string): DemoCatalogProfile | null {
  return DEMO_CATALOG_PROFILES.find((p) => p.id === id || p.vertical === id) || null;
}
