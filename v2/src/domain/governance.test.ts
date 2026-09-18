import { describe, expect, it } from "vitest";
import type { Membership } from "./access";
import { buildAuditEvent, createInvitation, reviewMembershipChange } from "./governance";

const owner: Membership = { uid: "owner", email: "allcablingtechcorp@gmail.com", displayName: "Owner", role: "owner", status: "active", scope: "organization", modules: ["dashboard", "admin"], ownerProtected: true };
const manager: Membership = { uid: "manager", email: "manager@example.com", displayName: "Manager", role: "sales_manager", status: "active", scope: "assigned_teams", modules: ["dashboard", "leads"] };

describe("governance policy", () => {
  it("keeps the protected owner immutable, including self changes", () => {
    const result = reviewMembershipChange(owner, owner, { role: "owner", status: "active", scope: "organization", modules: owner.modules }, "change", [owner]);
    expect(result).toEqual({ ok: false, reason: "protected_owner" });
  });

  it("requires a business reason before changing access", () => {
    const result = reviewMembershipChange(owner, manager, { role: "viewer", status: "active", scope: "assigned_records", modules: ["dashboard"] }, "", [owner, manager]);
    expect(result).toEqual({ ok: false, reason: "reason_required" });
  });

  it("produces a review with before and after values", () => {
    const result = reviewMembershipChange(owner, manager, { role: "viewer", status: "active", scope: "assigned_records", modules: ["dashboard"] }, "Quarterly access review", [owner, manager]);
    expect(result.ok && result.value.after.role).toBe("viewer");
    expect(result.ok && result.value.changedFields).toEqual(["role", "scope", "modules"]);
  });

  it("creates normalized, expiring invitations for non-owner roles", () => {
    const result = createInvitation(owner, { email: " NEW@Example.COM ", role: "sales_rep", scope: "assigned_records", modules: ["dashboard", "leads"] }, [owner], new Date("2026-09-18T12:00:00Z"), "invite-1");
    expect(result.ok && result.value.email).toBe("new@example.com");
    expect(result.ok && result.value.expiresAt).toBe("2026-09-25T12:00:00.000Z");
  });

  it("rejects duplicate and owner invitations", () => {
    expect(createInvitation(owner, { email: owner.email, role: "viewer", scope: "assigned_records", modules: ["dashboard"] }, [owner], new Date(), "one")).toEqual({ ok: false, reason: "duplicate_email" });
    expect(createInvitation(owner, { email: "new@example.com", role: "owner", scope: "organization", modules: ["dashboard"] }, [owner], new Date(), "two")).toEqual({ ok: false, reason: "owner_invitation_forbidden" });
  });

  it("rejects an email that already has a pending invitation", () => {
    const first = createInvitation(owner, { email: "pending@example.com", role: "viewer", scope: "assigned_records", modules: ["dashboard"] }, [owner], new Date("2026-09-18T12:00:00Z"), "first");
    if (!first.ok) throw new Error("fixture invitation should be valid");
    const duplicate = createInvitation(owner, { email: "PENDING@example.com", role: "sales_rep", scope: "assigned_records", modules: ["dashboard"] }, [owner], new Date("2026-09-18T12:05:00Z"), "second", "d2-group", [first.value]);
    expect(duplicate).toEqual({ ok: false, reason: "duplicate_email" });
  });

  it("normalizes actor email and trims audit reasons", () => {
    const event = buildAuditEvent({ id: "audit-1", organizationId: "d2-group", action: "membership.updated", actorUid: owner.uid, actorEmail: " OWNER@EXAMPLE.COM ", targetType: "membership", targetId: manager.uid, summary: "Role updated", reason: "  review  ", occurredAt: "2026-09-18T12:00:00Z" });
    expect(event.actorEmail).toBe("owner@example.com");
    expect(event.reason).toBe("review");
  });
});
