import { useEffect, useState, type FormEvent } from "react";
import { X, Settings2 } from "lucide-react";
import { useCrmWorkspace } from "../application/CrmWorkspaceLive";
import type { AssignmentOptions, CommercialRecord, RecordChange, RecordCollection, RecordEvent } from "../application/commercial";
import { useLifecycleText } from "../i18n/lifecycle";
import { useI18n, type TranslationKey } from "../i18n/i18n";

type Field = "name" | "location" | "industry" | "website" | "phone" | "email" | "title" | "subject" | "kind" | "qualification" | "priority" | "nextAction" | "nextActionAt" | "dueAt" | "expectedCloseAt" | "amountCents" | "companyId";
const fields: Record<RecordCollection, Field[]> = {
  leads: ["companyId", "location", "qualification", "priority", "nextAction", "nextActionAt"],
  companies: ["name", "location", "industry", "website", "phone"],
  contacts: ["companyId", "name", "title", "email", "phone"],
  activities: ["companyId", "kind", "subject", "dueAt"],
  opportunities: ["companyId", "title", "amountCents", "nextAction", "expectedCloseAt"],
};
const choices: Partial<Record<Field, string[]>> = { qualification: ["new", "contacting", "qualified", "nurturing", "disqualified"], priority: ["high", "medium", "low"], kind: ["call", "email", "meeting", "visit", "note"] };
function title(record: CommercialRecord) { return "name" in record ? record.name : "title" in record ? record.title : "subject" in record ? record.subject : record.companyName; }
function fieldValue(record: CommercialRecord, key: Field) {
  const value = (record as unknown as Record<string, unknown>)[key];
  if (key === "amountCents") return typeof value === "number" ? String(value / 100) : "";
  if (["nextActionAt", "dueAt"].includes(key) && typeof value === "string" && value) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16); }
  return String(value ?? "");
}

export function RecordManagerButton({ collection }: { collection: RecordCollection }) {
  const l = useLifecycleText(); const [open, setOpen] = useState(false);
  return <><button className="action-button secondary" onClick={() => setOpen(true)}><Settings2 size={16}/>{l.manage}</button>{open && <RecordManager collection={collection} onClose={() => setOpen(false)}/>}</>;
}

function RecordManager({ collection, onClose }: { collection: RecordCollection; onClose: () => void }) {
  const l = useLifecycleText(), workspace = useCrmWorkspace();
  const [kind, setKind] = useState(collection), [archived, setArchived] = useState(false), [query, setQuery] = useState(""), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CommercialRecord | null>(null), [error, setError] = useState(false), [loading, setLoading] = useState(false);
  const rows = workspace.records[kind].filter((record) => !!record.archived === archived && `${title(record)} ${record.ownerName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const changeFilter = (update: () => void) => { update(); setPage(0); };
  return <div className="modal-backdrop record-manager-backdrop"><section className="governance-modal record-manager" role="dialog" aria-modal="true" aria-labelledby="record-manager-title"><header><div><h2 id="record-manager-title">{l.manage} · {l[kind]}</h2><p>{l.review}</p></div><button className="icon-button" onClick={onClose} aria-label={l.cancel}><X/></button></header>
    <div className="toolbar"><input aria-label={l.search} placeholder={l.search} value={query} onChange={(event) => changeFilter(() => setQuery(event.target.value))}/>{collection === "companies" && <select aria-label={l.manage} value={kind} onChange={(event) => changeFilter(() => setKind(event.target.value as RecordCollection))}><option value="companies">{l.companies}</option><option value="contacts">{l.contacts}</option></select>}<select aria-label={l.action} value={String(archived)} onChange={(event) => changeFilter(() => setArchived(event.target.value === "true"))}><option value="false">{l.active}</option><option value="true">{l.archived}</option></select><button className="action-button secondary" disabled={loading} onClick={async () => { setLoading(true); setError(false); try { await workspace.refresh(); } catch { setError(true); } finally { setLoading(false); } }}>{l.refresh}</button></div>
    {error && <p role="alert">{l.error}</p>}<div className="record-manager-list">{rows.slice(page*25, page*25+25).map((record) => <button className="record-manager-row" key={record.id} onClick={() => setSelected(record)}><span><strong>{title(record)}</strong><small>{record.ownerName}{"companyName" in record ? ` · ${record.companyName}` : ""}</small></span><span>{l.edit} / {l.history}</span></button>)}{rows.length === 0 && <p>{l.empty}</p>}</div>
    <footer><button className="action-button secondary" disabled={page===0} onClick={() => setPage(page-1)}>{l.previous}</button><span>{Math.min(page*25+1,rows.length)}–{Math.min((page+1)*25,rows.length)} / {rows.length}</span><button className="action-button secondary" disabled={(page+1)*25>=rows.length} onClick={() => setPage(page+1)}>{l.next}</button></footer>
    {selected && <RecordEditor key={`${kind}:${selected.id}`} kind={kind} record={selected} onClose={() => setSelected(null)}/>}
  </section></div>;
}

function RecordEditor({ kind, record, onClose }: { kind: RecordCollection; record: CommercialRecord; onClose: () => void }) {
  const l = useLifecycleText(), { t, formatDateTime } = useI18n(), workspace = useCrmWorkspace();
  const [draft, setDraft] = useState<Record<string,string>>(() => Object.fromEntries(fields[kind].map((key) => [key, fieldValue(record,key)])));
  const [action, setAction] = useState<RecordChange["action"]>(record.archived ? "restore" : "edit"), [reason, setReason] = useState(""), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [assignment, setAssignment] = useState<AssignmentOptions>({ members: [], teams: [], canAssign: false }), [ownerUid, setOwnerUid] = useState(record.ownerUid ?? ""), [teamId, setTeamId] = useState(record.teamId ?? "");
  const [events, setEvents] = useState<RecordEvent[]>([]), [historyError, setHistoryError] = useState(false), [historyLoaded, setHistoryLoaded] = useState(false);
  const editable = workspace.can(kind === "opportunities" ? "opportunity.update" : kind === "activities" ? "activity.create" : "lead.update");
  const completed = "completed" in record && record.completed;
  const canReopen = "stage" in record && ["won","lost"].includes(record.stage) && workspace.can("opportunity.reopen");
  const companies = [...new Map([...workspace.companies.map((company) => [company.id, { id:company.id, name:company.name, location:company.location }] as const), ...workspace.leads.filter((lead) => lead.companyId).map((lead) => [lead.companyId!, { id:lead.companyId!, name:lead.companyName, location:lead.location }] as const)].map((entry) => entry)).values()];
  useEffect(() => { let active = true; workspace.assignmentOptions().then((data) => { if(active) setAssignment(data); }).catch(() => { if(active) setError(l.error); }); workspace.history(kind,record.id).then((data) => { if(active) { setEvents(data); setHistoryLoaded(true); } }).catch(() => { if(active) setHistoryError(true); }); return () => { active=false; }; }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const patch: Record<string,unknown> = {};
      for(const key of fields[kind]) if (draft[key] !== fieldValue(record,key)) patch[key] = key === "amountCents" ? draft[key] ? Math.round(Number(draft[key])*100) : null : ["dueAt","nextActionAt"].includes(key) ? new Date(draft[key]).toISOString() : draft[key];
      if(action === "edit" && !Object.keys(patch).length) { onClose(); return; }
      await workspace.changeRecord({ collection:kind, recordId:record.id, revision:record.revision ?? "", action, reason, ...(action === "edit" ? { patch } : {}), ...(action === "reassign" ? { ownerUid, teamId:teamId || null } : {}) });
      onClose();
    } catch (error) { setError((error as {code?:string}).code === "functions/aborted" ? l.conflict : l.error); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop record-editor-backdrop"><section className="governance-modal commercial-modal record-editor" role="dialog" aria-modal="true" aria-labelledby="record-editor-title"><header><div><h2 id="record-editor-title">{title(record)}</h2><p>{record.ownerName}</p></div><button className="icon-button" disabled={saving} onClick={onClose} aria-label={l.cancel}><X/></button></header>
    {editable && <form onSubmit={submit}><label>{l.action}<select value={action} onChange={(event) => setAction(event.target.value as RecordChange["action"])}>{record.archived ? <option value="restore">{l.restore}</option> : <><option value="edit" disabled={completed}>{l.edit}</option><option value="archive">{l.archive}</option>{assignment.canAssign && <option value="reassign">{l.reassign}</option>}{canReopen && <option value="reopen">{l.reopen}</option>}</>}</select></label>
      {action === "edit" && completed ? <p>{l.closedNote}</p> : action === "edit" && <div className="dialog-grid">{fields[kind].map((key) => <label key={key}>{l[key]}{key === "companyId" ? <select value={draft[key]} onChange={(event) => setDraft({...draft,[key]:event.target.value})}><option value="">{l.selectCompany}</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name} · {company.location}</option>)}</select> : choices[key] ? <select value={draft[key]} onChange={(event) => setDraft({...draft,[key]:event.target.value})}>{choices[key]!.map((value) => <option key={value} value={value}>{t(`${key === "kind" ? "activity" : key}.${value}` as TranslationKey)}</option>)}</select> : <input type={key === "amountCents" ? "number" : key === "expectedCloseAt" ? "date" : ["dueAt","nextActionAt"].includes(key) ? "datetime-local" : key === "email" ? "email" : key === "website" ? "url" : "text"} step={key === "amountCents" ? "0.01" : undefined} min={key === "amountCents" ? "0.01" : undefined} value={draft[key]} onChange={(event) => setDraft({...draft,[key]:event.target.value})}/>}</label>)}</div>}
      {action === "reassign" && <><p>{l.assignedNote}</p><div className="dialog-grid"><label>{l.owner}<select required value={ownerUid} onChange={(event) => setOwnerUid(event.target.value)}><option value="">—</option>{assignment.members.map((member) => <option key={member.uid} value={member.uid}>{member.name}</option>)}</select></label><label>{l.team}<select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">{l.none}</option>{assignment.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label></div></>}
      {action === "restore" && kind !== "companies" && <p>{l.archivedHint}</p>}<label>{l.reason}<textarea required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)}/></label>{error && <p className="governance-feedback error" role="alert">{error}</p>}<footer><button className="action-button secondary" type="button" disabled={saving} onClick={onClose}>{l.cancel}</button><button className="action-button" disabled={saving || action === "edit" && completed}>{saving ? l.loading : l.save}</button></footer></form>}
    <section className="record-history"><h3>{l.history}</h3>{historyError ? <p role="alert">{l.error}</p> : !historyLoaded ? <p>{l.loading}</p> : !events.length ? <p>{l.noHistory}</p> : events.map((event) => <article key={event.id}><strong>{l[event.action.split(".").at(-1) as keyof typeof l] ?? l.updated}</strong><time>{formatDateTime(event.at)}</time><p>{event.reason}</p><small>{event.actor}</small></article>)}</section>
  </section></div>;
}
