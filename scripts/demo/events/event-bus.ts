/**
 * scripts/demo/events/event-bus.ts
 *
 * Demo Platform Event Bus.
 * Supports publish/subscribe, decoupled consumers, audit log persistence, and event replay.
 * Strictly isolated: stores event log in .demo/demo_event_bus.json.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_DEMO_DIR } from "../lib/demo-session";
import type {
  DemoBusEvent,
  DemoEventHandler,
  DemoEventSubscriber,
  SubscriptionHandle,
} from "./types";

export const DEFAULT_BUS_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_event_bus.json",
);

const subscribers: DemoEventSubscriber[] = [];

export function subscribeDemoEvent(
  topic: string,
  handler: DemoEventHandler,
): SubscriptionHandle {
  const id = crypto.randomUUID();
  const sub: DemoEventSubscriber = { id, topic, handler };
  subscribers.push(sub);

  return {
    id,
    topic,
    unsubscribe: () => {
      const idx = subscribers.findIndex((s) => s.id === id);
      if (idx >= 0) subscribers.splice(idx, 1);
    },
  };
}

export async function publishDemoEvent(
  topic: string,
  payload: Record<string, unknown>,
  options: {
    tenantId?: string;
    customFilePath?: string;
  } = {},
): Promise<DemoBusEvent> {
  const event: DemoBusEvent = {
    id: crypto.randomUUID(),
    topic,
    tenantId: options.tenantId,
    payload,
    emittedAt: new Date().toISOString(),
  };

  // Persist to audit log
  persistBusEvent(event, options.customFilePath ?? DEFAULT_BUS_FILE);

  // Dispatch to active subscribers (exact match or wildcard "*")
  const matching = subscribers.filter(
    (s) => s.topic === "*" || s.topic === topic,
  );

  for (const sub of matching) {
    try {
      await sub.handler(event);
    } catch {
      // Fail-silent: subscriber failure does not crash publisher
    }
  }

  return event;
}

export async function replayDemoEvents(
  topic?: string,
  options: {
    fromTimestamp?: string;
    customFilePath?: string;
    handler?: DemoEventHandler;
  } = {},
): Promise<number> {
  const all = listPublishedEvents(options.customFilePath ?? DEFAULT_BUS_FILE);
  let matched = all;

  if (topic && topic !== "*") {
    matched = matched.filter((e) => e.topic === topic);
  }
  if (options.fromTimestamp) {
    matched = matched.filter((e) => e.emittedAt >= options.fromTimestamp!);
  }

  if (options.handler) {
    for (const evt of matched) {
      await options.handler(evt);
    }
  }

  return matched.length;
}

export function listPublishedEvents(
  customFilePath = DEFAULT_BUS_FILE,
): DemoBusEvent[] {
  if (!fs.existsSync(customFilePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as DemoBusEvent[];
  } catch {
    return [];
  }
}

export function clearSubscribers(): void {
  subscribers.length = 0;
}

function persistBusEvent(event: DemoBusEvent, targetFile: string): void {
  try {
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let list: DemoBusEvent[] = [];
    if (fs.existsSync(targetFile)) {
      try {
        list = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
      } catch {
        list = [];
      }
    }
    list.push(event);
    fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
  } catch {
    // Fail-silent
  }
}
