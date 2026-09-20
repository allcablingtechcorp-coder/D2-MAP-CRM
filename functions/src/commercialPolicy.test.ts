import { describe, expect, it } from "vitest";
import {
  canAccessCommercialRecord,
  canUseCommercialPermission,
  opportunityTransitions,
  parseCreateLeadInput,
  parseCreateOpportunityInput,
} from "./commercialPolicy.js";
import type { MembershipDocument } from "./membershipPolicy.js";

const membership = (patch: Partial<MembershipDocument> = {}): MembershipDocument => ({
  email: "seller@example.com",
  displayName: "Seller",
  role: "sales_rep",
  status: "active",
  scope: "assigned_records",
  modules: ["dashboard", "leads", "pipeline", "activities"],
  ...patch,
});

describe("commercial authorization policy", () => {
  it("limits assigned-record users to records they own", () => {
    expect(canAccessCommercialRecord(membership(), "user-1", { ownerUid: "user-1", teamId: null })).toBe(true);
    expect(canAccessCommercialRecord(membership(), "user-1", { ownerUid: "user-2", teamId: null })).toBe(false);
  });

  it("limits assigned-team users to configured teams", () => {
    const actor = membership({ scope: "assigned_teams", teamIds: ["south"] });
    expect(canAccessCommercialRecord(actor, "user-1", { ownerUid: "user-2", teamId: "south" })).toBe(true);
    expect(canAccessCommercialRecord(actor, "user-1", { ownerUid: "user-2", teamId: "north" })).toBe(false);
  });

  it("fails closed for custom scope and explicit permission denial", () => {
    expect(canAccessCommercialRecord(membership({ scope: "custom" }), "user-1", { ownerUid: "user-1", teamId: null })).toBe(false);
    expect(canUseCommercialPermission(membership({ permissionOverrides: { "lead.create": false } }), "lead.create")).toBe(false);
  });

  it("requires an enabled module for the requested action", () => {
    expect(canUseCommercialPermission(membership({ modules: ["dashboard"] }), "lead.create")).toBe(false);
    expect(canUseCommercialPermission(membership({ modules: ["leads"] }), "lead.create")).toBe(true);
  });
});

describe("commercial input contracts", () => {
  it("normalizes valid lead input and rejects extra fields", () => {
    expect(parseCreateLeadInput({ organizationId: "d2-group", companyName: " Alpha ", location: "Boca Raton", source: "map", priority: "high", nextAction: "Call", nextActionAt: "2026-09-21T10:00:00Z" }).companyName).toBe("Alpha");
    expect(() => parseCreateLeadInput({ organizationId: "d2-group", companyName: "Alpha", location: "Boca", source: "map", priority: "high", nextAction: "Call", nextActionAt: "2026-09-21", ownerUid: "attacker" })).toThrow("unsupported fields");
  });

  it("rejects unsafe opportunity amounts", () => {
    expect(() => parseCreateOpportunityInput({ organizationId: "d2-group", title: "Deal", companyName: "Alpha", amountCents: -1, nextAction: "Call", expectedCloseAt: "2026-10-01" })).toThrow("amountCents");
  });

  it("allows only controlled opportunity transitions", () => {
    expect(opportunityTransitions.discovery).toContain("diagnosis");
    expect(opportunityTransitions.discovery).not.toContain("won");
    expect(opportunityTransitions.won).toEqual([]);
  });
});
