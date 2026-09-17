/**
 * scripts/demo/jobs/daily-revenue-report.ts
 *
 * Scheduled Daily Revenue Report Job.
 * Calculates pipeline value, weighted revenue, and ARR forecast,
 * then dispatches a daily executive summary alert.
 * Safe, idempotent, demo-isolated.
 *
 * Usage:
 *   npx tsx scripts/demo/jobs/daily-revenue-report.ts
 */

import { calculateRevenueForecast } from "../lib/demo-forecast";
import { sendDemoAlert } from "../lib/demo-alerts";
import { recordDemoAudit } from "../lib/demo-audit";

async function main() {
  console.info("==========================================");
  console.info("📊 DESKCOMM DEMO DAILY REVENUE REPORT");
  console.info("==========================================");

  try {
    const forecast = calculateRevenueForecast();

    const currencies = Object.keys(forecast.forecastsByCurrency) as Array<
      keyof typeof forecast.forecastsByCurrency
    >;
    const summaryLines: string[] = [];

    for (const cur of currencies) {
      const f = forecast.forecastsByCurrency[cur];
      if (f.dealsCount > 0) {
        summaryLines.push(
          `${cur}: Pipeline ${f.pipelineValue.toLocaleString()} | Won MRR: ${f.wonMRR.toLocaleString()} | ARR Proy: ${f.arrForecast.toLocaleString()}`,
        );
      }
    }

    const reportMessage =
      summaryLines.length > 0
        ? summaryLines.join("\n")
        : "No active pipeline deals found today.";

    console.info(`Deals Totales: ${forecast.totalDeals}`);
    console.info(`Deals Ganados: ${forecast.wonDealsCount}`);
    console.info(`Deals Abiertos: ${forecast.openDealsCount}`);
    console.info(reportMessage);

    // Dispatch executive alert
    await sendDemoAlert({
      tenantId: "global_revenue_report",
      channel: "slack",
      severity: "info",
      title: "Reporte Diario de Ingresos y Pipeline",
      message: reportMessage,
      recipient: process.env.SLACK_MANAGEMENT_CHANNEL || "exec-revenue",
    });

    recordDemoAudit({
      tenantId: "global_revenue_report",
      actionType: "export",
      description: "Daily revenue forecast generated and dispatched",
      metadata: {
        totalDeals: forecast.totalDeals,
        wonDeals: forecast.wonDealsCount,
      },
    });

    console.info("==========================================");
  } catch (err) {
    console.error("❌ Daily revenue report failed:", err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes("daily-revenue-report")) {
  void main();
}
