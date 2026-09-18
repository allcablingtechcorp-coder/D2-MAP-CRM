import { describe, expect, it } from "vitest";
import {
  canAccessModule,
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
  modules: ["dashboard", "leads"],
  ...overrides,
});

describe("access policy", () => {
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

  it("protects the owner from being changed by another membership", () => {
    const owner = member("owner", { ownerProtected: true });
    const anotherOwner = member("owner", { uid: "another-owner" });
    expect(canManageMembership(anotherOwner, owner)).toBe(false);
    expect(canManageMembership(owner, owner)).toBe(true);
  });

  it("supports explicit, reviewed permission overrides", () => {
    const viewerWithExport = member("viewer", {
      permissionOverrides: { "report.export": true },
    });
    expect(hasPermission(viewerWithExport, "report.export")).toBe(true);
  });
});
