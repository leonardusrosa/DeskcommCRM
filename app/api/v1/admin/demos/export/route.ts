/**
 * app/api/v1/admin/demos/export/route.ts
 *
 * API route for exporting demo data in CSV and JSON formats.
 * Audits every export request into demo_audit_events.
 */

import { type NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { fail } from "@/lib/api/wrappers";
import { listDemoLeads } from "@/scripts/demo/lib/demo-leads";
import { listActiveDemos } from "@/scripts/demo/lib/demo-registry";
import { calculateDemoHealthScore } from "@/scripts/demo/lib/demo-health-score";
import { recordDemoAudit } from "@/scripts/demo/lib/demo-audit";

export async function GET(req: NextRequest) {
  let userEmail = "admin@deskcomm.io";
  try {
    const { user } = await requirePlatformAdmin();
    if (user?.email) userEmail = user.email;
  } catch {
    return fail("forbidden", "Platform admin required", 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "json").toLowerCase();

    const registryDemos = listActiveDemos();
    const leads = listDemoLeads();

    const exportRows = registryDemos.map((reg) => {
      const lead = leads.find((l) => l.demo_tenant_id === reg.tenantId);
      const health = calculateDemoHealthScore(reg.tenantId, {
        leadStatus: lead?.status,
      });

      return {
        tenantId: reg.tenantId,
        company: lead?.company || reg.name,
        contactName: lead?.name || "N/A",
        contactEmail: lead?.email || reg.ownerEmail,
        country: reg.country,
        vertical: reg.vertical,
        status: lead?.status || reg.status,
        healthScore: health.healthScore,
        riskLevel: health.riskLevel,
        createdAt: reg.createdAt,
        expiresAt: reg.expiresAt,
      };
    });

    // Record audit event for export
    recordDemoAudit({
      tenantId: "system_export",
      actionType: "export",
      actorEmail: userEmail,
      description: `Exported ${exportRows.length} demo records as ${format.toUpperCase()}`,
      metadata: { format, count: exportRows.length },
    });

    if (format === "csv") {
      const headers = [
        "Tenant ID",
        "Empresa",
        "Contacto",
        "Email",
        "País",
        "Vertical",
        "Estado",
        "Salud (0-100)",
        "Riesgo",
        "Creado",
        "Expira",
      ];

      const csvLines = [
        headers.join(","),
        ...exportRows.map((r) =>
          [
            `"${r.tenantId}"`,
            `"${r.company.replace(/"/g, '""')}"`,
            `"${r.contactName.replace(/"/g, '""')}"`,
            `"${r.contactEmail}"`,
            `"${r.country}"`,
            `"${r.vertical}"`,
            `"${r.status}"`,
            r.healthScore,
            `"${r.riskLevel}"`,
            `"${r.createdAt}"`,
            `"${r.expiresAt}"`,
          ].join(","),
        ),
      ];

      const csvContent = csvLines.join("\n");
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="deskcomm_demos_${Date.now()}.csv"`,
        },
      });
    }

    // Default JSON
    return new NextResponse(JSON.stringify(exportRows, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="deskcomm_demos_${Date.now()}.json"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return fail("export_error", message, 500);
  }
}
