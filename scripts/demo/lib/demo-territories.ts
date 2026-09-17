/**
 * scripts/demo/lib/demo-territories.ts
 *
 * Territory & Regional Management Engine.
 * Segments countries into commercial territories, enforces regional ownership rules,
 * default transaction currencies, and rep routing.
 *
 * Isolated in demo storage (.demo/demo_territories.json).
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_DIR } from "./demo-session";
import type { DealCurrency } from "./demo-deals";

export interface TerritoryDefinition {
  id: string;
  region: string;
  name: string;
  countries: string[];
  defaultCurrency: DealCurrency;
  regionalDirectorEmail: string;
  assignedReps: Array<{ id: string; name: string; email: string }>;
  defaultSLAHours: number;
}

export const DEFAULT_TERRITORIES_FILE = path.resolve(
  DEFAULT_DEMO_DIR,
  "demo_territories.json",
);

export const DEFAULT_TERRITORIES: TerritoryDefinition[] = [
  {
    id: "territory_latam_north",
    region: "LATAM",
    name: "Latam Norte & Andina",
    countries: ["CO", "MX", "PE", "EC"],
    defaultCurrency: "COP",
    regionalDirectorEmail: "director.latam@deskcomm.io",
    assignedReps: [
      { id: "rep_co", name: "Dra. Laura Martínez", email: "laura@sonrisabogota.demo" },
      { id: "rep_mx", name: "Dr. Roberto Garza", email: "roberto@dentalmonterrey.demo" },
    ],
    defaultSLAHours: 2,
  },
  {
    id: "territory_emea",
    region: "EMEA",
    name: "Europa Ibérica",
    countries: ["ES", "PT"],
    defaultCurrency: "EUR",
    regionalDirectorEmail: "director.emea@deskcomm.io",
    assignedReps: [
      { id: "rep_es", name: "Dra. Carmen Navarro", email: "carmen@clinicamadrid.demo" },
      { id: "rep_pt", name: "Dr. João Silva", email: "joao@dentallisboa.demo" },
    ],
    defaultSLAHours: 1,
  },
  {
    id: "territory_brazil",
    region: "LATAM",
    name: "Brasil",
    countries: ["BR"],
    defaultCurrency: "BRL",
    regionalDirectorEmail: "diretor.brasil@deskcomm.io",
    assignedReps: [
      { id: "rep_br", name: "Lucas Fernandes", email: "lucas@deskcomm.br.demo" },
    ],
    defaultSLAHours: 2,
  },
  {
    id: "territory_na",
    region: "North America",
    name: "Estados Unidos & Internacional",
    countries: ["US", "CA"],
    defaultCurrency: "USD",
    regionalDirectorEmail: "director.na@deskcomm.io",
    assignedReps: [
      { id: "rep_us", name: "Sarah Jenkins", email: "sarah@deskcomm.us.demo" },
    ],
    defaultSLAHours: 1,
  },
];

export function resolveTerritory(
  countryCode: string,
  customFilePath = DEFAULT_TERRITORIES_FILE,
): TerritoryDefinition {
  const territories = listTerritories(customFilePath);
  const upper = countryCode.toUpperCase().trim();

  const match = territories.find((t) => t.countries.includes(upper));
  if (match) return match;

  // Fallback to North America / International
  return territories.find((t) => t.id === "territory_na") || territories[0]!;
}

export function assignTerritoryRep(
  countryCode: string,
  customFilePath = DEFAULT_TERRITORIES_FILE,
): TerritoryDefinition["assignedReps"][0] {
  const territory = resolveTerritory(countryCode, customFilePath);
  if (territory.assignedReps.length === 0) {
    return {
      id: "rep_default",
      name: "Ejecutivo Regional",
      email: territory.regionalDirectorEmail,
    };
  }
  // Return first available rep or rotate
  return territory.assignedReps[0]!;
}

export function listTerritories(customFilePath = DEFAULT_TERRITORIES_FILE): TerritoryDefinition[] {
  if (!fs.existsSync(customFilePath)) {
    saveTerritories(DEFAULT_TERRITORIES, customFilePath);
    return DEFAULT_TERRITORIES;
  }
  try {
    return JSON.parse(fs.readFileSync(customFilePath, "utf-8")) as TerritoryDefinition[];
  } catch {
    return DEFAULT_TERRITORIES;
  }
}

function saveTerritories(list: TerritoryDefinition[], targetFile: string): void {
  const dir = path.dirname(targetFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
}
