import { useMemo, useState, type FormEvent } from "react";
import { Check, ChevronRight, Clock3, History, LockKeyhole, MailPlus, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { demoMemberships } from "../data/demo";
import type { AccessScope, Membership, MembershipStatus, ModuleId, RoleId } from "../domain/access";
import {
  buildAuditEvent,
  createInvitation,
  membershipChanges,
  reviewMembershipChange,
  type AuditEvent,
  type GovernanceReason,
  type Invitation,
  type MembershipChangeReview,
} from "../domain/governance";
import { useI18n, type TranslationKey } from "../i18n/i18n";
import { PageHeader } from "./AppShell";

const roleKeys: Record<RoleId, TranslationKey> = { owner: "role.owner", operations_admin: "role.operations_admin", sales_manager: "role.sales_manager", sales_rep: "role.sales_rep", sdr: "role.sdr", viewer: "role.viewer" };
const scopeKeys: Record<AccessScope, TranslationKey> = { organization: "admin.allOrganization", assigned_teams: "admin.assignedTeams", assigned_records: "admin.assignedRecords", custom: "admin.customScope" };
const statusKeys: Record<MembershipStatus, TranslationKey> = { active: "common.active", invited: "common.invited", suspended: "common.suspended", revoked: "common.revoked" };
const reasonKeys: Record<GovernanceReason, TranslationKey> = {
  actor_not_authorized: "admin.errorUnauthorized",
  protected_owner: "admin.errorProtectedOwner",
  last_active_owner: "admin.errorLastOwner",
  reason_required: "admin.errorReasonRequired",
  owner_invitation_forbidden: "admin.errorOwnerInvitation",
  invalid_email: "admin.errorInvalidEmail",
  duplicate_email: "admin.errorDuplicateEmail",
};
const assignableRoles: RoleId[] = ["operations_admin", "sales_manager", "sales_rep", "sdr", "viewer"];
const statuses: MembershipStatus[] = ["active", "suspended", "revoked"];
const scopes: AccessScope[] = ["organization", "assigned_teams", "assigned_records"];

const initialAudit: AuditEvent[] = [buildAuditEvent({
  id: "audit-demo-1", organizationId: "d2-group", action: "auth.signed_in", actorUid: "owner-demo",
  actorEmail: "allcablingtechcorp@gmail.com", targetType: "session", targetId: "session-demo",
  summary: "admin.auditSignedIn", occurredAt: "2026-09-18T09:42:00-04:00",
})];

function Panel({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="panel"><header className="panel-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>{children}</section>;
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function AdminGovernance() {
  const { t, formatDateTime } = useI18n();
  const [memberships, setMemberships] = useState<Membership[]>(demoMemberships);
  const [selectedUid, setSelectedUid] = useState(demoMemberships[0].uid);
  const [tab, setTab] = useState<"members" | "invitations" | "audit">("members");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>(initialAudit);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState<TranslationKey | "">("");
  const selected = memberships.find((member) => member.uid === selectedUid) ?? memberships[0];
  const actor = memberships[0];
  const [draftRole, setDraftRole] = useState<RoleId>(selected.role);
  const [draftStatus, setDraftStatus] = useState<MembershipStatus>(selected.status);
  const [draftScope, setDraftScope] = useState<AccessScope>(selected.scope);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<MembershipChangeReview | null>(null);

  const selectMember = (member: Membership) => {
    setSelectedUid(member.uid); setDraftRole(member.role); setDraftStatus(member.status); setDraftScope(member.scope);
    setReason(""); setReview(null); setFeedbackKey("");
  };

  const reviewChange = () => {
    const result = reviewMembershipChange(actor, selected, { role: draftRole, status: draftStatus, scope: draftScope, modules: selected.modules }, reason, memberships);
    if (!result.ok) { setFeedbackKey(reasonKeys[result.reason]); setReview(null); return; }
    setFeedbackKey(""); setReview(result.value);
  };

  const confirmChange = () => {
    if (!review) return;
    setMemberships((items) => items.map((item) => item.uid === review.after.uid ? review.after : item));
    setAudit((items) => [buildAuditEvent({
      id: crypto.randomUUID(), organizationId: "d2-group", action: review.after.status === "suspended" ? "membership.suspended" : review.after.status === "revoked" ? "membership.revoked" : "membership.updated",
      actorUid: actor.uid, actorEmail: actor.email, targetType: "membership", targetId: review.after.uid,
      summary: "admin.auditAccessUpdated", reason: review.reason, occurredAt: new Date().toISOString(), changes: membershipChanges(review),
    }), ...items]);
    setReview(null); setReason(""); setFeedbackKey("admin.changeApplied");
  };

  const pendingInvitations = useMemo(() => invitations.filter((invite) => invite.status === "pending").length, [invitations]);

  return <>
    <PageHeader eyebrow={t("admin.eyebrow")} title={t("admin.title")} description={t("admin.description")} actions={<button className="action-button" onClick={() => setInviteOpen(true)}><UserPlus size={17} /> {t("admin.invite")}</button>} />
    <div className="admin-alert"><ShieldCheck size={21} /><div><strong>{t("admin.protectedOwner")}</strong><span>{t("admin.protectedDescription")}</span></div></div>
    <div className="governance-tabs" role="tablist" aria-label={t("admin.governanceAreas")}>
      <button className={tab === "members" ? "active" : ""} onClick={() => setTab("members")}><UsersRound size={16} />{t("admin.membersTab")}<span>{memberships.length}</span></button>
      <button className={tab === "invitations" ? "active" : ""} onClick={() => setTab("invitations")}><MailPlus size={16} />{t("admin.invitationsTab")}<span>{pendingInvitations}</span></button>
      <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}><History size={16} />{t("admin.auditTab")}<span>{audit.length}</span></button>
    </div>

    {tab === "members" && <div className="admin-grid">
      <Panel title={t("admin.usersAccess")} description={t("admin.demoRecords", { count: memberships.length })}>
        <div className="member-list">{memberships.map((member) => <button key={member.uid} onClick={() => selectMember(member)} className={selected.uid === member.uid ? "selected" : ""}><span className="member-avatar">{initials(member.displayName)}</span><div><strong>{member.displayName}</strong><span>{member.email}</span></div><span className={`member-status ${member.status}`}>{t(statusKeys[member.status])}</span><ChevronRight size={16} /></button>)}</div>
      </Panel>
      <Panel title={t("admin.accessSummary")} description={selected.ownerProtected ? t("admin.ownerReadOnly") : t("admin.reviewBeforeSaving")}>
        <div className="access-detail">
          <div className="access-identity"><span className="member-avatar large">{initials(selected.displayName)}</span><div><strong>{selected.displayName}</strong><span>{selected.email}</span></div>{selected.ownerProtected && <span className="protected-chip"><LockKeyhole size={12} />{t("admin.protected")}</span>}</div>
          <div className="access-form-grid">
            <label>{t("admin.assignedRole")}<select value={draftRole} onChange={(event) => { setDraftRole(event.target.value as RoleId); setReview(null); }} disabled={selected.ownerProtected}>{selected.ownerProtected && <option value="owner">{t(roleKeys.owner)}</option>}{assignableRoles.map((role) => <option key={role} value={role}>{t(roleKeys[role])}</option>)}</select></label>
            <label>{t("admin.accessStatus")}<select value={draftStatus} onChange={(event) => { setDraftStatus(event.target.value as MembershipStatus); setReview(null); }} disabled={selected.ownerProtected}>{statuses.map((status) => <option key={status} value={status}>{t(statusKeys[status])}</option>)}</select></label>
            <label>{t("admin.dataScope")}<select value={draftScope} onChange={(event) => { setDraftScope(event.target.value as AccessScope); setReview(null); }} disabled={selected.ownerProtected}>{scopes.map((scope) => <option key={scope} value={scope}>{t(scopeKeys[scope])}</option>)}</select></label>
          </div>
          <div><span className="field-label">{t("admin.allowedModules")}</span><div className="module-tags">{selected.modules.map((module) => <span key={module}>{t(`nav.${module}` as TranslationKey)}</span>)}</div></div>
          {!selected.ownerProtected && <label className="reason-field">{t("admin.changeReason")}<textarea value={reason} onChange={(event) => { setReason(event.target.value); setReview(null); }} placeholder={t("admin.changeReasonPlaceholder")} /></label>}
          {feedbackKey && <div className="governance-feedback" role="status">{t(feedbackKey)}</div>}
          {review && <div className="change-review"><div><ShieldCheck size={18} /><strong>{t("admin.reviewReady")}</strong></div><p>{t("admin.reviewFields", { count: review.changedFields.length })}</p><ul>{review.changedFields.map((field) => <li key={field}><span>{t(`admin.field.${field}` as TranslationKey)}</span><strong>{field === "role" ? t(roleKeys[review.after.role]) : field === "scope" ? t(scopeKeys[review.after.scope]) : field === "status" ? t(statusKeys[review.after.status]) : t("admin.modulesUnchanged")}</strong></li>)}</ul></div>}
          <div className="access-actions">{review && <button className="action-button secondary" onClick={() => setReview(null)}>{t("common.cancel")}</button>}<button className="action-button" disabled={selected.ownerProtected} onClick={review ? confirmChange : reviewChange}>{review ? <Check size={16} /> : <ShieldCheck size={16} />}{review ? t("admin.confirmChange") : t("admin.review")}</button></div>
          <small className="prototype-copy">{t("admin.prototype")}</small>
        </div>
      </Panel>
    </div>}

    {tab === "invitations" && <Panel title={t("admin.invitationsTitle")} description={t("admin.invitationsDescription")} action={<button className="action-button" onClick={() => setInviteOpen(true)}><MailPlus size={16} />{t("admin.newInvitation")}</button>}>
      {invitations.length === 0 ? <div className="empty-governance"><MailPlus size={28} /><strong>{t("admin.noInvitations")}</strong><span>{t("admin.noInvitationsDescription")}</span></div> : <div className="governance-table-wrap"><table className="data-table"><thead><tr><th>{t("admin.email")}</th><th>{t("admin.assignedRole")}</th><th>{t("admin.dataScope")}</th><th>{t("admin.status")}</th><th>{t("admin.expires")}</th></tr></thead><tbody>{invitations.map((invite) => <tr key={invite.id}><td><strong>{invite.email}</strong></td><td>{t(roleKeys[invite.role])}</td><td>{t(scopeKeys[invite.scope])}</td><td><span className="member-status invited">{t("admin.pending")}</span></td><td>{formatDateTime(invite.expiresAt)}</td></tr>)}</tbody></table></div>}
    </Panel>}

    {tab === "audit" && <Panel title={t("admin.auditTitle")} description={t("admin.auditDescription")}>
      <div className="audit-list">{audit.map((event) => <article key={event.id}><div className="audit-icon"><History size={16} /></div><div><strong>{t(event.summary as TranslationKey)}</strong><span>{event.actorEmail} · {event.targetId}</span>{event.reason && <small>{t("admin.reasonPrefix")}: {event.reason}</small>}</div><time><Clock3 size={13} />{formatDateTime(event.occurredAt)}</time></article>)}</div>
    </Panel>}

    {inviteOpen && <InviteDialog memberships={memberships} invitations={invitations} actor={actor} onClose={() => setInviteOpen(false)} onCreated={(invitation) => {
      setInvitations((items) => [invitation, ...items]);
      setAudit((items) => [buildAuditEvent({ id: crypto.randomUUID(), organizationId: "d2-group", action: "membership.invited", actorUid: actor.uid, actorEmail: actor.email, targetType: "invitation", targetId: invitation.id, summary: "admin.auditInvitationCreated", occurredAt: new Date().toISOString() }), ...items]);
      setInviteOpen(false); setTab("invitations");
    }} />}
  </>;
}

function InviteDialog({ memberships, invitations, actor, onClose, onCreated }: { memberships: Membership[]; invitations: Invitation[]; actor: Membership; onClose: () => void; onCreated: (invitation: Invitation) => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleId>("sales_rep");
  const [scope, setScope] = useState<AccessScope>("assigned_records");
  const [errorKey, setErrorKey] = useState<TranslationKey | "">("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const defaultModules: ModuleId[] = role === "viewer" ? ["dashboard", "leads", "reports"] : ["dashboard", "leads", "pipeline", "activities", "prospecting", "companies"];
    const result = createInvitation(actor, { email, role, scope, modules: defaultModules }, memberships, new Date(), crypto.randomUUID(), "d2-group", invitations);
    if (!result.ok) { setErrorKey(reasonKeys[result.reason]); return; }
    onCreated(result.value);
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section className="governance-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title"><header><div><span>{t("admin.secureAccess")}</span><h2 id="invite-title">{t("admin.inviteTitle")}</h2><p>{t("admin.inviteDescription")}</p></div><button className="icon-button" onClick={onClose} aria-label={t("common.cancel")}><X size={19} /></button></header><form onSubmit={submit}><label>{t("admin.email")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@company.com" autoFocus /></label><label>{t("admin.assignedRole")}<select value={role} onChange={(event) => setRole(event.target.value as RoleId)}>{assignableRoles.map((item) => <option key={item} value={item}>{t(roleKeys[item])}</option>)}</select></label><label>{t("admin.dataScope")}<select value={scope} onChange={(event) => setScope(event.target.value as AccessScope)}>{scopes.map((item) => <option key={item} value={item}>{t(scopeKeys[item])}</option>)}</select></label><div className="invite-policy"><ShieldCheck size={17} /><span>{t("admin.invitePolicy")}</span></div>{errorKey && <div className="governance-feedback error" role="alert">{t(errorKey)}</div>}<footer><button type="button" className="action-button secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="action-button"><MailPlus size={16} />{t("admin.createInvitation")}</button></footer></form></section></div>;
}
