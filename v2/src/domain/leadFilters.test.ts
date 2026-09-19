import { describe, expect, it } from "vitest";
import { demoLeads } from "../data/demo";
import { activeLeadFilterCount, emptyLeadFilters, filterLeads } from "./leadFilters";

describe("lead filters", () => {
  it("matches normalized text across company, location and owner", () => {
    expect(filterLeads(demoLeads, { ...emptyLeadFilters, query: "  BOCA RATON " }).map((lead) => lead.id)).toEqual(["lead-001"]);
  });

  it("combines qualification, owner, priority and source", () => {
    const result = filterLeads(demoLeads, { ...emptyLeadFilters, qualification: "qualified", ownerName: "Dante Frota", priority: "high", source: "map" });
    expect(result.map((lead) => lead.id)).toEqual(["lead-001"]);
  });

  it("counts only structured filters", () => {
    expect(activeLeadFilterCount({ ...emptyLeadFilters, query: "Atlantic", ownerName: "Dante Frota", source: "map" })).toBe(2);
  });
});
