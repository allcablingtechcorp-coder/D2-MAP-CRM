import { describe, expect, it } from "vitest";
import { demoActivities, demoLeads, demoOpportunities } from "../data/demo";
import { completeActivity, createLead, findDuplicateLead, nextOpenStage, transitionOpportunity } from "./workflows";

describe("commercial workflows", () => {
  it("detects a duplicate using normalized company and location", () => {
    expect(findDuplicateLead(demoLeads, " ATLANTIC  workspace studio ", "boca raton, fl")?.id).toBe("lead-001");
  });

  it("creates a normalized lead with traceable timestamps", () => {
    const result = createLead({ companyName: " New Design Co ", location: "Miami, FL", ownerName: "Dante Frota", source: "map", priority: "high", nextAction: "Call facilities", nextActionAt: "2026-09-20T10:00:00-04:00" }, demoLeads, new Date("2026-09-19T12:00:00Z"), "lead-new");
    expect(result.ok && result.lead.companyName).toBe("New Design Co");
    expect(result.ok && result.lead.qualification).toBe("new");
    expect(result.ok && result.lead.lastActivityAt).toBe("2026-09-19T12:00:00.000Z");
  });

  it("rejects incomplete lead creation", () => {
    expect(createLead({ companyName: "", location: "Miami, FL", ownerName: "Dante", source: "manual", priority: "medium", nextAction: "Call", nextActionAt: "2026-09-20" }, [], new Date(), "lead")).toEqual({ ok: false, reason: "required_fields" });
  });

  it("rejects an invalid next-action date", () => {
    const result = createLead({ companyName: "Alpha", location: "Boca Raton", ownerName: "Owner", source: "manual", priority: "medium", nextAction: "Call", nextActionAt: "invalid" }, [], new Date(), "lead-new");
    expect(result).toEqual({ ok: false, reason: "invalid_date" });
  });

  it("advances opportunities through the configured sequence", () => {
    expect(nextOpenStage("discovery")).toBe("diagnosis");
    const result = transitionOpportunity(demoOpportunities[0], "proposal");
    expect(result.ok && result.opportunity.stage).toBe("proposal");
  });

  it("requires value before entering proposal", () => {
    const opportunity = { ...demoOpportunities[3], stage: "diagnosis" as const };
    expect(transitionOpportunity(opportunity, "proposal")).toEqual({ ok: false, reason: "amount_required" });
  });

  it("does not reopen a closed opportunity through the standard transition", () => {
    expect(transitionOpportunity({ ...demoOpportunities[0], stage: "won" }, "negotiation")).toEqual({ ok: false, reason: "closed_opportunity" });
  });

  it("completes an activity idempotently", () => {
    const completed = completeActivity(demoActivities[0]);
    expect(completed.completed).toBe(true);
    expect(completeActivity(completed)).toEqual(completed);
  });
});
