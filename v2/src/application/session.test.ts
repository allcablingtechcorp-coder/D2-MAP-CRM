import { describe, expect, it } from "vitest";
import type { Membership } from "../domain/access";
import { resolveSession, type AuthIdentity } from "./session";

const identity: AuthIdentity = { uid: "user-1", email: "user@example.com", displayName: "User" };
const membership: Membership = { uid: identity.uid, email: identity.email, displayName: identity.displayName, role: "sales_rep", status: "active", scope: "assigned_records", modules: ["dashboard"] };

describe("session resolution", () => {
  it("rejects mismatched identity and membership", () => {
    expect(resolveSession(identity, { ...membership, uid: "another-user" }).status).toBe("membership_required");
    expect(resolveSession(identity, { ...membership, email: "another@example.com" }).status).toBe("membership_required");
  });
  it("requires authentication when no identity exists", () => expect(resolveSession(null, null).status).toBe("signed_out"));
  it("requires membership after successful identity authentication", () => expect(resolveSession(identity, null).status).toBe("membership_required"));
  it("blocks suspended memberships", () => expect(resolveSession(identity, { ...membership, status: "suspended" }).status).toBe("access_blocked"));
  it("authenticates only active memberships", () => expect(resolveSession(identity, membership).status).toBe("authenticated"));
});
