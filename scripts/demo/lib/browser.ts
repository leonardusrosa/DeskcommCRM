/**
 * scripts/demo/lib/browser.ts
 *
 * Cross-platform browser launcher for the demo workflow.
 * Gracefully attempts to launch the browser without throwing errors on headless or failing environments.
 */

import { exec } from "node:child_process";
import * as readline from "node:readline";

export const DEFAULT_DEMO_URL = "http://localhost:3000/login";

/**
 * Launches the specified URL in the host's default web browser.
 * Returns true if the process spawn succeeded, false otherwise.
 */
export function launchBrowser(url = DEFAULT_DEMO_URL): Promise<boolean> {
  return new Promise((resolve) => {
    let command = "";
    if (process.platform === "win32") {
      command = `start "" "${url}"`;
    } else if (process.platform === "darwin") {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    try {
      exec(command, (error) => {
        if (error) {
          console.warn(`   ⚠️ No se pudo abrir el navegador automáticamente (${error.message}).`);
          console.info(`   👉 Puedes abrirlo manualmente en: ${url}`);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (err) {
      console.warn(`   ⚠️ Error al intentar lanzar el navegador:`, err);
      resolve(false);
    }
  });
}

/**
 * Prompts the user interactively: "Open demo in browser? [Y/n]"
 * Defaults to Yes on Enter, 'y', 'yes'.
 */
export function promptBrowserLaunch(
  url = DEFAULT_DEMO_URL,
  customRl?: readline.Interface,
): Promise<boolean> {
  return new Promise((resolve) => {
    const rl =
      customRl ||
      readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

    rl.question("\nOpen demo in browser? [Y/n] ", async (answer) => {
      if (!customRl) {
        rl.close();
      }
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "" || trimmed === "y" || trimmed === "yes" || trimmed === "s" || trimmed === "sim") {
        const ok = await launchBrowser(url);
        resolve(ok);
      } else {
        resolve(false);
      }
    });
  });
}
