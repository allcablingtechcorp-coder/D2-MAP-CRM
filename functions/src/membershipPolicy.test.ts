import { describe, expect, it } from "vitest";
import {
  InputValidationError,
  canManageMemberships,
  isProtectedOwner,
  membershipChanges,
  parseMembershipDocument,
  parseSaveMembershipInput,
  removesActiveOwner,
  type MembershipDocument,
} from "./membershipPolicy.js";

const member: MembershipDocument = {
  email: "manager@example.com",
  displayName: "Manager",
  role: "sales_manager" as const,
  status: "active" as const,
  scope: "assigned_teams" as const,
  modules: ["dashboard", "leads"],
};

describe("saveMembership policy", () => {
  it("requires an active owner, admin module and no permission denial", () => {
    const owner: MembershipDocument = { ...member, role: "owner", modules: ["admin"] };
    expect(canManageMemberships(owner)).toBe(true);
    expect(canManageMemberships({ ...owner, status: "suspended" })).toBe(false);
    expect(canManageMemberships({ ...owner, modules: [] })).toBe(false);
    expect(canManageMemberships({ ...owner, permissionOverrides: { "membership.manage": false } })).toBe(false);
    expect(canManageMemberships({ ...owner, role: "operations_admin", permissionOverrides: { "membership.manage": true } })).toBe(false);
  });
  it("normalizes a strict command and removes duplicate modules", () => {
    expect(parseSaveMembershipInput({
      organizationId: "d2-group",
      targetUid: "member_1",
      reason: "  Quarterly review  ",
      patch: { role: "viewer", status: "active", scope: "assigned_records", modules: ["dashboard", "dashboard", "reports"] },
    })).toEqual({
      organizationId: "d2-group",
      targetUid: "member_1",
      reason: "Quarterly review",
      patch: { role: "viewer", status: "active", scope: "assigned_records", modules: ["dashboard", "reports"] },
    });
  });

  it("rejects missing reasons, unknown fields and invalid enums", () => {
    expect(() => parseSaveMembershipInput({ organizationId: "d2-group", targetUid: "member", reason: "", patch: { role: "viewer", status: "active", scope: "organization", modules: ["dashboard"] } })).toThrow(InputValidationError);
    expect(() => parseSaveMembershipInput({ organizationId: "d2-group", targetUid: "member", reason: "review", extra: true, patch: { role: "viewer", status: "active", scope: "organization", modules: ["dashboard"] } })).toThrow("unsupported fields");
    expect(() => parseSaveMembershipInput({ organizationId: "d2-group", targetUid: "member", reason: "review", patch: { role: "root", status: "active", scope: "organization", modules: ["dashboard"] } })).toThrow("patch.role");
  });

  it("validates membership documents before authorization", () => {
    expect(parseMembershipDocument(member)).toEqual({ ...member, modules: ["dashboard", "leads"] });
    expect(() => parseMembershipDocument({ ...member, status: "enabled" })).toThrow("access fields");
  });

  it("protects the corporate owner by flag or normalized email", () => {
    expect(isProtectedOwner({ ...member, email: "allcablingtechcorp@gmail.com" })).toBe(true);
    expect(isProtectedOwner({ ...member, ownerProtected: true })).toBe(true);
    expect(isProtectedOwner(member)).toBe(false);
  });

  it("detects removal of an active owner", () => {
    const owner = { ...member, role: "owner" as const };
    expect(removesActiveOwner(owner, { role: "viewer", status: "active", scope: "organization", modules: ["dashboard"] })).toBe(true);
    expect(removesActiveOwner(owner, { role: "owner", status: "active", scope: "organization", modules: ["dashboard"] })).toBe(false);
  });

  it("records only changed governance fields", () => {
    expect(membershipChanges(member, { role: "viewer", status: "active", scope: "assigned_teams", modules: ["dashboard", "leads"] })).toEqual({ role: { from: "sales_manager", to: "viewer" } });
  });
});
