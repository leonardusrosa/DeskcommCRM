/**
 * scripts/demo/profiles/dental-clinic/spain.ts
 *
 * Sales Demo Profile — Dental Clinic Spain 🇪🇸
 */

import type { DemoProfile } from "../types";

export const spainDentalProfile: DemoProfile = {
  id: "dental-clinic-spain",
  category: "dental-clinic",
  country: "ES",
  flag: "🇪🇸",
  orgName: "Clínica Sonrisa Madrid",
  legalName: "Clínica Sonrisa Madrid S.L.",
  slug: "clinica-sonrisa-madrid",
  language: "es",
  timezone: "Europe/Madrid",
  industry: "Dental Clinic",
  scenario: {
    title: "Clínica Odontológica Barrio Salamanca (Madrid)",
    description: "Demostración de alto nivel para clínicas dentales privadas en España: captación digital, propuestas de tratamientos estéticos e implantología premium.",
    keyHighlights: [
      "Canal WhatsApp integrado con triaje ágil y respuestas contextuales",
      "Pipeline de ventas configurado para optimizar presupuestos y conversión de primeras visitas",
      "Agenda con doctores especializados y trazabilidad de citas pasadas y futuras",
    ],
  },
  users: [
    {
      key: "owner",
      name: "Dra. Carmen Navarro",
      email: "carmen@sonrisamadrid.demo",
      role: "admin",
      isProvider: true,
      title: "Directora Médica & Odontóloga",
    },
    {
      key: "operator",
      name: "Lucía Fernández",
      email: "lucia@sonrisamadrid.demo",
      role: "agent",
      isProvider: false,
      title: "Recepción & Coordinación",
    },
    {
      key: "dentist1",
      name: "Dr. Javier Ruiz",
      email: "javier@sonrisamadrid.demo",
      role: "agent",
      isProvider: true,
      title: "Especialista en Implantología y Periodoncia",
    },
    {
      key: "dentist2",
      name: "Dra. Beatriz Santos",
      email: "beatriz@sonrisamadrid.demo",
      role: "agent",
      isProvider: true,
      title: "Especialista en Estética Dental",
    },
  ],
  services: [
    { name: "Primera visita y plan de tratamiento", slug: "consulta-inicial", durationMinutes: 30, description: "Exploración bucodental completa y ortopantomografía", color: "#0284c7" },
    { name: "Higiene bucodental completa", slug: "limpieza-dental", durationMinutes: 60, description: "Limpieza profesional con ultrasonidos y aeropulidor", color: "#10b981" },
    { name: "Blanqueamiento dental Philips Zoom", slug: "blanqueamiento-dental", durationMinutes: 90, description: "Tratamiento intensivo con lámpara de fotoactivación", color: "#f59e0b" },
    { name: "Implante dental de titanio", slug: "implante-dental", durationMinutes: 120, description: "Colocación de fijación de titanio grado médico", color: "#6366f1" },
    { name: "Control y mantenimiento periodontal", slug: "control-post-tratamiento", durationMinutes: 30, description: "Seguimiento periódico de salud gingival", color: "#64748b" },
  ],
  pipeline: {
    name: "Tratamientos Odontológicos",
    slug: "tratamientos-odontologicos",
    stages: [
      { name: "Nuevo contacto", slug: "nuevo_contacto", position: 1 },
      { name: "Primera conversación", slug: "primera_conversacion", position: 2 },
      { name: "Interesado", slug: "interesado", position: 3 },
      { name: "Consulta agendada", slug: "consulta_agendada", position: 4 },
      { name: "Tratamiento vendido", slug: "tratamiento_vendido", position: 5, isWon: true },
      { name: "Paciente recurrente", slug: "paciente_recurrente", position: 6, isWon: true },
    ],
  },
  contacts: [
    {
      name: "Alejandro González",
      phoneNumber: "+34612345678",
      email: "alejandro.gonzalez@example.es",
      status: "new",
      stageSlug: "nuevo_contacto",
      interest: "Blanqueamiento Philips Zoom",
      tags: ["estetica", "lead-nuevo"],
      conversationMessages: [
        { direction: "inbound", body: "Hola buenas, querría consultar sobre el blanqueamiento dental en su clínica de Madrid y si ofrecen primera cita informativa.", hoursAgo: 5 },
        { direction: "outbound", body: "¡Hola Alejandro! Encantados de atenderte. En Clínica Sonrisa Madrid incluimos la valoración inicial y el estudio estético para recomendarte la técnica ideal. ¿Te vendría bien pasar esta semana?", hoursAgo: 4 },
        { direction: "inbound", body: "Sí, perfecto. Prefiero por la tarde con la Dra. Carmen Navarro si es posible.", hoursAgo: 3 },
      ],
    },
    {
      name: "Paula Morales",
      phoneNumber: "+34698765432",
      email: "paula.morales@example.es",
      status: "new",
      stageSlug: "interesado",
      interest: "Implante dental molar",
      tags: ["implantologia", "presupuesto-activo"],
      conversationMessages: [
        { direction: "inbound", body: "Buenas tardes Lucía, tengo el presupuesto que me dio el Dr. Javier Ruiz para los dos implantes. ¿Hay opciones de financiación a 24 meses?", hoursAgo: 30 },
        { direction: "outbound", body: "Hola Paula, ¡por supuesto! Trabajamos con financiación a tu medida hasta 36 meses, los primeros 12 sin intereses. Si te parece, lo formalizamos el día de tu cita.", hoursAgo: 26 },
        { direction: "inbound", body: "Genial, pues déjame agendada la intervención para la próxima semana.", hoursAgo: 16 },
      ],
    },
    {
      name: "Daniel Castro",
      phoneNumber: "+34655443322",
      email: "daniel.castro@example.es",
      status: "won",
      stageSlug: "paciente_recurrente",
      interest: "Revisión anual",
      tags: ["paciente-fidelizado", "higiene"],
      conversationMessages: [
        { direction: "inbound", body: "Hola, me habéis enviado un recordatorio para mi revisión y limpieza anual con la Dra. Beatriz Santos.", hoursAgo: 60 },
        { direction: "outbound", body: "Hola Daniel, efectivamente. Tenemos un hueco disponible el próximo jueves a las 17:00 h con la Dra. Beatriz. ¿Te reservamos esa hora?", hoursAgo: 55 },
        { direction: "inbound", body: "Perfecto, reservádmelo por favor. Gracias como siempre.", hoursAgo: 50 },
      ],
    },
  ],
  appointments: [
    {
      eventTypeSlug: "consulta-inicial",
      patientName: "Alejandro González",
      providerKey: "owner",
      daysOffset: 1,
      localHour: 17,
      localMinute: 0,
      durationMinutes: 30,
      status: "confirmed",
      notes: "Primera visita y estudio estético con Dra. Carmen Navarro.",
    },
    {
      eventTypeSlug: "implante-dental",
      patientName: "Paula Morales",
      providerKey: "dentist1",
      daysOffset: 3,
      localHour: 11,
      localMinute: 0,
      durationMinutes: 120,
      status: "scheduled",
      notes: "Cirugía de colocación de implantes con Dr. Javier Ruiz.",
    },
    {
      eventTypeSlug: "limpieza-dental",
      patientName: "Daniel Castro",
      providerKey: "dentist2",
      daysOffset: 5,
      localHour: 17,
      localMinute: 0,
      durationMinutes: 60,
      status: "scheduled",
      notes: "Higiene bucodental completa y pulido con Dra. Beatriz Santos.",
    },
    {
      eventTypeSlug: "control-post-tratamiento",
      patientName: "Daniel Castro",
      providerKey: "owner",
      daysOffset: -30,
      localHour: 16,
      localMinute: 30,
      durationMinutes: 30,
      status: "completed",
      notes: "Revisión post-tratamiento completada con éxito por Dra. Carmen Navarro.",
    },
  ],
};

export default spainDentalProfile;
