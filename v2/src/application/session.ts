import type { Membership } from "../domain/access";
import type { AuditEvent, Invitation, InvitationInput, Team } from "../domain/governance";

export interface AuthIdentity {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
}

export type SessionState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "membership_required"; identity: AuthIdentity }
  | { status: "access_blocked"; identity: AuthIdentity; membership: Membership; reason: "suspended" | "revoked" | "invited" }
  | { status: "authenticated"; identity: AuthIdentity; membership: Membership };

export interface AuthGateway {
  observeIdentity(listener: (identity: AuthIdentity | null) => void): () => void;
  signInWithGoogle(): Promise<AuthIdentity>;
  signInFromPortal?(portalToken: string, company: "smart" | "hvac"): Promise<void>;
  signOut(): Promise<void>;
  isEmailLink?(): boolean;
  requestEmailLink?(email:string,locale:string):Promise<void>;
  completeEmailLink?(email:string):Promise<void>;
}

export interface MembershipRepository {
  observeByUid(uid: string, listener: (membership: Membership | null) => void, onError: () => void): () => void;
  findByUid(uid: string): Promise<Membership | null>;
  list(): Promise<Membership[]>;
  listAudit(): Promise<AuditEvent[]>;
  save(membership: Membership, reason: string): Promise<void>;
  listGovernanceDirectory(): Promise<{ invitations: Invitation[]; teams: Team[] }>;
  createInvitation(input: InvitationInput & { teamIds: string[] }): Promise<Invitation>;
  createTeam(name: string): Promise<Team>;
  manageInvitation?(action:"resend"|"renew"|"delete",invitationId:string,patch?:Pick<InvitationInput,"role"|"scope"|"modules"|"companyIds">):Promise<void>;
  acceptInvitation(): Promise<boolean>;
  recordSessionEvent(event: "signed_in" | "access_denied"): Promise<void>;
}

export function resolveSession(identity: AuthIdentity | null, membership: Membership | null): SessionState {
  if (!identity) return { status: "signed_out" };
  if (!membership) return { status: "membership_required", identity };
  if (membership.uid !== identity.uid || membership.email.trim().toLowerCase() !== identity.email.trim().toLowerCase()) return { status: "membership_required", identity };
  if (membership.status !== "active") return { status: "access_blocked", identity, membership, reason: membership.status };
  return { status: "authenticated", identity, membership };
}
