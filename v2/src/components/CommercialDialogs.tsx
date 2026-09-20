import { useState, type FormEvent } from "react";
import { CalendarPlus, CircleDollarSign, UserPlus, X } from "lucide-react";
import { useCrmWorkspace } from "../application/CrmWorkspace";
import type { ActivityKind, Lead } from "../domain/crm";
import type { LeadInput } from "../domain/workflows";
import { useI18n, type TranslationKey } from "../i18n/i18n";

function localDateTime(hoursAhead = 24) {
  const value = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function LeadDialog({ preset, onClose, onCreated }: { preset?: Partial<LeadInput>; onClose: () => void; onCreated?: (lead: Lead) => void }) {
  const { t } = useI18n();
  const workspace = useCrmWorkspace();
  const [companyName, setCompanyName] = useState(preset?.companyName ?? "");
  const [location, setLocation] = useState(preset?.location ?? "");
  const [ownerName, setOwnerName] = useState(preset?.ownerName ?? "Dante Frota");
  const [priority, setPriority] = useState<Lead["priority"]>(preset?.priority ?? "medium");
  const [nextAction, setNextAction] = useState(preset?.nextAction ?? "");
  const [nextActionAt, setNextActionAt] = useState(preset?.nextActionAt ?? localDateTime());
  const [errorKey, setErrorKey] = useState<TranslationKey | "">("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = workspace.createLead({ companyName, location, ownerName, priority, nextAction, nextActionAt, source: preset?.source ?? "manual" });
    if (!result.ok) {
      setErrorKey(result.reason === "permission_denied" ? "workspace.denied" : result.reason === "duplicate" ? "leadDialog.duplicate" : "leadDialog.required");
      return;
    }
    onCreated?.(result.lead);
    onClose();
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section className="governance-modal commercial-modal" role="dialog" aria-modal="true" aria-labelledby="lead-dialog-title"><header><div><span>{t("leadDialog.eyebrow")}</span><h2 id="lead-dialog-title">{t(preset?.source === "map" ? "leadDialog.mapTitle" : "leadDialog.title")}</h2><p>{t("leadDialog.description")}</p></div><button className="icon-button" onClick={onClose} aria-label={t("common.cancel")}><X size={19} /></button></header><form onSubmit={submit}><div className="dialog-grid"><label>{t("leads.company")}<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} autoFocus /></label><label>{t("leadDialog.location")}<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><label>{t("leads.owner")}<select value={ownerName} onChange={(event) => setOwnerName(event.target.value)}><option>Dante Frota</option><option>Leonardo Agiani</option><option>Luciano Souza</option></select></label><label>{t("leads.priority")}<select value={priority} onChange={(event) => setPriority(event.target.value as Lead["priority"])}><option value="high">{t("priority.high")}</option><option value="medium">{t("priority.medium")}</option><option value="low">{t("priority.low")}</option></select></label><label className="span-two">{t("leads.nextAction")}<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder={t("leadDialog.nextActionPlaceholder")} /></label><label className="span-two">{t("leadDialog.dueAt")}<input type="datetime-local" value={nextActionAt} onChange={(event) => setNextActionAt(event.target.value)} /></label></div>{errorKey && <div className="governance-feedback error" role="alert">{t(errorKey)}</div>}<footer><button type="button" className="action-button secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="action-button"><UserPlus size={16} />{t("leadDialog.create")}</button></footer></form></section></div>;
}

export function ActivityDialog({ onClose, preset }: { onClose: () => void; preset?: { companyName?: string; ownerName?: string } }) {
  const { t } = useI18n();
  const workspace = useCrmWorkspace();
  const [kind, setKind] = useState<ActivityKind>("call");
  const [subject, setSubject] = useState("");
  const [companyName, setCompanyName] = useState(preset?.companyName ?? workspace.leads[0]?.companyName ?? "");
  const [ownerName, setOwnerName] = useState(preset?.ownerName ?? "Dante Frota");
  const [dueAt, setDueAt] = useState(localDateTime(4));
  const [error, setError] = useState(false);
  const activityKeys: Record<ActivityKind, TranslationKey> = { call: "activity.call", email: "activity.email", meeting: "activity.meeting", visit: "activity.visit", note: "activity.note" };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (![subject, companyName, ownerName, dueAt].every((value) => value.trim())) { setError(true); return; }
    if (!workspace.addActivity({ kind, subject: subject.trim(), companyName, ownerName, dueAt: new Date(dueAt).toISOString() })) return;
    onClose();
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section className="governance-modal commercial-modal" role="dialog" aria-modal="true" aria-labelledby="activity-dialog-title"><header><div><span>{t("activityDialog.eyebrow")}</span><h2 id="activity-dialog-title">{t("activityDialog.title")}</h2><p>{t("activityDialog.description")}</p></div><button className="icon-button" onClick={onClose} aria-label={t("common.cancel")}><X size={19} /></button></header><form onSubmit={submit}><div className="dialog-grid"><label>{t("activityDialog.type")}<select value={kind} onChange={(event) => setKind(event.target.value as ActivityKind)}>{Object.entries(activityKeys).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select></label><label>{t("leads.owner")}<select value={ownerName} onChange={(event) => setOwnerName(event.target.value)}><option>Dante Frota</option><option>Leonardo Agiani</option><option>Luciano Souza</option></select></label><label className="span-two">{t("activityDialog.subject")}<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={t("activityDialog.subjectPlaceholder")} autoFocus /></label><label>{t("leads.company")}<select value={companyName} onChange={(event) => setCompanyName(event.target.value)}>{workspace.leads.map((lead) => <option key={lead.id}>{lead.companyName}</option>)}</select></label><label>{t("leadDialog.dueAt")}<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label></div>{error && <div className="governance-feedback error" role="alert">{t("leadDialog.required")}</div>}<footer><button type="button" className="action-button secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="action-button"><CalendarPlus size={16} />{t("activityDialog.create")}</button></footer></form></section></div>;
}

export function OpportunityDialog({ onClose, preset }: { onClose: () => void; preset?: { companyName?: string; ownerName?: string } }) {
  const { t } = useI18n();
  const workspace = useCrmWorkspace();
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState(preset?.companyName ?? workspace.leads[0]?.companyName ?? "");
  const [ownerName, setOwnerName] = useState(preset?.ownerName ?? "Dante Frota");
  const [amount, setAmount] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [expectedCloseAt, setExpectedCloseAt] = useState(localDateTime(24 * 21).slice(0, 10));
  const [error, setError] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (![title, companyName, ownerName, nextAction, expectedCloseAt].every((value) => value.trim())) { setError(true); return; }
    const dollars = Number(amount.replace(/[^0-9.]/g, ""));
    if (!workspace.addOpportunity({ title: title.trim(), companyName, ownerName, amountCents: Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : null, nextAction: nextAction.trim(), expectedCloseAt })) return;
    onClose();
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section className="governance-modal commercial-modal" role="dialog" aria-modal="true" aria-labelledby="opportunity-dialog-title"><header><div><span>{t("opportunityDialog.eyebrow")}</span><h2 id="opportunity-dialog-title">{t("opportunityDialog.title")}</h2><p>{t("opportunityDialog.description")}</p></div><button className="icon-button" onClick={onClose} aria-label={t("common.cancel")}><X size={19} /></button></header><form onSubmit={submit}><div className="dialog-grid"><label className="span-two">{t("opportunityDialog.name")}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("opportunityDialog.namePlaceholder")} autoFocus /></label><label>{t("leads.company")}<select value={companyName} onChange={(event) => setCompanyName(event.target.value)}>{workspace.leads.map((lead) => <option key={lead.id}>{lead.companyName}</option>)}</select></label><label>{t("leads.owner")}<select value={ownerName} onChange={(event) => setOwnerName(event.target.value)}><option>Dante Frota</option><option>Leonardo Agiani</option><option>Luciano Souza</option></select></label><label>{t("opportunityDialog.amount")}<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25000" /></label><label>{t("opportunityDialog.closeDate")}<input type="date" value={expectedCloseAt} onChange={(event) => setExpectedCloseAt(event.target.value)} /></label><label className="span-two">{t("leads.nextAction")}<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder={t("leadDialog.nextActionPlaceholder")} /></label></div>{error && <div className="governance-feedback error" role="alert">{t("leadDialog.required")}</div>}<footer><button type="button" className="action-button secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="action-button"><CircleDollarSign size={16} />{t("opportunityDialog.create")}</button></footer></form></section></div>;
}
