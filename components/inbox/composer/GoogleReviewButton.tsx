"use client";

import { Button } from "@/components/ui/button";
import { ChatCircle } from "@/lib/ui/icons";
import { renderGoogleReviewMessage } from "@/lib/crm/commercial-features";
import { useCommercialFeatures } from "@/hooks/inbox/useCommercialFeatures";

interface Props {
  onInsert: (text: string) => void;
  disabled?: boolean;
}

/**
 * Review Lite is deliberately human-in-the-loop: this button only fills the
 * composer. It never sends by itself and never asks the AI to manufacture the
 * customer's review text.
 */
export function GoogleReviewButton({ onInsert, disabled }: Props) {
  const query = useCommercialFeatures();
  const config = query.data?.data;

  if (!config?.google_review.enabled || !config.google_review.review_url) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-9 w-9 shrink-0"
      aria-label="Pedir avaliação no Google"
      title="Pedir avaliação no Google"
      disabled={disabled}
      onClick={() => onInsert(renderGoogleReviewMessage(config))}
    >
      <ChatCircle size={18} weight="regular" aria-hidden />
    </Button>
  );
}
