import { describe, it, expect, vi } from "vitest";
import { observeSession } from "./observeSession";
import type { AuthGateway, AuthIdentity, MembershipRepository } from "./session";
import type { Membership } from "../domain/access";

const identity: AuthIdentity = { uid: "alice", email: "alice@example.com", displayName: "Alice" };
const membership: Membership = { ...identity, role: "viewer", status: "active", scope: "organization", modules: ["leads"] };

function harness() {
  let identityListener!: (identity: AuthIdentity | null) => void;
  let membershipListener!: (membership: Membership | null) => void;
  let failure!: () => void;
  const closeMembership = vi.fn();
  const closeIdentity = vi.fn();
  const auth: AuthGateway = { observeIdentity: (listener) => { identityListener = listener; return closeIdentity; }, signInWithGoogle: async () => identity, signOut: async () => {} };
  const repo: MembershipRepository = { observeByUid: (_uid, listener, onError) => { membershipListener = listener; failure = onError; return closeMembership; }, findByUid: async () => null, list: async () => [], listAudit: async () => [], save: async () => {} };
  const state = vi.fn();
  const error = vi.fn();
  const close = observeSession(auth, repo, state, error);
  return { emitIdentity: (value: AuthIdentity | null) => identityListener(value), emitMembership: (value: Membership | null) => membershipListener(value), fail: () => failure(), state, error, close, closeMembership, closeIdentity };
}

describe("live session authorization", () => {
  it("blocks an open workspace immediately when the membership is suspended or removed", () => {
    const h = harness(); h.emitIdentity(identity); h.emitMembership(membership);
    expect(h.state.mock.lastCall?.[0].status).toBe("authenticated");
    h.emitMembership({ ...membership, status: "suspended" });
    expect(h.state.mock.lastCall?.[0].status).toBe("access_blocked");
    h.emitMembership(null);
    expect(h.state.mock.lastCall?.[0].status).toBe("membership_required");
  });
  it("rejects late membership callbacks after logout and unsubscribes", () => {
    const h = harness(); h.emitIdentity(identity); h.emitMembership(membership); h.emitIdentity(null); h.emitMembership(membership);
    expect(h.state.mock.lastCall?.[0].status).toBe("signed_out");
    expect(h.closeMembership).toHaveBeenCalled(); h.close(); expect(h.closeIdentity).toHaveBeenCalled();
  });
  it("closes access on lookup failure and recovers on a confirmed server response", () => {
    const h = harness(); h.emitIdentity(identity); h.emitMembership(membership); h.fail();
    expect(h.state.mock.lastCall?.[0].status).toBe("loading"); expect(h.error).toHaveBeenLastCalledWith(identity);
    h.emitMembership(membership); expect(h.state.mock.lastCall?.[0].status).toBe("authenticated"); expect(h.error).toHaveBeenLastCalledWith(null);
  });
});
