import { RecordManagerButton } from "./components/RecordManager";
import { LocaleSync } from "./components/LocaleSync";
import { useMemo, useState, type ButtonHTMLAttributes } from "react";
import {
  ArrowRight, Building2, CalendarDays, CheckCircle2, ChevronRight, Clock3,
  Download, ListFilter, MapPin, MoreHorizontal, Phone, Plus,
  Search, UserPlus,
} from "lucide-react";
import { AppShell, MetricCard, PageHeader } from "./components/AppShell";
import { Reports } from "./components/Reports";
import { exportLeads } from "./lib/exportLeads";
import { canAccessModule, type ModuleId } from "./domain/access";
import { openStages, type ActivityKind, type Lead, type LeadQualification, type OpportunityStage } from "./domain/crm";
import { useI18n, type TranslationKey } from "./i18n/i18n";
import { AdminGovernance } from "./components/AdminGovernance";
import { ActivityDialog, LeadDialog, OpportunityDialog } from "./components/CommercialDialogs";
import { useCrmWorkspace } from "./application/CrmWorkspaceLive";
import { nextOpenStage } from "./domain/workflows";
import { closedDealWinRate, openPipelineValue, pendingDueToday, pendingNextSevenDays } from "./domain/metrics";
import { CommercialDetails } from "./components/CommercialDetails";
import { activeLeadFilterCount, emptyLeadFilters, filterLeads, type LeadFilters } from "./domain/leadFilters";
import { useRuntimeSession } from "./application/SessionRuntime";
import { GoogleProspecting } from "./components/GoogleProspecting";
import { CompanyDialog, ContactDialog } from "./components/CompanyDialogs";

const stageKeys: Record<OpportunityStage, TranslationKey> = { discovery: "stage.discovery", diagnosis: "stage.diagnosis", proposal: "stage.proposal", negotiation: "stage.negotiation", won: "stage.won", lost: "stage.lost" };
const qualificationKeys: Record<LeadQualification, TranslationKey> = { new: "qualification.new", contacting: "qualification.contacting", qualified: "qualification.qualified", nurturing: "qualification.nurturing", disqualified: "qualification.disqualified" };
const activityKeys: Record<ActivityKind, TranslationKey> = { call: "activity.call", email: "activity.email", meeting: "activity.meeting", visit: "activity.visit", note: "activity.note" };

function ActionButton({ children, secondary = false, ...props }: { children: React.ReactNode; secondary?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`action-button ${secondary ? "secondary" : ""}`} {...props}>{children}</button>;
}

function Panel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><header className="panel-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>{children}</section>;
}

function Dashboard() {
  const { t, formatDateTime, formatMoney, formatShortDate } = useI18n();
  const { leads, opportunities, activities, can } = useCrmWorkspace();
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const pipelineValue = openPipelineValue(opportunities);
  const dueToday = pendingDueToday(activities);
  const winRate = closedDealWinRate(opportunities);
  const chart = openStages.map((stage) => ({
    stage,
    count: opportunities.filter((item) => item.stage === stage).length,
    value: opportunities.filter((item) => item.stage === stage).reduce((sum, item) => sum + (item.amountCents ?? 0), 0),
  }));
  return <>
    <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("audit.dashboardTitle")} description={t("dashboard.description")} actions={<ActionButton disabled={!can("lead.create")} onClick={() => setLeadDialogOpen(true)}><Plus size={17} /> {t("dashboard.newLead")}</ActionButton>} />
    <div className="metrics-grid">
      <MetricCard label={t("dashboard.openPipeline")} value={formatMoney(pipelineValue)} detail={t("dashboard.activeOpportunities", { count: opportunities.filter((item) => openStages.includes(item.stage)).length })} tone="positive" />
      <MetricCard label={t("dashboard.activeLeads")} value={String(leads.length)} detail={t("dashboard.mapOrigin", { count: leads.filter((lead) => lead.source === "map").length })} />
      <MetricCard label={t("dashboard.pendingActivities")} value={String(activities.filter((item) => !item.completed).length)} detail={t("dashboard.dueToday", { count: dueToday })} tone="warning" />
      <MetricCard label={t("audit.winRate")} value={winRate === null ? "—" : `${winRate}%`} detail={t(winRate === null ? "audit.noClosedDeals" : "audit.winRateDefinition")} />
    </div>
    <div className="dashboard-grid">
      <Panel title={t("dashboard.salesPipeline")} description={t("dashboard.valueByStage")}>
        <div className="pipeline-summary">{chart.map((item) => <div className="pipeline-row" key={item.stage}><div className="pipeline-row-label"><span>{t(stageKeys[item.stage])}</span><strong>{formatMoney(item.value)}</strong></div><div className="progress-track"><span style={{ width: `${pipelineValue ? item.value / pipelineValue * 100 : 0}%` }} /></div><small>{item.count} {t(item.count === 1 ? "common.deal" : "common.deals")}</small></div>)}</div>
      </Panel>
      <Panel title={t("dashboard.teamNextActions")}>
        <div className="activity-list">{activities.filter((item) => !item.completed).slice(0, 4).map((activity) => <div className="activity-item" key={activity.id}><div className={`activity-icon ${activity.kind}`}>{activity.kind === "call" ? <Phone size={16} /> : activity.kind === "visit" ? <MapPin size={16} /> : <CalendarDays size={16} />}</div><div><strong>{activity.subject}</strong><span>{activity.companyName}</span></div><time>{formatDateTime(activity.dueAt)}</time></div>)}</div>
      </Panel>
      <Panel title={t("dashboard.attentionDeals")} description={t("dashboard.criticalActions")} className="span-two">
        <div className="attention-list">{opportunities.filter((item) => openStages.includes(item.stage)).slice(0, 3).map((opportunity) => <div className="attention-item" key={opportunity.id}><div className="company-mark">{opportunity.companyName.slice(0, 2).toUpperCase()}</div><div><strong>{opportunity.companyName}</strong><span>{opportunity.nextAction}</span></div><span className={`stage-pill ${opportunity.stage}`}>{t(stageKeys[opportunity.stage])}</span><strong>{formatMoney(opportunity.amountCents)}</strong><time>{formatShortDate(`${opportunity.expectedCloseAt}T12:00:00`)}</time></div>)}</div>
      </Panel>
    </div>
    {leadDialogOpen && <LeadDialog onClose={() => setLeadDialogOpen(false)} />}
  </>;
}

function Leads() {
  const { t, formatDateTime } = useI18n();
  const { leads, can } = useCrmWorkspace();
  const [filters, setFilters] = useState<LeadFilters>(emptyLeadFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const filtered = filterLeads(leads, filters);
  const activeFilters = activeLeadFilterCount(filters);
  const owners = [...new Set(leads.map((lead) => lead.ownerName))];
  return <>
    <div className="maintenance-toolbar"><RecordManagerButton collection="leads"/></div><PageHeader eyebrow={t("leads.eyebrow")} title={t("leads.title")} description={t("leads.description")} actions={<ActionButton disabled={!can("lead.create")} onClick={() => setDialogOpen(true)}><UserPlus size={17} /> {t("leads.add")}</ActionButton>} />
    <div className="toolbar"><label className="table-search"><Search size={17} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder={t("leads.search")} /></label><ActionButton secondary onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><ListFilter size={16} /> {t("common.filters")}{activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}</ActionButton><ActionButton secondary disabled={!can("report.export")} onClick={() => exportLeads(filtered, [t("leads.company"), t("leadDialog.location"), t("leads.owner"), t("leads.status"), t("filters.source"), t("leads.nextAction"), t("leadDialog.dueAt")])}><Download size={16} /> {t("common.export")}</ActionButton></div>
    {filtersOpen && <section className="lead-filter-panel" aria-label={t("common.filters")}><label>{t("filters.qualification")}<select value={filters.qualification} onChange={(event) => setFilters((current) => ({ ...current, qualification: event.target.value as LeadFilters["qualification"] }))}><option value="all">{t("common.all")}</option>{Object.keys(qualificationKeys).map((value) => <option key={value} value={value}>{t(qualificationKeys[value as LeadQualification])}</option>)}</select></label><label>{t("filters.owner")}<select value={filters.ownerName} onChange={(event) => setFilters((current) => ({ ...current, ownerName: event.target.value }))}><option value="all">{t("common.all")}</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label><label>{t("filters.priority")}<select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as LeadFilters["priority"] }))}><option value="all">{t("common.all")}</option><option value="high">{t("priority.high")}</option><option value="medium">{t("priority.medium")}</option><option value="low">{t("priority.low")}</option></select></label><label>{t("filters.source")}<select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value as LeadFilters["source"] }))}><option value="all">{t("common.all")}</option><option value="map">{t("source.map")}</option><option value="referral">{t("source.referral")}</option><option value="inbound">{t("source.inbound")}</option><option value="manual">{t("source.manual")}</option></select></label><button className="text-button" onClick={() => setFilters({ ...emptyLeadFilters, query: filters.query })}>{t("common.clear")}</button></section>}
    <Panel title={t("leads.workspaceCount", { count: filtered.length })} description={t("audit.allAuthorizedRecords")}>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>{t("leads.company")}</th><th>{t("leads.status")}</th><th>{t("leads.priority")}</th><th>{t("leads.owner")}</th><th>{t("leads.nextAction")}</th><th>{t("leads.lastActivity")}</th><th /></tr></thead><tbody>{filtered.map((lead) => <tr key={lead.id}>
        <td><button className="table-primary account-link" onClick={() => setSelectedLead(lead)}><span className="company-mark small">{lead.companyName.slice(0, 2).toUpperCase()}</span><span><strong>{lead.companyName}</strong><small><MapPin size={12} /> {lead.location}</small></span></button></td>
        <td><span className={`status-pill ${lead.qualification}`}>{t(qualificationKeys[lead.qualification])}</span></td><td><span className={`priority ${lead.priority}`}><i /> {t(`priority.${lead.priority}` as TranslationKey)}</span></td>
        <td>{lead.ownerName}</td><td><strong className="cell-action">{lead.nextAction}</strong><span>{formatDateTime(lead.nextActionAt)}</span></td><td>{formatDateTime(lead.lastActivityAt)}</td><td><button className="icon-button" onClick={() => setSelectedLead(lead)} aria-label={t("leads.viewDetails")}><MoreHorizontal size={18} /></button></td>
      </tr>)}</tbody></table></div>
    </Panel>
    {dialogOpen && <LeadDialog onClose={() => setDialogOpen(false)} />}
    {selectedLead && <CommercialDetails lead={leads.find((lead) => lead.id === selectedLead.id) ?? selectedLead} onClose={() => setSelectedLead(null)} />}
  </>;
}

function Pipeline() {
  const { t, formatMoney, formatShortDate } = useI18n();
  const { opportunities, advanceOpportunity, can } = useCrmWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState<TranslationKey | "">("");
  const columns: OpportunityStage[] = ["discovery", "diagnosis", "proposal", "negotiation"];
  const advance = async (id: string, stage: OpportunityStage) => {
    const next = nextOpenStage(stage);
    if (!next) return;
    const result = await advanceOpportunity(id, next);
    if (!result || !result.ok) {
      setFeedbackKey(result?.reason === "amount_required" ? "pipeline.amountRequired" : "pipeline.transitionError");
      return;
    }
    setFeedbackKey("pipeline.transitionApplied");
  };
  return <>
    <div className="maintenance-toolbar"><RecordManagerButton collection="opportunities"/></div><PageHeader eyebrow={t("pipeline.eyebrow")} title={t("pipeline.title")} description={t("pipeline.description")} actions={<ActionButton disabled={!can("opportunity.update")} onClick={() => setDialogOpen(true)}><Plus size={17} /> {t("pipeline.newOpportunity")}</ActionButton>} />
    {feedbackKey && <div className="workflow-feedback" role="status">{t(feedbackKey)}</div>}
    <div className="pipeline-toolbar"><div><strong>{t("pipeline.main")}</strong><span>{t("pipeline.summary", { count: opportunities.filter((item) => openStages.includes(item.stage)).length, value: formatMoney(openPipelineValue(opportunities)) })}</span></div><span className="closed-deals">{t("pipeline.closed", { count: opportunities.filter((item) => item.stage === "won" || item.stage === "lost").length })}</span></div>
    <div className="kanban-board">{columns.map((stage) => { const items = opportunities.filter((item) => item.stage === stage); return <section className="kanban-column" key={stage}>
      <header><div><i className={`stage-dot ${stage}`} /><strong>{t(stageKeys[stage])}</strong><span>{items.length}</span></div><strong>{formatMoney(items.reduce((sum, item) => sum + (item.amountCents ?? 0), 0))}</strong></header>
      <div className="kanban-cards">{items.map((item) => <article className="deal-card" key={item.id}><div className="deal-top"><span>{item.companyName}</span></div><h3>{item.title}</h3><strong className="deal-value">{formatMoney(item.amountCents)}</strong><div className="deal-next"><Clock3 size={14} /><span>{item.nextAction}</span></div><footer><span className="mini-avatar">{item.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><time>{formatShortDate(`${item.expectedCloseAt}T12:00:00`)}</time></footer><button className="advance-stage" disabled={!can(nextOpenStage(item.stage) === "won" ? "opportunity.close" : "opportunity.update")} onClick={() => advance(item.id, item.stage)}>{t("pipeline.advance")}<ArrowRight size={14} /></button><button className="text-button lost-action" disabled={!can("opportunity.close")} onClick={async () => { const result = await advanceOpportunity(item.id, "lost"); setFeedbackKey(result?.ok ? "pipeline.transitionApplied" : "pipeline.transitionError"); }}>{t("audit.markLost")}</button></article>)}</div>
      <button className="add-card" disabled={!can("opportunity.update")} onClick={() => setDialogOpen(true)}><Plus size={15} /> {t("pipeline.addDeal")}</button></section>; })}</div>
    {opportunities.some((item) => item.stage === "won" || item.stage === "lost") && <Panel title={t("pipeline.closed", { count: opportunities.filter((item) => item.stage === "won" || item.stage === "lost").length })}><div className="attention-list">{opportunities.filter((item) => item.stage === "won" || item.stage === "lost").map((item) => <div className="attention-item" key={item.id}><strong>{item.companyName}</strong><span>{item.title}</span><span className={`stage-pill ${item.stage}`}>{t(stageKeys[item.stage])}</span><strong>{formatMoney(item.amountCents)}</strong></div>)}</div></Panel>}
    {dialogOpen && <OpportunityDialog onClose={() => setDialogOpen(false)} />}
  </>;
}

function Activities() {
  const { t, formatDateTime } = useI18n();
  const { activities, completeActivity, can } = useCrmWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const pending = activities.filter((item) => !item.completed);
  const completed = activities.filter((item) => item.completed);
  const today = pendingDueToday(activities);
  const nextSeven = pendingNextSevenDays(activities);
  return <><div className="maintenance-toolbar"><RecordManagerButton collection="activities"/></div><PageHeader eyebrow={t("activities.eyebrow")} title={t("activities.title")} description={t("activities.description")} actions={<ActionButton disabled={!can("activity.create")} onClick={() => setDialogOpen(true)}><Plus size={17} /> {t("activities.new")}</ActionButton>} />
    <div className="metrics-grid compact"><MetricCard label={t("activities.today")} value={String(today)} detail={t("activities.onTime")} /><MetricCard label={t("activities.nextSeven")} value={String(nextSeven)} detail={t("activities.teamSchedule")} /><MetricCard label={t("activities.completed")} value={String(completed.length)} detail={t("audit.allAuthorizedRecords")} tone="positive" /></div>
    <Panel title={t("activities.schedule")} description={t("activities.ordered")}><div className="agenda-list">{[...activities].sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((activity) => <article key={activity.id} className={activity.completed ? "completed" : ""}><button className="complete-control" onClick={() => completeActivity(activity.id)} disabled={activity.completed || !can("activity.create")} aria-label={t(activity.completed ? "activities.completed" : "activities.markComplete")} aria-pressed={activity.completed}><CheckCircle2 size={20} fill={activity.completed ? "currentColor" : "none"} /></button><div className={`activity-kind ${activity.kind}`}>{t(activityKeys[activity.kind])}</div><div className="agenda-copy"><strong>{activity.subject}</strong><span>{activity.companyName}</span></div><div className="agenda-owner"><span className="mini-avatar">{activity.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{activity.ownerName}</div><time>{formatDateTime(activity.dueAt)}</time></article>)}</div></Panel>
    {dialogOpen && <ActivityDialog onClose={() => setDialogOpen(false)} />}
  </>;
}

const Prospecting = GoogleProspecting;

function Companies() {
  const { t } = useI18n();
  const { companies, contacts, opportunities, can } = useCrmWorkspace();
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactCompanyId, setContactCompanyId] = useState<string | null>(null);
  return <><div className="maintenance-toolbar"><RecordManagerButton collection="companies"/></div><PageHeader eyebrow={t("companies.eyebrow")} title={t("companies.title")} description={t("companies.description")} actions={<><ActionButton secondary disabled={!can("lead.create") || companies.length === 0} onClick={() => setContactCompanyId(companies[0]?.id ?? null)}><UserPlus size={17} /> {t("companies.newContact")}</ActionButton><ActionButton disabled={!can("lead.create")} onClick={() => setCompanyDialogOpen(true)}><Building2 size={17} /> {t("companies.new")}</ActionButton></>} /><Panel title={t("companies.count", { count: companies.length })} description={t("companies.liveDescription")}><div className="company-grid">{companies.map((company) => { const companyContacts = contacts.filter((contact) => contact.companyId === company.id); const companyDeals = opportunities.filter((item) => item.companyId === company.id); return <article className="company-card" key={company.id}><div className="company-card-top"><span className="company-mark">{company.name.slice(0, 2).toUpperCase()}</span><button className="icon-button" onClick={() => setContactCompanyId(company.id)} aria-label={t("companies.newContact")}><UserPlus size={18} /></button></div><h3>{company.name}</h3>{company.website && <a href={company.website} target="_blank" rel="noreferrer">{company.website}</a>}{company.phone && <a href={`tel:${company.phone}`}>{company.phone}</a>}<span><MapPin size={13} /> {company.location}</span>{company.industry && <small>{company.industry}</small>}<div className="company-stats"><div><strong>{companyContacts.length}</strong><span>{t("companies.contacts")}</span></div><div><strong>{companyDeals.length}</strong><span>{t("companies.deals")}</span></div></div><div className="company-contact-preview">{companyContacts.map((contact) => <div key={contact.id}><strong>{contact.name}</strong>{contact.title && <span>{contact.title}</span>}{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}</div>)}</div><button className="company-open" disabled={!can("lead.create")} onClick={() => setContactCompanyId(company.id)}><span className="mini-avatar">{company.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{company.ownerName}<ChevronRight size={16} /></button></article>; })}</div></Panel>{companyDialogOpen && <CompanyDialog onClose={() => setCompanyDialogOpen(false)} />}{contactCompanyId && <ContactDialog companyId={contactCompanyId} onClose={() => setContactCompanyId(null)} />}</>;
}


const pages: Record<ModuleId, () => React.ReactNode> = { dashboard: Dashboard, leads: Leads, pipeline: Pipeline, activities: Activities, prospecting: Prospecting, companies: Companies, reports: Reports, admin: AdminGovernance };
export function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const runtime = useRuntimeSession();
  const { mode, identity, membership } = runtime;
  const { t } = useI18n();
  const availableModules = membership?.modules.filter((moduleId) => canAccessModule(membership, moduleId));
  const resolvedModule = !availableModules || availableModules.includes(activeModule)
    ? activeModule
    : availableModules[0];
  const Page = useMemo(() => resolvedModule ? pages[resolvedModule] : null, [resolvedModule]);
  return <AppShell
    activeModule={resolvedModule ?? activeModule}
    onNavigate={setActiveModule}
    mobileNavigationOpen={mobileNavigationOpen}
    onToggleNavigation={() => setMobileNavigationOpen((open) => !open)}
    availableModules={availableModules}
    account={mode === "firebase" ? { displayName: identity.displayName, photoUrl: identity.photoUrl, detail: t(`role.${membership.role}` as TranslationKey) } : undefined}
    environmentLabel={mode === "demo" ? t("shell.prototype") : undefined}
    onSignOut={runtime.mode === "firebase" ? runtime.signOut : undefined}
    sessionError={runtime.mode === "firebase" ? runtime.actionError : false}
  ><LocaleSync/>{Page ? <Page key={resolvedModule} /> : <div className="empty-governance"><strong>{t("auth.noModulesTitle")}</strong><span>{t("auth.noModulesDescription")}</span></div>}</AppShell>;
}
