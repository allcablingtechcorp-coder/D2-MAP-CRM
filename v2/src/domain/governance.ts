import {
  PROTECTED_OWNER_EMAIL,
  canManageMembership,
  type AccessScope,
  type Membership,
  type MembershipStatus,
  type ModuleId,
  type RoleId,
} from "./access";

export type GovernanceReason =
  | "actor_not_authorized"
  | "protected_owner"
  | "last_active_owner"
  | "reason_required"
  | "owner_invitation_forbidden"
  | "invalid_email"
  | "duplicate_email"
  | "team_required";

export type GovernanceResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: GovernanceReason };

export interface MembershipPatch {
  role: RoleId;
  status: MembershipStatus;
  scope: AccessScope;
  modules: ModuleId[];
  teamIds: string[];
}

export interface MembershipChangeReview {
  before: Membership;
  after: Membership;
  reason: string;
  changedFields: Array<keyof MembershipPatch>;
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  companyIds?: string[];
  id: string;
  organizationId: string;
  email: string;
  role: Exclude<RoleId, "owner">;
  scope: AccessScope;
  modules: ModuleId[];
  teamIds?: string[];
  status: InvitationStatus;
  invitedByUid: string;
  createdAt: string;
  expiresAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  memberUids: string[];
  createdAt: string;
}

export interface InvitationInput {
  companyIds?: string[];
  email: string;
  role: RoleId;
  scope: AccessScope;
  modules: ModuleId[];
}

export type AuditAction =
  | "auth.signed_in"
  | "auth.access_denied"
  | "membership.invited"
  | "membership.invitation_accepted"
  | "membership.updated"
  | "membership.suspended"
  | "membership.revoked"
  | "report.exported"
  | "commercial.lead_created"
  | "commercial.activity_created"
  | "commercial.activity_completed"
  | "commercial.opportunity_created"
  | "commercial.opportunity_stage_changed"
  | "commercial.company_created"
  | "commercial.contact_created"
  | "team.created";

export interface AuditEvent {
  id: string;
  organizationId: string;
  action: AuditAction;
  actorUid: string;
  actorEmail: string;
  targetType: "membership" | "invitation" | "report" | "session" | "lead" | "activity" | "opportunity" | "company" | "contact" | "team";
  targetId: string;
  summary: string;
  reason?: string;
  occurredAt: string;
  changes?: Record<string, { from: string; to: string }>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isProtectedOwner(membership: Membership): boolean {
  return membership.ownerProtected === true || normalizeEmail(membership.email) === PROTECTED_OWNER_EMAIL;
}

export function reviewMembershipChange(
  actor: Membership,
  target: Membership,
  patch: MembershipPatch,
  reason: string,
  memberships: Membership[],
): GovernanceResult<MembershipChangeReview> {
  if (!canManageMembership(actor, target)) {
    return { ok: false, reason: isProtectedOwner(target) ? "protected_owner" : "actor_not_authorized" };
  }
  if (!reason.trim()) return { ok: false, reason: "reason_required" };
  if (patch.scope === "assigned_teams" && patch.teamIds.length === 0) return { ok: false, reason: "team_required" };

  const removesOwner = target.role === "owner" && target.status === "active" && (patch.role !== "owner" || patch.status !== "active");
  const activeOwners = memberships.filter((member) => member.role === "owner" && member.status === "active");
  if (removesOwner && activeOwners.length <= 1) return { ok: false, reason: "last_active_owner" };

  const after: Membership = {
    ...target,
    role: patch.role,
    status: patch.status,
    scope: patch.scope,
    modules: [...new Set(patch.modules)],
    teamIds: [...new Set(patch.teamIds)],
  };
  const changedFields = (["role", "status", "scope", "modules", "teamIds"] as const).filter((field) => {
    if (field === "modules" || field === "teamIds") return (target[field] ?? []).join("|") !== (after[field] ?? []).join("|");
    return target[field] !== after[field];
  });

  return { ok: true, value: { before: target, after, reason: reason.trim(), changedFields } };
}

export function createInvitation(
  actor: Membership,
  input: InvitationInput,
  memberships: Membership[],
  now: Date,
  id: string,
  organizationId = "d2-group",
  existingInvitations: Invitation[] = [],
): GovernanceResult<Invitation> {
  if (actor.role !== "owner" || actor.status !== "active") return { ok: false, reason: "actor_not_authorized" };
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "invalid_email" };
  if (memberships.some((member) => normalizeEmail(member.email) === email) || existingInvitations.some((invite) => invite.status === "pending" && Date.parse(invite.expiresAt) > now.getTime() && normalizeEmail(invite.email) === email)) return { ok: false, reason: "duplicate_email" };
  if (input.role === "owner") return { ok: false, reason: "owner_invitation_forbidden" };
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    ok: true,
    value: {
      id,
      organizationId,
      email,
      role: input.role,
      scope: input.scope,
      modules: [...new Set(input.modules)],
      status: "pending",
      invitedByUid: actor.uid,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export function buildAuditEvent(input: Omit<AuditEvent, "actorEmail"> & { actorEmail: string }): AuditEvent {
  return { ...input, actorEmail: normalizeEmail(input.actorEmail), reason: input.reason?.trim() || undefined };
}

export function membershipChanges(review: MembershipChangeReview): AuditEvent["changes"] {
  return Object.fromEntries(review.changedFields.map((field) => [field, {
    from: field === "modules" || field === "teamIds" ? (review.before[field] ?? []).join(", ") : String(review.before[field]),
    to: field === "modules" || field === "teamIds" ? (review.after[field] ?? []).join(", ") : String(review.after[field]),
  }]));
}
