/**
 * scripts/demo/lib/demo-localization.ts
 *
 * Global Localization Engine.
 * Provides multi-lingual translations (es, en, pt), currency formatters (USD, EUR, BRL, MXN, COP),
 * timezone-aware delivery window checks, and regional clinical messaging profiles.
 */

export type SupportedLanguage = "es" | "en" | "pt";
export type SupportedCurrency = "USD" | "EUR" | "BRL" | "MXN" | "COP";

export interface TerritoryConfig {
  countryCode: string;
  name: string;
  language: SupportedLanguage;
  currency: SupportedCurrency;
  timezone: string;
  chairTerm: string; // clinical terminology
  greetingStyle: string;
}

export const TERRITORY_CONFIGS: Record<string, TerritoryConfig> = {
  co: {
    countryCode: "CO",
    name: "Colombia",
    language: "es",
    currency: "COP",
    timezone: "America/Bogota",
    chairTerm: "sillones odontológicos",
    greetingStyle: "cordial y formal (Doctor/a)",
  },
  mx: {
    countryCode: "MX",
    name: "México",
    language: "es",
    currency: "MXN",
    timezone: "America/Mexico_City",
    chairTerm: "sillones dentales",
    greetingStyle: "cálido y directo (Doctor/a)",
  },
  br: {
    countryCode: "BR",
    name: "Brasil",
    language: "pt",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    chairTerm: "cadeiras odontológicas",
    greetingStyle: "dinâmico e profissional (Dr./Dra.)",
  },
  es: {
    countryCode: "ES",
    name: "España",
    language: "es",
    currency: "EUR",
    timezone: "Europe/Madrid",
    chairTerm: "gabinetes dentales",
    greetingStyle: "profesional y corporativo (Estimado/a)",
  },
  pt: {
    countryCode: "PT",
    name: "Portugal",
    language: "pt",
    currency: "EUR",
    timezone: "Europe/Lisbon",
    chairTerm: "gabinetes dentários",
    greetingStyle: "formal e corporativo (Exmo./a)",
  },
  us: {
    countryCode: "US",
    name: "United States",
    language: "en",
    currency: "USD",
    timezone: "America/New_York",
    chairTerm: "operatory chairs",
    greetingStyle: "concise and professional (Dr.)",
  },
};

export const EXCHANGE_RATES_TO_USD: Record<SupportedCurrency, number> = {
  USD: 1.0,
  EUR: 1.08,
  BRL: 0.18,
  MXN: 0.051,
  COP: 0.00024,
};

export function convertCurrency(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
): number {
  if (from === to) return amount;
  const inUsd = amount * (EXCHANGE_RATES_TO_USD[from] ?? 1.0);
  const targetRate = EXCHANGE_RATES_TO_USD[to] ?? 1.0;
  return Math.round((inUsd / targetRate) * 100) / 100;
}

export function formatLocalizedCurrency(
  amount: number,
  currency: SupportedCurrency,
  locale?: string,
): string {
  const targetLocale = locale || (currency === "BRL" ? "pt-BR" : currency === "EUR" ? "es-ES" : currency === "USD" ? "en-US" : "es-CO");
  try {
    return new Intl.NumberFormat(targetLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "COP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function resolveTerritoryConfig(code?: string): TerritoryConfig {
  const normalized = (code || "co").toLowerCase().slice(0, 2);
  return TERRITORY_CONFIGS[normalized] ?? TERRITORY_CONFIGS.co!;
}

export function isWithinTerritoryBusinessHours(
  countryCode: string,
  testDate = new Date(),
): boolean {
  const config = resolveTerritoryConfig(countryCode);
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    });
    const parts = formatter.formatToParts(testDate);
    const hourPart = parts.find((p) => p.type === "hour");
    const weekdayPart = parts.find((p) => p.type === "weekday");

    const hour = hourPart ? parseInt(hourPart.value, 10) : 12;
    const weekday = weekdayPart ? weekdayPart.value.toLowerCase() : "mon";

    if (weekday === "sun") return false;
    if (weekday === "sat") return hour >= 9 && hour < 13;
    return hour >= 8 && hour < 19;
  } catch {
    return true; // fail-open in test environments
  }
}

export interface LocalizedTemplateParams {
  leadName?: string;
  clinicName?: string;
  chairCount?: number;
  planName?: string;
  price?: string;
}

export function getLocalizedSalesMessage(
  key: "welcome" | "proposal" | "expiration",
  countryCode: string,
  params: LocalizedTemplateParams = {},
): { subject: string; body: string } {
  const config = resolveTerritoryConfig(countryCode);
  const name = params.leadName || (config.language === "pt" ? "Doutor(a)" : "Doctor(a)");
  const chairs = params.chairCount ? `${params.chairCount} ${config.chairTerm}` : config.chairTerm;

  if (config.language === "pt") {
    if (key === "welcome") {
      return {
        subject: "Bem-vindo à demonstração Deskcomm Odontologia",
        body: `Olá ${name}, sua clínica digital foi configurada para ${chairs}. Você pode testar os agendamentos pelo WhatsApp imediatamente.`,
      };
    }
    if (key === "proposal") {
      return {
        subject: "Proposta Comercial Deskcomm — Condições Especiais",
        body: `Prezado(a) ${name}, anexamos a proposta para o plano ${params.planName || "Profissional"} (${params.price || ""}). Ficamos à disposição para esclarecimentos.`,
      };
    }
    return {
      subject: "Aviso: Demonstração Deskcomm expirando",
      body: `Olá ${name}, restam 24 horas para o término do seu período de testes. Deseja agendar uma sessão com nosso especialista?`,
    };
  }

  if (config.language === "en") {
    if (key === "welcome") {
      return {
        subject: "Welcome to your Deskcomm Dental Demo",
        body: `Hello ${name}, your practice environment is ready for ${chairs}. Test automated appointment confirmations via WhatsApp today.`,
      };
    }
    if (key === "proposal") {
      return {
        subject: "Deskcomm Proposal — Personalized Terms",
        body: `Dear ${name}, here is your customized proposal for plan ${params.planName || "Professional"} (${params.price || ""}). Let us know if you have questions.`,
      };
    }
    return {
      subject: "Deskcomm Demo Expiring Soon",
      body: `Hello ${name}, your trial expires in 24 hours. Would you like to schedule a 10-minute discovery call?`,
    };
  }

  // Default Spanish (es)
  if (key === "welcome") {
    return {
      subject: "Bienvenido a su demostración interactiva Deskcomm",
      body: `Estimado/a ${name}, su entorno clínico está listo con soporte para ${chairs}. Puede simular el recordatorio de citas por WhatsApp ahora.`,
    };
  }
  if (key === "proposal") {
    return {
      subject: "Propuesta Comercial Deskcomm Odontología",
      body: `Estimado/a ${name}, le compartimos la propuesta económica para el plan ${params.planName || "Profesional"} (${params.price || ""}). Quedamos atentos para asesorarle.`,
    };
  }
  return {
    subject: "Su demostración de Deskcomm está por finalizar",
    body: `Estimado/a ${name}, su acceso de prueba finaliza en 24 horas. ¿Desea coordinar una llamada de 10 minutos con nuestro consultor?`,
  };
}
