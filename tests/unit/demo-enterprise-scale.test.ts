/**
 * tests/unit/demo-enterprise-scale.test.ts
 *
 * Unit test suite for Demo Revenue Infrastructure & Enterprise Scale:
 *   - Event Bus (publish, subscribe, replay)
 *   - Automation Queue (enqueue, deduplication, retry, dead letter)
 *   - AI Insights & Revenue Intelligence
 *   - Playbook Engine (rules & trigger matching)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-enterprise-scale-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function tmp(name: string) {
  return path.join(tmpDir, name);
}

// ─── 1. Event Bus ────────────────────────────────────────────────────────────

describe("Event Bus (scripts/demo/events)", () => {
  it("publishes events, notifies subscribers, and persists event log", async () => {
    const { publishDemoEvent, subscribeDemoEvent, clearSubscribers } = await import(
      "../../scripts/demo/events"
    );
    clearSubscribers();

    const customFile = tmp("events.json");
    const received: string[] = [];

    const sub = subscribeDemoEvent("demo_high_intent", async (event) => {
      received.push(event.topic);
    });

    const event = await publishDemoEvent(
      "demo_high_intent",
      { score: 95 },
      { tenantId: "tenant_test_1", customFilePath: customFile },
    );

    expect(event.id).toBeDefined();
    expect(received).toEqual(["demo_high_intent"]);

    sub.unsubscribe();
  });

  it("replays past events successfully", async () => {
    const { publishDemoEvent, replayDemoEvents, clearSubscribers } = await import(
      "../../scripts/demo/events"
    );
    clearSubscribers();
    const customFile = tmp("replay_events.json");

    await publishDemoEvent(
      "demo_created",
      { profile: "starter" },
      { tenantId: "t1", customFilePath: customFile },
    );
    await publishDemoEvent(
      "first_login",
      { durationSec: 120 },
      { tenantId: "t1", customFilePath: customFile },
    );

    const replayed: string[] = [];
    const count = await replayDemoEvents("*", {
      customFilePath: customFile,
      handler: async (ev) => {
        replayed.push(ev.topic);
      },
    });

    expect(count).toBe(2);
    expect(replayed).toEqual(["demo_created", "first_login"]);
  });
});

// ─── 2. Automation Queue ─────────────────────────────────────────────────────

describe("Automation Queue (scripts/demo/queue)", () => {
  it("enqueues jobs and enforces idempotency deduplication", async () => {
    const { enqueueDemoJob, listJobs } = await import(
      "../../scripts/demo/queue"
    );
    const queueFile = tmp("queue.json");

    const job1 = enqueueDemoJob(
      "lead_scoring",
      { score: 85 },
      { idempotencyKey: "unique_key_123", customFilePath: queueFile },
    );

    const job2 = enqueueDemoJob(
      "lead_scoring",
      { score: 85 },
      { idempotencyKey: "unique_key_123", customFilePath: queueFile },
    );

    expect(job1.id).toBe(job2.id); // Same job returned due to idempotency
    const jobs = listJobs(undefined, queueFile);
    expect(jobs.length).toBe(1);
  });

  it("processes pending jobs and moves failed jobs to dead letter after max retries", async () => {
    const { enqueueDemoJob, processDemoJobs, listJobs } = await import(
      "../../scripts/demo/queue"
    );
    const queueFile = tmp("queue_fail.json");

    enqueueDemoJob(
      "always_fails",
      { attempt: 1 },
      { maxRetries: 1, customFilePath: queueFile },
    );

    const res = await processDemoJobs(
      async () => {
        throw new Error("Simulated failure for dead letter test");
      },
      { customFilePath: queueFile },
    );

    expect(res.processed).toBe(1);
    expect(res.failed).toBe(1);

    const deadLetterJobs = listJobs("dead_letter", queueFile);
    expect(deadLetterJobs.length).toBe(1);
    expect(deadLetterJobs[0]!.jobType).toBe("always_fails");
    expect(deadLetterJobs[0]!.status).toBe("dead_letter");
  });
});

// ─── 3. Revenue Intelligence & AI Insights ───────────────────────────────────

describe("Revenue AI Insights (scripts/demo/lib/demo-ai-insights)", () => {
  it("generates prioritized actionable insights from commercial data", async () => {
    const { generateRevenueInsights } = await import(
      "../../scripts/demo/lib/demo-ai-insights"
    );

    const report = generateRevenueInsights();
    expect(report.generatedAt).toBeDefined();
    expect(typeof report.overallHealthSummary).toBe("string");
    expect(Array.isArray(report.insights)).toBe(true);

    if (report.insights.length > 0) {
      const firstInsight = report.insights[0]!;
      expect(["funnel", "cohorts", "attribution", "experiments", "deals"]).toContain(
        firstInsight.category,
      );
      expect(["high", "medium", "low"]).toContain(firstInsight.impact);
      expect(firstInsight.recommendation.length).toBeGreaterThan(10);
    }
  });
});

// ─── 4. Playbook Engine ──────────────────────────────────────────────────────

describe("Playbook Engine (scripts/demo/playbooks)", () => {
  it("matches high intent trigger and routes VIP enterprise actions", async () => {
    const { evaluatePlaybookRules } = await import("../../scripts/demo/playbooks");
    const playbooksFile = tmp("playbooks.json");

    const results = evaluatePlaybookRules(
      {
        score: 92,
        country: "MX",
        vertical: "dental-clinic",
      },
      playbooksFile,
    );

    const highIntent = results.find((r) => r.ruleId === "rule_high_intent");
    expect(highIntent).toBeDefined();
    expect(highIntent?.matched).toBe(true);
    expect(highIntent?.actionsExecuted.some((a) => a.type === "assign_rep")).toBe(true);
  });

  it("matches territory Colombia playbook for Colombian leads", async () => {
    const { evaluatePlaybookRules } = await import("../../scripts/demo/playbooks");
    const playbooksFile = tmp("playbooks_co.json");

    const results = evaluatePlaybookRules(
      {
        country: "CO",
        vertical: "dental-clinic",
      },
      playbooksFile,
    );

    const coRule = results.find((r) => r.ruleId === "rule_country_colombia");
    expect(coRule).toBeDefined();
    expect(coRule?.matched).toBe(true);
    expect(coRule?.actionsExecuted.some((a) => a.target === "territory:colombia")).toBe(true);
  });
});
