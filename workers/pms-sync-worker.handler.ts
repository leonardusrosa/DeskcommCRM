/**
 * workers/pms-sync-worker.handler.ts
 *
 * Handler adapter exposing pms-sync-worker to the event_log dispatcher.
 * Handles PMS background jobs: initial_sync, incremental_sync, reconcile.
 */

import type { EventHandler } from "@/lib/event-log/dispatcher";
import { PMS_SYNC_HANDLER_KEY, processPmsSyncEvent } from "./pms-sync-worker";

export { PMS_SYNC_HANDLER_KEY };

export const pmsSyncHandler: EventHandler = {
  key: PMS_SYNC_HANDLER_KEY,
  events: [
    "pms.initial_sync_requested",
    "pms.incremental_sync_requested",
    "pms.reconcile_requested",
  ],
  async handle(row) {
    return processPmsSyncEvent(row);
  },
};
