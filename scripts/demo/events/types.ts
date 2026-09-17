/**
 * scripts/demo/events/types.ts
 *
 * Types for Demo Platform Event Bus.
 * Decoupled, asynchronous, replayable event distribution.
 */

export interface DemoBusEvent {
  id: string;
  topic: string;
  tenantId?: string;
  payload: Record<string, unknown>;
  emittedAt: string;
}

export type DemoEventHandler = (event: DemoBusEvent) => Promise<void> | void;

export interface DemoEventSubscriber {
  id: string;
  topic: string; // Wildcard "*" or specific topic
  handler: DemoEventHandler;
}

export interface SubscriptionHandle {
  id: string;
  topic: string;
  unsubscribe: () => void;
}
