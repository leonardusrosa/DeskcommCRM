/**
 * scripts/demo/backup-cli.ts
 *
 * CLI tool for Disaster Recovery operations:
 *   pnpm demo:backup
 *   pnpm demo:restore
 */

import fs from "node:fs";
import path from "node:path";
import {
  createDemoBackup,
  restoreDemoBackup,
  DEFAULT_BACKUPS_DIR,
} from "./lib/demo-disaster-recovery";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "backup";

  if (command === "backup") {
    console.info("📦 [demo:backup] Generando respaldo del estado demo...");
    const manifest = createDemoBackup();
    console.info(`✅ Respaldo creado exitosamente: ${manifest.backupId}`);
    console.info(`   Archivos respaldados: ${manifest.fileCount}`);
    console.info(`   Tamaño total: ${manifest.totalBytes} bytes`);
    console.info(`   SHA-256 Checksum: ${manifest.masterChecksum}`);
    return;
  }

  if (command === "restore") {
    let target = args[1];
    if (!target) {
      if (!fs.existsSync(DEFAULT_BACKUPS_DIR)) {
        console.error("❌ No se encontraron respaldos previos en .demo/backups");
        process.exit(1);
      }
      const backups = fs.readdirSync(DEFAULT_BACKUPS_DIR).filter((f) => f.endsWith(".json")).sort();
      if (backups.length === 0) {
        console.error("❌ No hay respaldos disponibles para restaurar.");
        process.exit(1);
      }
      target = path.join(DEFAULT_BACKUPS_DIR, backups.slice(-1)[0]!);
    }

    console.info(`♻️ [demo:restore] Restaurando estado desde: ${target}...`);
    const result = restoreDemoBackup(target);
    console.info(`✅ Restauración completada: ${result.details}`);
    return;
  }

  console.error(`Comando desconocido: '${command}'. Usa 'backup' o 'restore'.`);
  process.exit(1);
}

void main();
