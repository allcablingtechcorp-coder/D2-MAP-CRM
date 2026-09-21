import { useLifecycleText } from "../i18n/lifecycle";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ChevronRight, Clock3, History, LockKeyhole, MailPlus, Plus, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { demoMemberships } from "../data/demo";
import type { AccessScope, Membership, MembershipStatus, ModuleId, RoleId } from "../domain/access";
import { canManageMembership } from "../domain/access";
import {
  buildAuditEvent,
  createInvitation,
  membershipChanges,
  reviewMembershipChange,
  type AuditEvent,
  type GovernanceReason,
  type Invitation,
  type MembershipChangeReview,
  type Team,
} from "../domain/governance";
import { useI18n, type TranslationKey } from "../i18n/i18n";
import { PageHeader } from "./AppShell";
import { useRuntimeSession } from "../application/SessionRuntime";

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
  team_required: "admin.errorTeamRequired",
};
const assignableRoles: RoleId[] = ["operations_admin", "sales_manager", "sales_rep", "sdr", "viewer"];
const statuses: MembershipStatus[] = ["active", "suspended", "revoked"];
const scopes: AccessScope[] = ["organization", "assigned_teams", "assigned_records"];
const allModules: ModuleId[] = ["dashboard", "leads", "pipeline", "activities", "prospecting", "companies", "reports", "admin"];

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
  const labels = useLifecycleText();
  const [auditPage, setAuditPage] = useState(0);
  const { t, formatDateTime } = useI18n();
  const runtime = useRuntimeSession();
  const initialMembership = runtime.mode === "firebase" ? runtime.membership : demoMemberships[0];
  const [memberships, setMemberships] = useState<Membership[]>(runtime.mode === "firebase" ? [runtime.membership] : demoMemberships);
  const [selectedUid, setSelectedUid] = useState(initialMembership.uid);
  const [tab, setTab] = useState<"members" | "teams" | "invitations" | "audit">("members");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>(runtime.mode === "firebase" ? [] : initialAudit);
  const [loading, setLoading] = useState(runtime.mode === "firebase");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState<TranslationKey | "">("");
  const selected = memberships.find((member) => member.uid === selectedUid) ?? initialMembership;
  const actor = runtime.mode === "firebase" ? runtime.membership : memberships[0];
  const canEditSelected = canManageMembership(actor, selected);
  const [draftRole, setDraftRole] = useState<RoleId>(selected.role);
  const [draftStatus, setDraftStatus] = useState<MembershipStatus>(selected.status);
  const [draftScope, setDraftScope] = useState<AccessScope>(selected.scope);
  const [draftModules, setDraftModules] = useState<ModuleId[]>(selected.modules);
  const [draftTeamIds, setDraftTeamIds] = useState<string[]>(selected.teamIds ?? []);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<MembershipChangeReview | null>(null);

  useEffect(() => {
    if (runtime.mode !== "firebase") return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    Promise.all([runtime.memberships.list(), runtime.memberships.listAudit(), runtime.memberships.listGovernanceDirectory()])
      .then(([loadedMemberships, loadedAudit, directory]) => {
        if (!active) return;
        setMemberships(loadedMemberships);
        setAudit(loadedAudit);
        setInvitations(directory.invitations);
        setTeams(directory.teams);
        setSelectedUid((currentUid) => loadedMemberships.some((member) => member.uid === currentUid) ? currentUid : runtime.membership.uid);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [runtime]);

  const selectMember = (member: Membership) => {
    setSelectedUid(member.uid); setDraftRole(member.role); setDraftStatus(member.status); setDraftScope(member.scope); setDraftModules(member.modules); setDraftTeamIds(member.teamIds ?? []);
    setReason(""); setReview(null); setFeedbackKey("");
  };

  const reviewChange = () => {
    const result = reviewMembershipChange(actor, selected, { role: draftRole, status: draftStatus, scope: draftScope, modules: draftModules, teamIds: draftTeamIds }, reason, memberships);
    if (!result.ok) { setFeedbackKey(reasonKeys[result.reason]); setReview(null); return; }
    setFeedbackKey(""); setReview(result.value);
  };

  const confirmChange = async () => {
    if (!review) return;
    setSaving(true);
    try {
      if (runtime.mode === "firebase") {
        await runtime.memberships.save(review.after, review.reason);
        const [loadedMemberships, loadedAudit] = await Promise.all([runtime.memberships.list(), runtime.memberships.listAudit()]);
        setMemberships(loadedMemberships);
        setAudit(loadedAudit);
      } else {
        setMemberships((items) => items.map((item) => item.uid === review.after.uid ? review.after : item));
        setAudit((items) => [buildAuditEvent({
          id: crypto.randomUUID(), organizationId: "d2-group", action: review.after.status === "suspended" ? "membership.suspended" : review.after.status === "revoked" ? "membership.revoked" : "membership.updated",
          actorUid: actor.uid, actorEmail: actor.email, targetType: "membership", targetId: review.after.uid,
          summary: "admin.auditAccessUpdated", reason: review.reason, occurredAt: new Date().toISOString(), changes: membershipChanges(review),
        }), ...items]);
      }
      setReview(null); setReason(""); setFeedbackKey("admin.changeApplied");
    } catch {
      setFeedbackKey("auth.operationError");
    } finally {
      setSaving(false);
    }
  };

  const pendingInvitations = useMemo(() => invitations.filter((invite) => invite.status === "pending").length, [invitations]);

  return <>
    <PageHeader eyebrow={t("admin.eyebrow")} title={t("admin.title")} description={t("admin.description")} actions={actor.role === "owner" ? <button className="action-button" onClick={() => setInviteOpen(true)}><UserPlus size={17} /> {t("admin.invite")}</button> : undefined} />
    <div className="admin-alert"><ShieldCheck size={21} /><div><strong>{t("admin.protectedOwner")}</strong><span>{t("admin.protectedDescription")}</span></div></div>
    <div className="governance-tabs" role="tablist" aria-label={t("admin.governanceAreas")}>
      <button className={tab === "members" ? "active" : ""} onClick={() => setTab("members")}><UsersRound size={16} />{t("admin.membersTab")}<span>{memberships.length}</span></button>
      <button className={tab === "teams" ? "active" : ""} onClick={() => setTab("teams")}><UsersRound size={16} />{t("admin.teamsTab")}<span>{teams.length}</span></button>
      <button className={tab === "invitations" ? "active" : ""} onClick={() => setTab("invitations")}><MailPlus size={16} />{t("admin.invitationsTab")}<span>{pendingInvitations}</span></button>
      <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}><History size={16} />{t("admin.auditTab")}<span>{audit.length}</span></button>
    </div>

    {tab === "members" && <div className="admin-grid">
      <Panel title={t("admin.usersAccess")} description={runtime.mode === "firebase" ? t("admin.liveRecords", { count: memberships.length }) : t("admin.demoRecords", { count: memberships.length })}>
        {loading && <div className="governance-feedback" role="status">{t("auth.loadingDescription")}</div>}
        {loadError && <div className="governance-feedback error" role="alert">{t("auth.lookupErrorDescription")}</div>}
        <div className="member-list">{memberships.map((member) => <button key={member.uid} onClick={() => selectMember(member)} className={selected.uid === member.uid ? "selected" : ""}><span className="member-avatar">{initials(member.displayName)}</span><div><strong>{member.displayName}</strong><span>{member.email}</span></div><span className={`member-status ${member.status}`}>{t(statusKeys[member.status])}</span><ChevronRight size={16} /></button>)}</div>
      </Panel>
      <Panel title={t("admin.accessSummary")} description={selected.ownerProtected ? t("admin.ownerReadOnly") : t("admin.reviewBeforeSaving")}>
        <div className="access-detail">
          <div className="access-identity"><span className="member-avatar large">{initials(selected.displayName)}</span><div><strong>{selected.displayName}</strong><span>{selected.email}</span></div>{selected.ownerProtected && <span className="protected-chip"><LockKeyhole size={12} />{t("admin.protected")}</span>}</div>
          <div className="access-form-grid">
            <label>{t("admin.assignedRole")}<select value={draftRole} onChange={(event) => { setDraftRole(event.target.value as RoleId); setReview(null); }} disabled={!canEditSelected}>{selected.ownerProtected && <option value="owner">{t(roleKeys.owner)}</option>}{assignableRoles.map((role) => <option key={role} value={role}>{t(roleKeys[role])}</option>)}</select></label>
            <label>{t("admin.accessStatus")}<select value={draftStatus} onChange={(event) => { setDraftStatus(event.target.value as MembershipStatus); setReview(null); }} disabled={!canEditSelected}>{statuses.map((status) => <option key={status} value={status}>{t(statusKeys[status])}</option>)}</select></label>
            <label>{t("admin.dataScope")}<select value={draftScope} onChange={(event) => { setDraftScope(event.target.value as AccessScope); setReview(null); }} disabled={!canEditSelected}>{scopes.map((scope) => <option key={scope} value={scope}>{t(scopeKeys[scope])}</option>)}</select></label>
          </div>
          <fieldset className="access-options" disabled={!canEditSelected}><legend>{t("admin.allowedModules")}</legend>{allModules.map((module) => <label key={module}><input type="checkbox" checked={draftModules.includes(module)} onChange={() => { setDraftModules((items) => items.includes(module) ? items.filter((item) => item !== module) : [...items, module]); setReview(null); }} />{t(`nav.${module}` as TranslationKey)}</label>)}</fieldset>
          <fieldset className="access-options" disabled={!canEditSelected}><legend>{t("admin.assignedTeams")}</legend>{teams.length === 0 ? <small>{t("admin.noTeams")}</small> : teams.map((team) => <label key={team.id}><input type="checkbox" checked={draftTeamIds.includes(team.id)} onChange={() => { setDraftTeamIds((items) => items.includes(team.id) ? items.filter((item) => item !== team.id) : [...items, team.id]); setReview(null); }} />{team.name}</label>)}</fieldset>
          {canEditSelected && <label className="reason-field">{t("admin.changeReason")}<textarea value={reason} onChange={(event) => { setReason(event.target.value); setReview(null); }} placeholder={t("admin.changeReasonPlaceholder")} /></label>}
          {feedbackKey && <div className="governance-feedback" role="status">{t(feedbackKey)}</div>}
          {review && <div className="change-review"><div><ShieldCheck size={18} /><strong>{t("admin.reviewReady")}</strong></div><p>{t("admin.reviewFields", { count: review.changedFields.length })}</p><ul>{review.changedFields.map((field) => <li key={field}><span>{t(`admin.field.${field}` as TranslationKey)}</span><strong>{field === "role" ? t(roleKeys[review.after.role]) : field === "scope" ? t(scopeKeys[review.after.scope]) : field === "status" ? t(statusKeys[review.after.status]) : t("admin.accessListReviewed")}</strong></li>)}</ul></div>}
          <div className="access-actions">{review && <button className="action-button secondary" onClick={() => setReview(null)} disabled={saving}>{t("common.cancel")}</button>}<button className="action-button" disabled={!canEditSelected || saving} onClick={review ? confirmChange : reviewChange}>{review ? <Check size={16} /> : <ShieldCheck size={16} />}{review ? t("admin.confirmChange") : t("admin.review")}</button></div>
          <small className="prototype-copy">{t(runtime.mode === "firebase" ? "admin.firebasePersistence" : "admin.prototype")}</small>
        </div>
      </Panel>
    </div>}

    {tab === "teams" && <TeamsPanel teams={teams} memberships={memberships} canCreate={actor.role === "owner"} onCreate={async (name) => {
      const team = runtime.mode === "firebase" ? await runtime.memberships.createTeam(name) : { id: crypto.randomUUID(), organizationId: "d2-group", name, memberUids: [], createdAt: new Date().toISOString() };
      setTeams((items) => [...items, team]);
    }} />}

    {tab === "invitations" && <Panel title={t("admin.invitationsTitle")} description={t("admin.invitationsDescription")} action={<button className="action-button" onClick={() => setInviteOpen(true)}><MailPlus size={16} />{t("admin.newInvitation")}</button>}>
      {invitations.length === 0 ? <div className="empty-governance"><MailPlus size={28} /><strong>{t("admin.noInvitations")}</strong><span>{t("admin.noInvitationsDescription")}</span></div> : <div className="governance-table-wrap"><table className="data-table"><thead><tr><th>{t("admin.email")}</th><th>{t("admin.assignedRole")}</th><th>{t("admin.dataScope")}</th><th>{t("admin.status")}</th><th>{t("admin.expires")}</th></tr></thead><tbody>{invitations.map((invite) => <tr key={invite.id}><td><strong>{invite.email}</strong></td><td>{t(roleKeys[invite.role])}</td><td>{t(scopeKeys[invite.scope])}</td><td><span className="member-status invited">{t(`audit.invitation.${invite.status}` as TranslationKey)}</span></td><td>{formatDateTime(invite.expiresAt)}</td></tr>)}</tbody></table></div>}
    </Panel>}

    {tab === "audit" && <Panel title={t("admin.auditTitle")} description={t("admin.auditDescription")}>
      <div className="audit-list">{audit.length === 0 ? <div className="empty-governance"><History size={28} /><strong>{t("admin.noAudit")}</strong></div> : audit.slice(auditPage*50, auditPage*50+50).map((event) => <article key={event.id}><div className="audit-icon"><History size={16} /></div><div><strong>{t(event.summary as TranslationKey)}</strong><span>{event.actorEmail} · {event.targetId}</span>{event.reason && <small>{t("admin.reasonPrefix")}: {event.reason}</small>}</div><time><Clock3 size={13} />{formatDateTime(event.occurredAt)}</time></article>)}</div>
    <div className="toolbar"><button className="action-button secondary" disabled={auditPage===0} onClick={() => setAuditPage(auditPage-1)}>{labels.previous}</button><span>{Math.min(auditPage*50+1,audit.length)}–{Math.min((auditPage+1)*50,audit.length)} / {audit.length}</span><button className="action-button secondary" disabled={(auditPage+1)*50>=audit.length} onClick={() => setAuditPage(auditPage+1)}>{labels.next}</button></div></Panel>}

    {inviteOpen && <InviteDialog memberships={memberships} invitations={invitations} teams={teams} actor={actor} createRemote={runtime.mode === "firebase" ? (input) => runtime.memberships.createInvitation(input) : undefined} onClose={() => setInviteOpen(false)} onCreated={(invitation) => {
      setInvitations((items) => [invitation, ...items]);
      setAudit((items) => [buildAuditEvent({ id: crypto.randomUUID(), organizationId: "d2-group", action: "membership.invited", actorUid: actor.uid, actorEmail: actor.email, targetType: "invitation", targetId: invitation.id, summary: "admin.auditInvitationCreated", occurredAt: new Date().toISOString() }), ...items]);
      setInviteOpen(false); setTab("invitations");
    }} />}
  </>;
}

function TeamsPanel({ teams, memberships, canCreate, onCreate }: { teams: Team[]; memberships: Membership[]; canCreate: boolean; onCreate: (name: string) => Promise<void> }) {
  const { t, formatDateTime } = useI18n(); const [name, setName] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; setBusy(true); setError(false); try { await onCreate(name.trim()); setName(""); } catch { setError(true); } finally { setBusy(false); } };
  return <Panel title={t("admin.teamsTitle")} description={t("admin.teamsDescription")} action={canCreate ? <form className="team-create" onSubmit={submit}><input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("admin.teamName")} /><button className="action-button" disabled={busy || !name.trim()}><Plus size={16} />{t("admin.createTeam")}</button></form> : undefined}>{error && <div className="governance-feedback error">{t("auth.operationError")}</div>}{teams.length === 0 ? <div className="empty-governance"><UsersRound size={28} /><strong>{t("admin.noTeams")}</strong></div> : <div className="team-grid">{teams.map((team) => <article key={team.id}><UsersRound size={20} /><div><strong>{team.name}</strong><span>{t("admin.teamMembers", { count: memberships.filter((member) => member.teamIds?.includes(team.id)).length })}</span><small>{formatDateTime(team.createdAt)}</small></div></article>)}</div>}</Panel>;
}

function InviteDialog({ memberships, invitations, teams, actor, createRemote, onClose, onCreated }: { memberships: Membership[]; invitations: Invitation[]; teams: Team[]; actor: Membership; createRemote?: (input: { email: string; role: Exclude<RoleId, "owner">; scope: AccessScope; modules: ModuleId[]; teamIds: string[] }) => Promise<Invitation>; onClose: () => void; onCreated: (invitation: Invitation) => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleId>("sales_rep");
  const [scope, setScope] = useState<AccessScope>("assigned_records");
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>(["dashboard", "leads", "pipeline", "activities", "prospecting", "companies"]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | "">("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (scope === "assigned_teams" && teamIds.length === 0) { setErrorKey(reasonKeys.team_required); return; }
    const result = createInvitation(actor, { email, role, scope, modules: selectedModules }, memberships, new Date(), crypto.randomUUID(), "d2-group", invitations);
    if (!result.ok) { setErrorKey(reasonKeys[result.reason]); return; }
    setBusy(true); try { onCreated(createRemote ? await createRemote({ email: result.value.email, role: result.value.role, scope: result.value.scope, modules: selectedModules, teamIds }) : { ...result.value, teamIds }); } catch { setErrorKey("auth.operationError"); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section className="governance-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title"><header><div><span>{t("admin.secureAccess")}</span><h2 id="invite-title">{t("admin.inviteTitle")}</h2><p>{t("admin.inviteDescription")}</p></div><button className="icon-button" onClick={onClose} aria-label={t("common.cancel")}><X size={19} /></button></header><form onSubmit={submit}><label>{t("admin.email")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@company.com" autoFocus /></label><label>{t("admin.assignedRole")}<select value={role} onChange={(event) => setRole(event.target.value as RoleId)}>{assignableRoles.map((item) => <option key={item} value={item}>{t(roleKeys[item])}</option>)}</select></label><label>{t("admin.dataScope")}<select value={scope} onChange={(event) => setScope(event.target.value as AccessScope)}>{scopes.map((item) => <option key={item} value={item}>{t(scopeKeys[item])}</option>)}</select></label><fieldset className="access-options"><legend>{t("admin.allowedModules")}</legend>{allModules.map((module) => <label key={module}><input type="checkbox" checked={selectedModules.includes(module)} onChange={() => setSelectedModules((items) => items.includes(module) ? items.filter((item) => item !== module) : [...items, module])} />{t(`nav.${module}` as TranslationKey)}</label>)}</fieldset>{teams.length > 0 && <fieldset className="access-options"><legend>{t("admin.assignedTeams")}</legend>{teams.map((team) => <label key={team.id}><input type="checkbox" checked={teamIds.includes(team.id)} onChange={() => setTeamIds((items) => items.includes(team.id) ? items.filter((item) => item !== team.id) : [...items, team.id])} />{team.name}</label>)}</fieldset>}<div className="invite-policy"><ShieldCheck size={17} /><span>{t("admin.invitePolicy")}</span></div>{errorKey && <div className="governance-feedback error" role="alert">{t(errorKey)}</div>}<footer><button type="button" className="action-button secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="action-button" disabled={busy || selectedModules.length === 0}><MailPlus size={16} />{t("admin.createInvitation")}</button></footer></form></section></div>;
}
