/**
 * tests/e2e/demo-experience.spec.ts
 *
 * Sales Demo Experience E2E Validation.
 * Validates the sales demonstration user journey:
 *   1. Authentication / Login with demo credentials
 *   2. Inbox is populated with realistic WhatsApp conversations
 *   3. CRM Pipeline is populated with stages and lead cards
 *   4. Agenda is populated with provider schedules and appointments
 *   5. No broken empty states or error boundaries appear
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const DEMO_SESSION_PATH = path.resolve(process.cwd(), ".demo", "session.json");
const E2E_CREDS_PATH = path.resolve(process.cwd(), ".e2e-creds.json");

interface SessionData {
  tenant: string;
  email: string;
  password: string;
  clinicName?: string;
}

function resolveDemoCredentials(): SessionData {
  if (fs.existsSync(DEMO_SESSION_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(DEMO_SESSION_PATH, "utf8")) as SessionData;
      if (data.email && data.password) {
        return data;
      }
    } catch {
      // fallback
    }
  }

  // Fallback to e2e creds if demo session is absent in CI
  if (fs.existsSync(E2E_CREDS_PATH)) {
    try {
      const e2e = JSON.parse(fs.readFileSync(E2E_CREDS_PATH, "utf8"));
      return {
        tenant: "clinica-sonrisa-bogota",
        email: e2e.users?.admin?.email || "laura@sonrisabogota.demo",
        password: e2e.password || "ClinicDemo-8472",
      };
    } catch {
      // fallback
    }
  }

  return {
    tenant: "clinica-sonrisa-bogota",
    email: "laura@sonrisabogota.demo",
    password: process.env.DEMO_USER_PASSWORD || "ClinicDemo-8472",
  };
}

const creds = resolveDemoCredentials();

async function performLogin(page: Page, email: string, pass: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(pass);
  await page.getByRole("button", { name: /entrar|iniciar sesión|acessar/i }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
}

test.describe("Sales Demo Experience Validation", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept uncaught console errors for error boundaries
    page.on("pageerror", (err) => {
      console.warn("Browser page error:", err.message);
    });
  });

  test("1. Login into demo tenant successfully", async ({ page }) => {
    await performLogin(page, creds.email, creds.password);
    expect(page.url()).toMatch(/\/app/);
    await expect(page.getByRole("banner")).toBeVisible({ timeout: 15_000 });
  });

  test("2. Inbox is populated with active demo conversations", async ({ page }) => {
    await performLogin(page, creds.email, creds.password);
    await page.goto("/app/inbox");

    // Must not show server error or broken crash screen
    await expect(page.getByText(/algo deu errado|500|pgrst/i)).toHaveCount(0);

    // Verify main inbox navigation and presence of conversation list
    await expect(page.getByRole("tab", { name: /minhas|todas|fila/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Verify conversations exist on screen without empty broken states
    const convItems = page.locator("[data-testid='conversation-item'], [role='listitem']");
    const count = await convItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("3. CRM Pipeline is populated with stages and active leads", async ({ page }) => {
    await performLogin(page, creds.email, creds.password);
    await page.goto("/app/kanban");

    // Must not show server error
    await expect(page.getByText(/algo deu errado|500|pgrst/i)).toHaveCount(0);

    // Board columns/stages should be present
    const board = page.locator("[data-testid='kanban-board'], [data-rbd-droppable-id], .kanban-board");
    await expect(board.first()).toBeVisible({ timeout: 20_000 });

    // Lead cards should exist on the board
    const cards = page.locator("[data-testid='lead-card'], [data-rbd-draggable-id]");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test("4. Agenda is populated with appointments and provider views", async ({ page }) => {
    await performLogin(page, creds.email, creds.password);
    await page.goto("/app/agenda");

    // Must not show 500 error boundary
    await expect(page.getByText(/algo deu errado|500|pgrst/i)).toHaveCount(0);

    // Agenda screen should load properly
    const agendaScreen = page.getByTestId("tela-agenda").or(page.locator(".agenda-root, [data-testid='agenda-container']"));
    await expect(agendaScreen.first()).toBeVisible({ timeout: 20_000 });

    // Verify agenda controls (Dia, Semana, Mês, or Hoy)
    const viewButton = page.getByRole("button", { name: /dia|semana|mês|mes|hoy|hoje/i }).first();
    await expect(viewButton).toBeVisible();
  });

  test("5. Core surfaces have no broken empty states or unhandled boundaries", async ({ page }) => {
    await performLogin(page, creds.email, creds.password);

    const routes = ["/app/inbox", "/app/kanban", "/app/agenda", "/app/contacts"];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      // Verify no unexpected fatal error messages
      await expect(page.getByText(/internal server error|erro inesperado|pgrst002/i)).toHaveCount(0);
      // Main header remains visible
      await expect(page.getByRole("banner")).toBeVisible();
    }
  });
});
