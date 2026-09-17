/**
 * scripts/demo/jobs/hourly-automation.ts
 *
 * Scheduled Hourly Automation Job.
 * Runs SLA checks, expiration warnings, inactivity triggers, and escalations.
 * Safe, idempotent, demo-isolated.
 *
 * Usage:
 *   npx tsx scripts/demo/jobs/hourly-automation.ts
 */

import { runDemoAutomations } from "../lib/demo-automation";

async function main() {
  console.info("==========================================");
  console.info("⏰ DESKCOMM DEMO HOURLY AUTOMATION RUNNER");
  console.info("==========================================");

  try {
    const report = await runDemoAutomations();
    console.info(`[${report.executedAt}] Automation finished successfully.`);
    console.info(`  • SLAs Evaluated: ${report.slasEvaluated}`);
    console.info(`  • SLA Breaches: ${report.slaBreaches}`);
    console.info(`  • SLA Warnings: ${report.slaWarnings}`);
    console.info(`  • Expiring Demos Handled: ${report.expiringHandled}`);
    console.info(`  • Inactivity Demos Handled: ${report.inactivityHandled}`);
    console.info(`  • Follow-ups Queued: ${report.followupsQueued}`);
    console.info(`  • Alerts Dispatched: ${report.alertsDispatched}`);
    if (report.escalations.length > 0) {
      console.info("  ⚠️ Escalations:");
      report.escalations.forEach((e) => console.info(`    - ${e}`));
    }
    console.info("==========================================");
  } catch (err) {
    console.error("❌ Hourly automation failed:", err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes("hourly-automation")) {
  void main();
}
