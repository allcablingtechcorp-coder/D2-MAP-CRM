import { describe, expect, it } from "vitest";
import { InputValidationError } from "./membershipPolicy.js";
import { parseCreateInvitationCommand, parseCreateTeamCommand, parseOrganizationCommand, parseSessionCommand } from "./governancePolicy.js";

describe("governance commands", () => {
  it("normalizes invitations and removes duplicate modules and teams", () => {
    expect(parseCreateInvitationCommand({ organizationId: "d2-group", email: " USER@EXAMPLE.COM ", role: "sales_rep", scope: "assigned_teams", modules: ["dashboard", "leads", "leads"], teamIds: ["south", "south"] })).toEqual({ organizationId: "d2-group", email: "user@example.com", role: "sales_rep", scope: "assigned_teams", modules: ["dashboard", "leads"], teamIds: ["south"] });
  });

  it("rejects owner invitations, custom scope and unsupported fields", () => {
    expect(() => parseCreateInvitationCommand({ organizationId: "d2-group", email: "user@example.com", role: "owner", scope: "organization", modules: ["dashboard"], teamIds: [] })).toThrow(InputValidationError);
    expect(() => parseCreateInvitationCommand({ organizationId: "d2-group", email: "user@example.com", role: "viewer", scope: "custom", modules: ["dashboard"], teamIds: [] })).toThrow(InputValidationError);
    expect(() => parseCreateInvitationCommand({ organizationId: "d2-group", email: "user@example.com", role: "viewer", scope: "organization", modules: ["dashboard"], teamIds: [], unexpected: true })).toThrow("unsupported fields");
  });

  it("validates team, organization and session commands", () => {
    expect(parseCreateTeamCommand({ organizationId: "d2-group", name: " South Florida " })).toEqual({ organizationId: "d2-group", name: "South Florida" });
    expect(parseOrganizationCommand({ organizationId: "d2-group" })).toEqual({ organizationId: "d2-group" });
    expect(parseSessionCommand({ organizationId: "d2-group", event: "signed_in" })).toEqual({ organizationId: "d2-group", event: "signed_in" });
    expect(() => parseSessionCommand({ organizationId: "d2-group", event: "opened" })).toThrow(InputValidationError);
  });
});
