import { z } from "zod";

/**
 * Product contract for the small commercial features that live around the CRM.
 *
 * Deliberately stored in organizations.settings instead of a new table: these are
 * tenant knobs, not runtime credentials. Google OAuth tokens MUST NOT be added
 * here when Calendar is wired; they belong in a dedicated encrypted connection.
 */
export const GOOGLE_REVIEW_DEFAULT_TEMPLATE = `Aproveitando...

Sua avaliação no Google é muito importante para o nosso escritório e ajuda outras pessoas a conhecerem nosso trabalho.

Você pode contar brevemente como foi o atendimento, a clareza das orientações e o acompanhamento do seu caso, sem mencionar informações pessoais.

Avalie pelo link:
{{google_review_url}}`;

export const DEFAULT_COMMERCIAL_FEATURES = {
  google_review: {
    enabled: false,
    review_url: "",
    message_template: GOOGLE_REVIEW_DEFAULT_TEMPLATE,
  },
  copilot: {
    mode: "read_only" as const,
  },
  booking: {
    provider: "google_calendar" as const,
    slot_duration_minutes: 30,
    buffer_minutes: 10,
    booking_horizon_days: 30,
  },
};

const httpsUrlOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https:\/\//i.test(value), {
    message: "A URL de avaliação precisa começar com https://",
  });

export const commercialFeaturesSchema = z
  .object({
    google_review: z.object({
      enabled: z.boolean(),
      review_url: httpsUrlOrEmpty,
      message_template: z.string().trim().min(1).max(4_000),
    }),
    copilot: z.object({
      // v1 is intentionally human-in-the-loop. This value is a product invariant,
      // not a switch that grants the model write access to CRM data.
      mode: z.literal("read_only"),
    }),
    booking: z.object({
      provider: z.literal("google_calendar"),
      slot_duration_minutes: z.number().int().min(10).max(240),
      buffer_minutes: z.number().int().min(0).max(240),
      booking_horizon_days: z.number().int().min(1).max(365),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.google_review.enabled && !value.google_review.review_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["google_review", "review_url"],
        message: "Informe o link direto de avaliação antes de ativar o Review Lite.",
      });
    }
  });

export type CommercialFeatures = z.infer<typeof commercialFeaturesSchema>;

function cloneDefaults(): CommercialFeatures {
  return {
    google_review: { ...DEFAULT_COMMERCIAL_FEATURES.google_review },
    copilot: { ...DEFAULT_COMMERCIAL_FEATURES.copilot },
    booking: { ...DEFAULT_COMMERCIAL_FEATURES.booking },
  };
}

/** Corrupt/legacy JSON never makes the settings screen unusable. */
export function parseCommercialFeatures(settings: unknown): CommercialFeatures {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return cloneDefaults();
  const raw = (settings as Record<string, unknown>).commercial_features;
  const parsed = commercialFeaturesSchema.safeParse(raw);
  return parsed.success ? parsed.data : cloneDefaults();
}

/** Non-destructive merge: llm, branding, business_profile and future keys survive. */
export function settingsWithCommercialFeatures(
  settings: unknown,
  config: CommercialFeatures,
): Record<string, unknown> {
  const base =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  return { ...base, commercial_features: config };
}

/**
 * Review Lite never invents review text for the customer. It only prepares the
 * organization's request message and substitutes the direct Google review URL.
 */
export function renderGoogleReviewMessage(config: CommercialFeatures): string {
  return config.google_review.message_template.replaceAll(
    "{{google_review_url}}",
    config.google_review.review_url,
  );
}
