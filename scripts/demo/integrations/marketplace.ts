/**
 * scripts/demo/integrations/marketplace.ts
 *
 * Enterprise Integrations Marketplace Registry.
 * Defines supported integrations across CRM, Messaging, and Automation platforms.
 */

export type IntegrationCategory = "crm" | "messaging" | "automation";
export type IntegrationStatus = "connected" | "configured" | "available";

export interface IntegrationItem {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  authType: "api_key" | "oauth2" | "webhook";
  status: IntegrationStatus;
  docsUrl: string;
  healthRatePercentage: number;
  lastSyncAt?: string;
  requiredScopes?: string[];
}

export const INTEGRATIONS_REGISTRY: IntegrationItem[] = [
  // CRM
  {
    id: "hubspot",
    name: "HubSpot CRM",
    category: "crm",
    description: "Sincronización bidireccional de contactos, tratos clínicos y actividades comerciales.",
    authType: "oauth2",
    status: "connected",
    docsUrl: "https://developers.hubspot.com",
    healthRatePercentage: 98,
    lastSyncAt: new Date(Date.now() - 15 * 60000).toISOString(),
    requiredScopes: ["crm.objects.contacts.read", "crm.objects.deals.write"],
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    category: "crm",
    description: "Exportación directa de oportunidades ganadas y actualización de etapas de venta.",
    authType: "api_key",
    status: "configured",
    docsUrl: "https://developers.pipedrive.com",
    healthRatePercentage: 95,
    lastSyncAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: "salesforce",
    name: "Salesforce Health Cloud",
    category: "crm",
    description: "Integración empresarial para redes de policlínicos y aseguradoras de salud.",
    authType: "oauth2",
    status: "available",
    docsUrl: "https://developer.salesforce.com",
    healthRatePercentage: 100,
  },

  // Messaging
  {
    id: "whatsapp_evolution",
    name: "WhatsApp (Evolution API)",
    category: "messaging",
    description: "Envío nativo de recordatorios de citas, confirmaciones de asistencia y chats en vivo.",
    authType: "api_key",
    status: "connected",
    docsUrl: "https://evolution-api.com",
    healthRatePercentage: 99,
    lastSyncAt: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: "resend_email",
    name: "Resend Email",
    category: "messaging",
    description: "Entrega transaccional de propuestas comerciales y confirmaciones con DKIM/SPF.",
    authType: "api_key",
    status: "connected",
    docsUrl: "https://resend.com",
    healthRatePercentage: 100,
    lastSyncAt: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: "slack_alerts",
    name: "Slack Commercial Alerts",
    category: "messaging",
    description: "Canal de notificaciones instantáneas para prospectos de alta intención y alertas de SLA.",
    authType: "webhook",
    status: "connected",
    docsUrl: "https://api.slack.com",
    healthRatePercentage: 100,
    lastSyncAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },

  // Automation
  {
    id: "webhook_outbound",
    name: "Webhooks Salientes",
    category: "automation",
    description: "Disparo seguro de eventos comerciales a endpoints HTTP externos con firma HMAC.",
    authType: "webhook",
    status: "connected",
    docsUrl: "/docs/webhooks",
    healthRatePercentage: 99,
    lastSyncAt: new Date(Date.now() - 1 * 60000).toISOString(),
  },
  {
    id: "make_integromat",
    name: "Make.com (Integromat)",
    category: "automation",
    description: "Conexión con miles de aplicaciones mediante escenarios automatizados sin código.",
    authType: "api_key",
    status: "available",
    docsUrl: "https://make.com",
    healthRatePercentage: 100,
  },
  {
    id: "zapier",
    name: "Zapier Platform",
    category: "automation",
    description: "Automatización de tareas con Google Sheets, calendarios y bases de datos externas.",
    authType: "oauth2",
    status: "available",
    docsUrl: "https://zapier.com",
    healthRatePercentage: 100,
  },
];

export function listMarketplaceIntegrations(category?: IntegrationCategory): IntegrationItem[] {
  if (!category) return INTEGRATIONS_REGISTRY;
  return INTEGRATIONS_REGISTRY.filter((item) => item.category === category);
}

export function getMarketplaceIntegration(id: string): IntegrationItem | null {
  return INTEGRATIONS_REGISTRY.find((item) => item.id === id) || null;
}
