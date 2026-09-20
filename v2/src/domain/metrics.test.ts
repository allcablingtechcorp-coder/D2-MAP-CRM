import { describe, expect, it } from "vitest";
import type { Activity, Lead, Opportunity } from "./crm";
import { closedDealWinRate, leadSourceDistribution, leadActivityCoverage, openPipelineValue, pendingDueToday, pendingNextSevenDays } from "./metrics";

const activity = (id: string, dueAt: string, completed = false, companyName = "Alpha"): Activity => ({
  id, dueAt, completed, companyName, kind: "call", ownerName: "Owner", subject: "Follow-up",
});

describe("commercial metrics", () => {
  it("never invents conversion or source distribution for an empty workspace", () => {
    expect(closedDealWinRate([])).toBeNull();
    expect(closedDealWinRate([{ stage: "discovery" }] as Opportunity[])).toBeNull();
    expect(closedDealWinRate([{ stage: "won" }, { stage: "lost" }, { stage: "proposal" }] as Opportunity[])).toBe(50);
    expect(leadSourceDistribution([]).background).toBe("#edf1f5");
    const distribution = leadSourceDistribution([{ source: "manual" }, { source: "map" }] as Lead[]);
    expect(distribution.sources.find((item) => item.source === "manual")?.percentage).toBe(50);
    expect(distribution.sources.at(-1)?.end).toBe(100);
  });
  const now = new Date("2026-09-19T12:00:00-04:00");

  it("separates today's pending work from overdue and completed activities", () => {
    const activities = [
      activity("overdue", "2026-09-18T15:00:00-04:00"),
      activity("today", "2026-09-19T16:00:00-04:00"),
      activity("complete", "2026-09-19T17:00:00-04:00", true),
    ];
    expect(pendingDueToday(activities, now)).toBe(1);
  });

  it("counts only pending activities within the next seven local calendar days", () => {
    const activities = [
      activity("today", "2026-09-19T16:00:00-04:00"),
      activity("six-days", "2026-09-25T09:00:00-04:00"),
      activity("seven-days", "2026-09-26T09:00:00-04:00"),
      activity("overdue", "2026-09-18T09:00:00-04:00"),
    ];
    expect(pendingNextSevenDays(activities, now)).toBe(2);
  });

  it("excludes closed deals from pipeline value and intersects activity coverage with leads", () => {
    const opportunities = [
      { stage: "discovery", amountCents: 1000 },
      { stage: "won", amountCents: 5000 },
    ] as Opportunity[];
    const leads = [{ companyName: "Alpha" }, { companyName: "Beta" }] as Lead[];
    const activities = [activity("alpha", now.toISOString()), activity("external", now.toISOString(), false, "External")];
    expect(openPipelineValue(opportunities)).toBe(1000);
    expect(leadActivityCoverage(leads, activities)).toEqual({ covered: 1, percentage: 50 });
  });
});
