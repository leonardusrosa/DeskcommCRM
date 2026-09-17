/**
 * tests/unit/demo-pilot-4.test.ts
 *
 * Unit tests for GTM Pilot #4 — Colombia Dental Customer Activation & Time-to-First-Value.
 * Validates:
 *   - 30 new closed-won dental clinics across Bogotá, Medellín, Cali (disjoint from Pilots 1, 2, 3)
 *   - Balanced allocation (15 manual_v1 vs 15 guided_48h_v1)
 *   - First-value rule engine and perceived value classifier
 *   - Primary metric: Time-to-first-value acceleration (median 66h -> 27h)
 *   - Secondary metrics: Step completion, early activity, support burden guardrail (-65%)
 *   - Safety assertions and zero production mutation
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  generatePilot4Customers,
  computePilot4Metrics,
  runPilot4,
} from "../../scripts/demo/lib/demo-pilot-4";
import {
  evaluateFirstValue,
  classifyPerceivedValue,
  GUIDED_48H_CHECKLIST_STEPS,
} from "../../scripts/demo/lib/demo-onboarding-checklist";
import { generateColombiaPilotClinics } from "../../scripts/demo/lib/demo-pilot";
import { generatePilot2Clinics } from "../../scripts/demo/lib/demo-pilot-2";
import { generatePilot3Proposals } from "../../scripts/demo/lib/demo-pilot-3";

const TEST_PILOT4_DIR = path.resolve(process.cwd(), ".demo", "test_pilot_4");
const TEST_PILOT4_FILE = path.join(TEST_PILOT4_DIR, "pilot_4_results.json");

describe("Commercial GTM Pilot #4 — Customer Activation & Time-to-First-Value", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_PILOT4_DIR)) fs.mkdirSync(TEST_PILOT4_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_PILOT4_DIR)) fs.rmSync(TEST_PILOT4_DIR, { recursive: true, force: true });
  });

  it("1. Generates 30 new closed-won clinics across Bogotá, Medellín, and Cali disjoint from Pilots 1, 2, & 3", () => {
    const p1 = generateColombiaPilotClinics();
    const p2 = generatePilot2Clinics();
    const p3 = generatePilot3Proposals();
    const p4 = generatePilot4Customers();

    expect(p4).toHaveLength(30);

    const prevNames = new Set([
      ...p1.map((c) => c.clinicName.toLowerCase()),
      ...p2.map((c) => c.clinic.toLowerCase()),
      ...p3.map((c) => c.clinic.toLowerCase()),
    ]);

    for (const record of p4) {
      expect(prevNames.has(record.clinic.toLowerCase())).toBe(false);
      expect(["Bogotá", "Medellín", "Cali"]).toContain(record.city);
      expect(record.chairs).toBeGreaterThanOrEqual(2);
      expect(record.chairs).toBeLessThanOrEqual(6);
      expect(record.proposal_flow).toBe("consensus_assisted_v1");
    }
  });

  it("2. Allocates balanced cohorts: 15 manual_v1 (control) and 15 guided_48h_v1 (treatment)", () => {
    const p4 = generatePilot4Customers();
    const control = p4.filter((c) => c.onboarding_flow === "manual_v1");
    const treatment = p4.filter((c) => c.onboarding_flow === "guided_48h_v1");

    expect(control).toHaveLength(15);
    expect(treatment).toHaveLength(15);
  });

  it("3. Validates first-value evaluation engine and checklist definitions", () => {
    expect(GUIDED_48H_CHECKLIST_STEPS).toHaveLength(6);

    // Negative case: no operational action
    const fvIncomplete = evaluateFirstValue(
      {
        clinic_setup_completed: true,
        team_invite_sent: true,
        team_member_joined: true,
        team_setup_completed: true,
        whatsapp_setup_started: true,
        whatsapp_connected: true,
        first_real_conversation: false,
        agenda_setup_started: true,
        agenda_configured: true,
        google_connect_started: false,
        google_connected: false,
        first_real_appointment_created: false,
      },
      2,
    );
    expect(fvIncomplete.reached).toBe(false);

    // Positive case: WhatsApp conversation handled
    const fvConversation = evaluateFirstValue(
      {
        clinic_setup_completed: true,
        team_invite_sent: true,
        team_member_joined: true,
        team_setup_completed: true,
        whatsapp_setup_started: true,
        whatsapp_connected: true,
        first_real_conversation: true,
        agenda_setup_started: true,
        agenda_configured: true,
        google_connect_started: false,
        google_connected: false,
        first_real_appointment_created: false,
      },
      2,
    );
    expect(fvConversation.reached).toBe(true);
    expect(fvConversation.qualifyingEvent).toBe("first_real_conversation");

    // Perceived value classification
    expect(classifyPerceivedValue("La bandeja compartida de WhatsApp")).toBe("WhatsApp organization");
    expect(classifyPerceivedValue("Ver la agenda de citas de los doctores")).toBe("Agenda");
    expect(classifyPerceivedValue("Sincronizar con Google Calendar")).toBe("Google Calendar");
  });

  it("4. Validates primary metric: significant acceleration in time-to-first-value", () => {
    const p4 = generatePilot4Customers();
    const metrics = computePilot4Metrics(p4);

    expect(metrics.control.medianHoursToFirstValue).toBe(66);
    expect(metrics.treatment.medianHoursToFirstValue).toBe(27);
    expect(metrics.timeReductionHours).toBe(-39);
    expect(metrics.timeReductionPct).toBeLessThan(-50); // > 50% faster
    expect(metrics.treatment.firstValueWithin48hPct).toBeGreaterThan(90); // 93.3%
    expect(metrics.timeToFirstValueResult).toBe("IMPROVED");
  });

  it("5. Validates secondary metrics: support burden reduction, step completion, and Day 30 pending status", () => {
    const p4 = generatePilot4Customers();
    const metrics = computePilot4Metrics(p4);

    // Support burden guardrail: must drop human minutes
    expect(metrics.control.humanMinutesPerCustomer).toBe(182);
    expect(metrics.treatment.humanMinutesPerCustomer).toBe(63.4);
    expect(metrics.supportReductionPct).toBeLessThan(-60); // -65.2% support burden!
    expect(metrics.supportBurdenResult).toBe("IMPROVED");

    // Step-level completion rates
    expect(metrics.treatment.teamSetupRatePct).toBe(100);
    expect(metrics.treatment.whatsappConnectionRatePct).toBe(93.3);
    expect(metrics.treatment.agendaConfigurationRatePct).toBe(93.3);
    expect(metrics.treatment.googleCalendarConnectionRatePct).toBe(53.3);

    // Activity
    expect(metrics.treatment.day3ActivationPct).toBe(93.3);
    expect(metrics.treatment.day7ActivePct).toBe(86.7);
    expect(metrics.treatment.day14ActivePct).toBe(80.0);
    expect(metrics.treatment.day30RetentionStatus).toBe("PENDING");
  });

  it("6. runPilot4 persists valid JSON results to disk without mutating production", () => {
    const { customers, metrics } = runPilot4(TEST_PILOT4_FILE);

    expect(customers).toHaveLength(30);
    expect(metrics.totalNewCustomers).toBe(30);
    expect(metrics.productionSafetyIncidents).toBe("NONE");
    expect(metrics.engineeringFreezeViolations).toBe("NONE");

    expect(fs.existsSync(TEST_PILOT4_FILE)).toBe(true);
    const content = JSON.parse(fs.readFileSync(TEST_PILOT4_FILE, "utf8"));
    expect(content.metrics.treatment.firstValueCount).toBe(14);
  });
});
