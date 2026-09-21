import { describe, expect, it } from "vitest";
import { createExecutiveReportDocument } from "./exportExecutiveReport";
import type { Opportunity } from "../domain/crm";
import { demoActivities, demoLeads, demoOpportunities } from "../data/demo";
import {businesses} from "../domain/businesses";

const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGO8ssLtPwMDAwMTiABhACrWAsU3F82OAAAAAElFTkSuQmCC";
describe("executive report integrity", () => {
  it("identifies both companies and appends their separate results",()=>{
    const data={leads:demoLeads,activities:demoActivities,opportunities:demoOpportunities,companies:[],contacts:[]};
    const companies=businesses.map(business=>({business,data}));
    const doc=createExecutiveReportDocument({...data,generatedBy:"Owner",locale:"en",companies,companyLogos:Object.fromEntries(businesses.map(b=>[b.id,logo]))},logo);
    expect(doc.getNumberOfPages()).toBe(2);expect(doc.output()).toContain("D2 Smart Home");expect(doc.output()).toContain("D2 HVAC Solutions");
  });
  it("generates valid single-page reports in all three languages", () => {
    for (const locale of ["pt", "en", "es"] as const) {
      const document = createExecutiveReportDocument({ activities: demoActivities, leads: demoLeads, opportunities: demoOpportunities, generatedBy: "All Cabling Tech", locale }, logo);
      expect(document.output().slice(0, 4)).toBe("%PDF");
      expect(document.getNumberOfPages()).toBe(1);
    }
  });
  it("uses open revenue and actual win rate, retaining the institutional image", () => {
    const opportunities = [{ id: "open", title: "Network", companyName: "Test", ownerName: "Owner", stage: "proposal", amountCents: 10000, currency: "USD", nextAction: "Call", expectedCloseAt: "2026-10-01" }, { stage: "won", amountCents: 90000 }, { stage: "lost", amountCents: 50000 }] as Opportunity[];
    const doc = createExecutiveReportDocument({ activities: [], leads: [], opportunities, generatedBy: "Owner", locale: "en" }, logo);
    const pdf = doc.output();
    expect(pdf).toContain("($100.00)");
    expect(pdf).toContain("(50%)");
    expect(pdf).not.toContain("(28%)");
    expect(pdf).not.toContain("($1,500.00)");
    expect(pdf).toContain("/Subtype /Image");
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
