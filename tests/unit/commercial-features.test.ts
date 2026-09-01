import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMMERCIAL_FEATURES,
  GOOGLE_REVIEW_DEFAULT_TEMPLATE,
  commercialFeaturesSchema,
  parseCommercialFeatures,
  renderGoogleReviewMessage,
  settingsWithCommercialFeatures,
} from "@/lib/crm/commercial-features";

describe("commercial features", () => {
  it("falls back to the complete product defaults when settings are absent", () => {
    expect(parseCommercialFeatures(null)).toEqual(DEFAULT_COMMERCIAL_FEATURES);
  });

  it("falls back to the complete defaults instead of mixing a corrupt partial config", () => {
    const parsed = parseCommercialFeatures({
      commercial_features: {
        google_review: { enabled: true },
      },
    });
    expect(parsed).toEqual(DEFAULT_COMMERCIAL_FEATURES);
  });

  it("requires a direct https URL before Review Lite can be enabled", () => {
    const invalid = commercialFeaturesSchema.safeParse({
      ...DEFAULT_COMMERCIAL_FEATURES,
      google_review: {
        ...DEFAULT_COMMERCIAL_FEATURES.google_review,
        enabled: true,
        review_url: "",
      },
    });
    expect(invalid.success).toBe(false);
  });

  it("accepts an enabled Review Lite config with an https review URL", () => {
    const valid = commercialFeaturesSchema.safeParse({
      ...DEFAULT_COMMERCIAL_FEATURES,
      google_review: {
        ...DEFAULT_COMMERCIAL_FEATURES.google_review,
        enabled: true,
        review_url: "https://g.page/r/example/review",
      },
    });
    expect(valid.success).toBe(true);
  });

  it("renders the configured direct review URL without inventing review content", () => {
    const config = commercialFeaturesSchema.parse({
      ...DEFAULT_COMMERCIAL_FEATURES,
      google_review: {
        enabled: true,
        review_url: "https://g.page/r/example/review",
        message_template: GOOGLE_REVIEW_DEFAULT_TEMPLATE,
      },
    });
    const message = renderGoogleReviewMessage(config);
    expect(message).toContain("https://g.page/r/example/review");
    expect(message).not.toContain("{{google_review_url}}");
  });

  it("preserves unrelated organization settings on save", () => {
    const original = {
      llm: { provider: "openrouter" },
      branding: { display_name: "Acme" },
      business_profile: { description: "Consultoria" },
      future_key: { untouched: true },
    };
    const next = settingsWithCommercialFeatures(original, {
      ...DEFAULT_COMMERCIAL_FEATURES,
      google_review: {
        ...DEFAULT_COMMERCIAL_FEATURES.google_review,
        review_url: "https://g.page/r/example/review",
      },
    });

    expect(next.llm).toEqual(original.llm);
    expect(next.branding).toEqual(original.branding);
    expect(next.business_profile).toEqual(original.business_profile);
    expect(next.future_key).toEqual(original.future_key);
  });

  it("locks booking provider to Google Calendar and Copilot to read-only in v1", () => {
    expect(DEFAULT_COMMERCIAL_FEATURES.booking.provider).toBe("google_calendar");
    expect(DEFAULT_COMMERCIAL_FEATURES.copilot.mode).toBe("read_only");
  });
});
