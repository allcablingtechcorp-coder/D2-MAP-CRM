import { useState } from "react";
import { Activity, BriefcaseBusiness, CalendarClock, CircleDollarSign, MapPin, Plus, UserRound, X } from "lucide-react";
import { useCrmWorkspace } from "../application/CrmWorkspaceLive";
import type { Lead } from "../domain/crm";
import { openStages } from "../domain/crm";
import { useI18n, type TranslationKey } from "../i18n/i18n";
import { ActivityDialog, OpportunityDialog } from "./CommercialDialogs";

export function CommercialDetails({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { t, formatDateTime, formatMoney, formatShortDate } = useI18n();
  const { activities, opportunities, can } = useCrmWorkspace();
  const [activityOpen, setActivityOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const relatedActivities = activities.filter((item) => !!lead.companyId && item.companyId === lead.companyId).sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());
  const relatedOpportunities = opportunities.filter((item) => !!lead.companyId && item.companyId === lead.companyId);
  const openOpportunities = relatedOpportunities.filter((item) => openStages.includes(item.stage));
  const openValue = openOpportunities.reduce((sum, item) => sum + (item.amountCents ?? 0), 0);

  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <aside className="commercial-drawer" role="dialog" aria-modal="true" aria-labelledby="commercial-detail-title">
      <header className="drawer-header"><div className="drawer-company-mark">{lead.companyName.slice(0, 2).toUpperCase()}</div><div><span>{t("details.account")}</span><h2 id="commercial-detail-title">{lead.companyName}</h2><p><MapPin size={13} />{lead.location}</p></div><button className="icon-button" onClick={onClose} aria-label={t("details.close")}><X size={19} /></button></header>
      <div className="drawer-body">
        <div className="drawer-status-line"><span className={`status-pill ${lead.qualification}`}>{t(`qualification.${lead.qualification}` as TranslationKey)}</span><span className={`priority ${lead.priority}`}><i />{t(`priority.${lead.priority}` as TranslationKey)}</span></div>
        <div className="drawer-actions"><button className="action-button" disabled={!can("activity.create")} onClick={() => setActivityOpen(true)}><Plus size={15} />{t("details.newActivity")}</button><button className="action-button secondary" disabled={!can("opportunity.update")} onClick={() => setOpportunityOpen(true)}><CircleDollarSign size={15} />{t("details.newOpportunity")}</button></div>
        <section className="detail-metrics"><article><span>{t("details.openPipeline")}</span><strong>{formatMoney(openValue)}</strong></article><article><span>{t("details.openDeals")}</span><strong>{openOpportunities.length}</strong></article><article><span>{t("details.pendingActivities")}</span><strong>{relatedActivities.filter((item) => !item.completed).length}</strong></article></section>
        <section className="drawer-section"><header><div><span>{t("details.relationship")}</span><h3>{t("details.accountData")}</h3></div></header><div className="account-facts"><div><UserRound size={16} /><span>{t("leads.owner")}</span><strong>{lead.ownerName}</strong></div><div><BriefcaseBusiness size={16} /><span>{t("details.source")}</span><strong>{t(`source.${lead.source}` as TranslationKey)}</strong></div><div><CalendarClock size={16} /><span>{t("leads.nextAction")}</span><strong>{lead.nextAction}</strong><small>{formatDateTime(lead.nextActionAt)}</small></div></div></section>
        <section className="drawer-section"><header><div><span>{t("details.commercial")}</span><h3>{t("details.opportunities")}</h3></div><strong>{relatedOpportunities.length}</strong></header>{relatedOpportunities.length ? <div className="detail-deal-list">{relatedOpportunities.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{t(`stage.${item.stage}` as TranslationKey)}</span></div><strong>{formatMoney(item.amountCents)}</strong><small>{formatShortDate(`${item.expectedCloseAt}T12:00:00`)}</small></article>)}</div> : <p className="empty-detail">{t("details.noOpportunities")}</p>}</section>
        <section className="drawer-section"><header><div><span>{t("details.timeline")}</span><h3>{t("details.history")}</h3></div><strong>{relatedActivities.length}</strong></header>{relatedActivities.length ? <div className="timeline-list">{relatedActivities.map((item) => <article key={item.id}><span className={`timeline-icon ${item.kind}`}><Activity size={15} /></span><div><strong>{item.subject}</strong><span>{t(`activity.${item.kind}` as TranslationKey)} • {item.ownerName}</span><small>{formatDateTime(item.dueAt)}</small></div><i className={item.completed ? "complete" : "pending"}>{t(item.completed ? "details.completed" : "details.pending")}</i></article>)}</div> : <p className="empty-detail">{t("details.noActivities")}</p>}</section>
      </div>
    </aside>
    {activityOpen && <ActivityDialog preset={{ companyId: lead.companyId, companyName: lead.companyName, ownerName: lead.ownerName }} onClose={() => setActivityOpen(false)} />}
    {opportunityOpen && <OpportunityDialog preset={{ companyId: lead.companyId, companyName: lead.companyName, ownerName: lead.ownerName }} onClose={() => setOpportunityOpen(false)} />}
  </div>;
}
