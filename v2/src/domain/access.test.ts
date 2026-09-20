import { describe, expect, it } from "vitest";
import {
  canAccessModule,
  canPerformCommercialAction,
  canManageMembership,
  hasPermission,
  type Membership,
  type RoleId,
} from "./access";

const member = (role: RoleId, overrides: Partial<Membership> = {}): Membership => ({
  uid: `${role}-uid`,
  email: `${role}@example.com`,
  displayName: role,
  role,
  status: "active",
  scope: role === "owner" ? "organization" : "assigned_records",
  modules: ["dashboard", "leads", "admin"],
  ...overrides,
});

describe("access policy", () => {
  it("blocks writes and exports for viewers, revoked users and unassigned modules", () => {
    for (const permission of ["lead.create", "opportunity.update", "activity.create", "report.export"] as const) {
      expect(canPerformCommercialAction(member("viewer"), permission)).toBe(false);
      expect(canPerformCommercialAction(member("owner", { status: "revoked" }), permission)).toBe(false);
    }
    expect(canPerformCommercialAction(member("sales_rep"), "lead.create")).toBe(true);
    expect(canPerformCommercialAction(member("owner", { modules: ["dashboard"] }), "lead.create")).toBe(false);
    expect(canPerformCommercialAction(null, "lead.create")).toBe(true);
  });
  it("does not turn an assigned admin module into administrator permissions", () => {
    expect(canAccessModule(member("sales_rep"), "admin")).toBe(false);
    expect(canAccessModule(member("owner", { permissionOverrides: { "audit.read": false } }), "admin")).toBe(false);
    expect(canManageMembership(member("owner", { modules: ["leads"] }), member("viewer"))).toBe(false);
  });
  it("denies every permission for suspended memberships", () => {
    const suspended = member("owner", { status: "suspended" });
    expect(hasPermission(suspended, "organization.manage")).toBe(false);
    expect(canAccessModule(suspended, "dashboard")).toBe(false);
  });

  it("does not allow a sales rep to manage memberships", () => {
    expect(hasPermission(member("sales_rep"), "membership.manage")).toBe(false);
  });

  it("lets only the owner role manage an ordinary membership", () => {
    expect(canManageMembership(member("owner"), member("sales_rep"))).toBe(true);
    expect(canManageMembership(member("operations_admin"), member("sales_rep"))).toBe(false);
  });

  it("protects the owner from every membership change", () => {
    const owner = member("owner", { ownerProtected: true });
    const anotherOwner = member("owner", { uid: "another-owner" });
    expect(canManageMembership(anotherOwner, owner)).toBe(false);
    expect(canManageMembership(owner, owner)).toBe(false);
  });

  it("supports explicit, reviewed permission overrides", () => {
    const viewerWithExport = member("viewer", {
      permissionOverrides: { "report.export": true },
    });
    expect(hasPermission(viewerWithExport, "report.export")).toBe(true);
  });
});
