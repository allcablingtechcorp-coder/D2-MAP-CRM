import { resolveSession, type AuthGateway, type AuthIdentity, type MembershipRepository, type SessionState } from "./session";

// Never let a previous account's pending listener restore access after logout.
export function observeSession(auth: AuthGateway, memberships: MembershipRepository, onSession: (state: SessionState) => void, onError: (identity: AuthIdentity | null) => void): () => void {
  let revision = 0;
  let unsubscribeMembership = () => {};
  const unsubscribeAuth = auth.observeIdentity((identity) => {
    const current = ++revision;
    unsubscribeMembership();
    unsubscribeMembership = () => {};
    onError(null);
    onSession(identity ? { status: "loading" } : { status: "signed_out" });
    if (!identity) return;
    unsubscribeMembership = memberships.observeByUid(identity.uid, (membership) => {
      if (revision !== current) return;
      onError(null);
      onSession(resolveSession(identity, membership));
    }, () => {
      if (revision !== current) return;
      onSession({ status: "loading" });
      onError(identity);
    });
  });
  return () => { revision++; unsubscribeMembership(); unsubscribeAuth(); };
}
