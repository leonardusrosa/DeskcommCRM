"use client";

import { useState } from "react";

export function DemoExportView() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const triggerExport = (format: "csv" | "json") => {
    setDownloading(format);
    const link = document.createElement("a");
    link.href = `/api/v1/admin/demos/export?format=${format}`;
    link.setAttribute("download", `deskcomm_demos.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(null), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Exportación de Datos Comerciales</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Descarga el conjunto completo de prospectos, puntuaciones de salud comercial, estados de embudo y fechas de expiración.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          {/* CSV Card */}
          <div className="rounded-lg border p-4 bg-muted/20 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <span className="text-sm font-bold flex items-center gap-1.5">
                <span>📄</span> Archivo CSV (Excel / Google Sheets)
              </span>
              <p className="text-xs text-muted-foreground">
                Ideal para análisis en hojas de cálculo, modelos de conversión y tableros BI externos.
              </p>
            </div>
            <button
              onClick={() => triggerExport("csv")}
              disabled={downloading === "csv"}
              className="w-full py-2 px-3 text-xs font-semibold rounded bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              {downloading === "csv" ? "Generando CSV…" : "Descargar CSV"}
            </button>
          </div>

          {/* JSON Card */}
          <div className="rounded-lg border p-4 bg-muted/20 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <span className="text-sm font-bold flex items-center gap-1.5">
                <span>📦</span> Archivo JSON (Desarrolladores / API)
              </span>
              <p className="text-xs text-muted-foreground">
                Estructura completa con objetos anidados para migraciones, webhooks o copias de seguridad locales.
              </p>
            </div>
            <button
              onClick={() => triggerExport("json")}
              disabled={downloading === "json"}
              className="w-full py-2 px-3 text-xs font-semibold rounded border bg-background hover:bg-muted transition-colors"
            >
              {downloading === "json" ? "Generando JSON…" : "Descargar JSON"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-[11px] text-muted-foreground">
          🔒 <strong>Seguridad y Auditoría:</strong> Cada descarga es registrada de forma inmutable en el registro de auditoría del sistema con el identificador del operador, fecha y formato solicitado.
        </div>
      </div>
    </div>
  );
}
