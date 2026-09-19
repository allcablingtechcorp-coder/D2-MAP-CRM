import { useMemo, useState, type ButtonHTMLAttributes } from "react";
import {
  ArrowRight, Building2, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, Clock3,
  Download, Filter, ListFilter, MapPin, MoreHorizontal, Phone, Plus, Route,
  Search, Sparkles, TrendingUp, UserPlus, UsersRound,
} from "lucide-react";
import { AppShell, MetricCard, PageHeader } from "./components/AppShell";
import { Brand } from "./components/Brand";
import type { ModuleId } from "./domain/access";
import { openStages, type ActivityKind, type Lead, type LeadQualification, type OpportunityStage } from "./domain/crm";
import { useI18n, type TranslationKey } from "./i18n/i18n";
import { AdminGovernance } from "./components/AdminGovernance";
import { ActivityDialog, LeadDialog, OpportunityDialog } from "./components/CommercialDialogs";
import { useCrmWorkspace } from "./application/CrmWorkspace";
import { nextOpenStage } from "./domain/workflows";
import { leadActivityCoverage, openPipelineValue, pendingDueToday, pendingNextSevenDays } from "./domain/metrics";
import { CommercialDetails } from "./components/CommercialDetails";
import { activeLeadFilterCount, emptyLeadFilters, filterLeads, type LeadFilters } from "./domain/leadFilters";

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
  const { leads, opportunities, activities } = useCrmWorkspace();
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const pipelineValue = openPipelineValue(opportunities);
  const dueToday = pendingDueToday(activities);
  const chart = openStages.map((stage) => ({
    stage,
    count: opportunities.filter((item) => item.stage === stage).length,
    value: opportunities.filter((item) => item.stage === stage).reduce((sum, item) => sum + (item.amountCents ?? 0), 0),
  }));
  return <>
    <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("dashboard.title")} description={t("dashboard.description")} actions={<ActionButton onClick={() => setLeadDialogOpen(true)}><Plus size={17} /> {t("dashboard.newLead")}</ActionButton>} />
    <div className="metrics-grid">
      <MetricCard label={t("dashboard.openPipeline")} value={formatMoney(pipelineValue)} detail={t("dashboard.activeOpportunities", { count: opportunities.filter((item) => openStages.includes(item.stage)).length })} tone="positive" />
      <MetricCard label={t("dashboard.activeLeads")} value={String(leads.length)} detail={t("dashboard.mapOrigin", { count: leads.filter((lead) => lead.source === "map").length })} />
      <MetricCard label={t("dashboard.pendingActivities")} value={String(activities.filter((item) => !item.completed).length)} detail={t("dashboard.dueToday", { count: dueToday })} tone="warning" />
      <MetricCard label={t("dashboard.estimatedConversion")} value="28%" detail={t("common.demoIndicator")} />
    </div>
    <div className="dashboard-grid">
      <Panel title={t("dashboard.salesPipeline")} description={t("dashboard.valueByStage")} action={<button className="text-button">{t("dashboard.openPipelineAction")} <ChevronRight size={16} /></button>}>
        <div className="pipeline-summary">{chart.map((item, index) => <div className="pipeline-row" key={item.stage}><div className="pipeline-row-label"><span>{t(stageKeys[item.stage])}</span><strong>{formatMoney(item.value)}</strong></div><div className="progress-track"><span style={{ width: `${96 - index * 16}%` }} /></div><small>{item.count} {t(item.count === 1 ? "common.deal" : "common.deals")}</small></div>)}</div>
      </Panel>
      <Panel title={t("dashboard.todayPriorities")} description={t("dashboard.teamNextActions")} action={<button className="icon-button"><MoreHorizontal size={19} /></button>}>
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
  const { leads } = useCrmWorkspace();
  const [filters, setFilters] = useState<LeadFilters>(emptyLeadFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const filtered = filterLeads(leads, filters);
  const activeFilters = activeLeadFilterCount(filters);
  const owners = [...new Set(leads.map((lead) => lead.ownerName))];
  return <>
    <PageHeader eyebrow={t("leads.eyebrow")} title={t("leads.title")} description={t("leads.description")} actions={<ActionButton onClick={() => setDialogOpen(true)}><UserPlus size={17} /> {t("leads.add")}</ActionButton>} />
    <div className="toolbar"><label className="table-search"><Search size={17} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder={t("leads.search")} /></label><ActionButton secondary onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><ListFilter size={16} /> {t("common.filters")}{activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}</ActionButton><ActionButton secondary><Download size={16} /> {t("common.export")}</ActionButton></div>
    {filtersOpen && <section className="lead-filter-panel" aria-label={t("common.filters")}><label>{t("filters.qualification")}<select value={filters.qualification} onChange={(event) => setFilters((current) => ({ ...current, qualification: event.target.value as LeadFilters["qualification"] }))}><option value="all">{t("common.all")}</option>{Object.keys(qualificationKeys).map((value) => <option key={value} value={value}>{t(qualificationKeys[value as LeadQualification])}</option>)}</select></label><label>{t("filters.owner")}<select value={filters.ownerName} onChange={(event) => setFilters((current) => ({ ...current, ownerName: event.target.value }))}><option value="all">{t("common.all")}</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label><label>{t("filters.priority")}<select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as LeadFilters["priority"] }))}><option value="all">{t("common.all")}</option><option value="high">{t("priority.high")}</option><option value="medium">{t("priority.medium")}</option><option value="low">{t("priority.low")}</option></select></label><label>{t("filters.source")}<select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value as LeadFilters["source"] }))}><option value="all">{t("common.all")}</option><option value="map">{t("source.map")}</option><option value="referral">{t("source.referral")}</option><option value="inbound">{t("source.inbound")}</option><option value="manual">{t("source.manual")}</option></select></label><button className="text-button" onClick={() => setFilters({ ...emptyLeadFilters, query: filters.query })}>{t("common.clear")}</button></section>}
    <Panel title={t("leads.workspaceCount", { count: filtered.length })} description={t("leads.demoDescription")}>
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
  const { opportunities, advanceOpportunity } = useCrmWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState<TranslationKey | "">("");
  const columns: OpportunityStage[] = ["discovery", "diagnosis", "proposal", "negotiation"];
  const advance = (id: string, stage: OpportunityStage) => {
    const next = nextOpenStage(stage);
    if (!next) return;
    const result = advanceOpportunity(id, next);
    if (!result || !result.ok) {
      setFeedbackKey(result?.reason === "amount_required" ? "pipeline.amountRequired" : "pipeline.transitionError");
      return;
    }
    setFeedbackKey("pipeline.transitionApplied");
  };
  return <>
    <PageHeader eyebrow={t("pipeline.eyebrow")} title={t("pipeline.title")} description={t("pipeline.description")} actions={<ActionButton onClick={() => setDialogOpen(true)}><Plus size={17} /> {t("pipeline.newOpportunity")}</ActionButton>} />
    {feedbackKey && <div className="workflow-feedback" role="status">{t(feedbackKey)}</div>}
    <div className="pipeline-toolbar"><div><strong>{t("pipeline.main")}</strong><span>{t("pipeline.summary", { count: opportunities.length, value: formatMoney(opportunities.reduce((sum, item) => sum + (item.amountCents ?? 0), 0)) })}</span></div><span className="closed-deals">{t("pipeline.closed", { count: opportunities.filter((item) => item.stage === "won" || item.stage === "lost").length })}</span></div>
    <div className="kanban-board">{columns.map((stage) => { const items = opportunities.filter((item) => item.stage === stage); return <section className="kanban-column" key={stage}>
      <header><div><i className={`stage-dot ${stage}`} /><strong>{t(stageKeys[stage])}</strong><span>{items.length}</span></div><strong>{formatMoney(items.reduce((sum, item) => sum + (item.amountCents ?? 0), 0))}</strong></header>
      <div className="kanban-cards">{items.map((item) => <article className="deal-card" key={item.id}><div className="deal-top"><span>{item.companyName}</span><button className="icon-button"><MoreHorizontal size={17} /></button></div><h3>{item.title}</h3><strong className="deal-value">{formatMoney(item.amountCents)}</strong><div className="deal-next"><Clock3 size={14} /><span>{item.nextAction}</span></div><footer><span className="mini-avatar">{item.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><time>{formatShortDate(`${item.expectedCloseAt}T12:00:00`)}</time></footer><button className="advance-stage" onClick={() => advance(item.id, item.stage)}>{t("pipeline.advance")}<ArrowRight size={14} /></button></article>)}</div>
      <button className="add-card" onClick={() => setDialogOpen(true)}><Plus size={15} /> {t("pipeline.addDeal")}</button></section>; })}</div>
    {dialogOpen && <OpportunityDialog onClose={() => setDialogOpen(false)} />}
  </>;
}

function Activities() {
  const { t, formatDateTime } = useI18n();
  const { activities, completeActivity } = useCrmWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const pending = activities.filter((item) => !item.completed);
  const completed = activities.filter((item) => item.completed);
  const today = pendingDueToday(activities);
  const nextSeven = pendingNextSevenDays(activities);
  return <><PageHeader eyebrow={t("activities.eyebrow")} title={t("activities.title")} description={t("activities.description")} actions={<ActionButton onClick={() => setDialogOpen(true)}><Plus size={17} /> {t("activities.new")}</ActionButton>} />
    <div className="metrics-grid compact"><MetricCard label={t("activities.today")} value={String(today)} detail={t("activities.onTime")} /><MetricCard label={t("activities.nextSeven")} value={String(nextSeven)} detail={t("activities.teamSchedule")} /><MetricCard label={t("activities.completedMonth")} value={String(completed.length)} detail={t("common.demoIndicator")} tone="positive" /></div>
    <Panel title={t("activities.schedule")} description={t("activities.ordered")} action={<ActionButton secondary><Filter size={16} /> {t("common.filter")}</ActionButton>}><div className="agenda-list">{activities.map((activity) => <article key={activity.id} className={activity.completed ? "completed" : ""}><button className="complete-control" onClick={() => completeActivity(activity.id)} disabled={activity.completed} aria-label={t(activity.completed ? "activities.completed" : "activities.markComplete")} aria-pressed={activity.completed}><CheckCircle2 size={20} fill={activity.completed ? "currentColor" : "none"} /></button><div className={`activity-kind ${activity.kind}`}>{t(activityKeys[activity.kind])}</div><div className="agenda-copy"><strong>{activity.subject}</strong><span>{activity.companyName}</span></div><div className="agenda-owner"><span className="mini-avatar">{activity.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{activity.ownerName}</div><time>{formatDateTime(activity.dueAt)}</time><button className="icon-button"><MoreHorizontal size={18} /></button></article>)}</div></Panel>
    {dialogOpen && <ActivityDialog onClose={() => setDialogOpen(false)} />}
  </>;
}

const mapResults = [
  { name: "Boca Office Interiors", categoryKey: "prospecting.categoryDesigner" as TranslationKey, location: "Boca Raton, FL", score: 92, x: 46, y: 35 },
  { name: "Coastal Build Partners", categoryKey: "prospecting.categoryContractor" as TranslationKey, location: "Deerfield Beach, FL", score: 86, x: 57, y: 58 },
  { name: "Palm Workspace Group", categoryKey: "prospecting.categoryArchitect" as TranslationKey, location: "Pompano Beach, FL", score: 78, x: 38, y: 76 },
];
function Prospecting() {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadCreated, setLeadCreated] = useState(false);
  return <><PageHeader eyebrow={t("prospecting.eyebrow")} title={t("prospecting.title")} description={t("prospecting.description")} actions={<ActionButton secondary><Route size={17} /> {t("prospecting.planRoute")}</ActionButton>} />
    {leadCreated && <div className="workflow-feedback" role="status">{t("prospecting.leadCreated")}</div>}
    <div className="prospecting-shell"><aside className="prospecting-panel"><div className="prospecting-search"><label>{t("prospecting.searchLabel")}</label><div><Search size={17} /><input key={`search-${t("prospecting.searchValue")}`} defaultValue={t("prospecting.searchValue")} /></div></div><div className="search-grid"><label>{t("prospecting.location")}<input defaultValue="Boca Raton, FL" /></label><label>{t("prospecting.radius")}<select defaultValue="20"><option value="20">{t("prospecting.miles", { count: 20 })}</option><option value="35">{t("prospecting.miles", { count: 35 })}</option></select></label></div><button className="action-button full"><Sparkles size={17} /> {t("prospecting.searchCompanies")}</button><div className="result-summary"><div><strong>{t("prospecting.qualifiedResults", { count: 3 })}</strong><span>{t("prospecting.sorted")}</span></div><button className="icon-button"><Filter size={17} /></button></div><div className="map-result-list">{mapResults.map((result, index) => <button className={`map-result ${selected === index ? "selected" : ""}`} key={result.name} onClick={() => setSelected(index)}><div className="result-score">{result.score}</div><div><strong>{result.name}</strong><span>{t(result.categoryKey)}</span><small><MapPin size={12} /> {result.location}</small></div><ChevronRight size={17} /></button>)}</div></aside>
      <section className="map-canvas" aria-label={t("prospecting.mapLabel")}><div className="map-grid" /><div className="water-shape" /><span className="map-city city-one">Boca Raton</span><span className="map-city city-two">Deerfield Beach</span><span className="map-city city-three">Pompano Beach</span>{mapResults.map((result, index) => <button key={result.name} className={`map-pin ${selected === index ? "selected" : ""}`} onClick={() => { setSelected(index); setLeadCreated(false); }} style={{ left: `${result.x}%`, top: `${result.y}%` }}><MapPin size={selected === index ? 24 : 19} fill="currentColor" /><span>{index + 1}</span></button>)}<div className="map-detail"><div className="map-detail-heading"><span className="company-mark">{mapResults[selected].name.slice(0, 2).toUpperCase()}</span><div><strong>{mapResults[selected].name}</strong><span>{t(mapResults[selected].categoryKey)} • {mapResults[selected].location}</span></div></div><div className="score-line"><span>{t("prospecting.commercialFit")}</span><strong>{mapResults[selected].score}/100</strong></div><button className="action-button full" onClick={() => setLeadDialogOpen(true)}><Plus size={16} /> {t("prospecting.addAsLead")}</button></div><div className="map-notice">{t("prospecting.mapNotice")}</div></section>
    </div>
    {leadDialogOpen && <LeadDialog preset={{ companyName: mapResults[selected].name, location: mapResults[selected].location, ownerName: "Dante Frota", source: "map", priority: mapResults[selected].score >= 90 ? "high" : "medium", nextAction: t("prospecting.firstContact") }} onClose={() => setLeadDialogOpen(false)} onCreated={() => setLeadCreated(true)} />}
  </>;
}

function Companies() {
  const { t } = useI18n();
  const { leads, opportunities } = useCrmWorkspace();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const companies = leads.map((lead, index) => ({ ...lead, contacts: index + 1, opportunities: opportunities.filter((item) => item.companyName === lead.companyName).length }));
  return <><PageHeader eyebrow={t("companies.eyebrow")} title={t("companies.title")} description={t("companies.description")} actions={<ActionButton onClick={() => setDialogOpen(true)}><Building2 size={17} /> {t("companies.new")}</ActionButton>} /><Panel title={t("companies.count", { count: companies.length })} description={t("companies.demoDescription")}><div className="company-grid">{companies.map((company) => <article className="company-card" key={company.id}><div className="company-card-top"><span className="company-mark">{company.companyName.slice(0, 2).toUpperCase()}</span><button className="icon-button" onClick={() => setSelectedLead(company)} aria-label={t("leads.viewDetails")}><MoreHorizontal size={18} /></button></div><h3>{company.companyName}</h3><span><MapPin size={13} /> {company.location}</span><div className="company-stats"><div><strong>{company.contacts}</strong><span>{t("companies.contacts")}</span></div><div><strong>{company.opportunities}</strong><span>{t("companies.deals")}</span></div></div><button className="company-open" onClick={() => setSelectedLead(company)}><span className="mini-avatar">{company.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{company.ownerName}<ChevronRight size={16} /></button></article>)}</div></Panel>{dialogOpen && <LeadDialog onClose={() => setDialogOpen(false)} />}{selectedLead && <CommercialDetails lead={leads.find((lead) => lead.id === selectedLead.id) ?? selectedLead} onClose={() => setSelectedLead(null)} />}</>;
}

function Reports() {
  const { locale, t, formatMoney } = useI18n();
  const { leads, opportunities, activities } = useCrmWorkspace();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const exportReport = async () => {
    setExporting(true);
    setExportMessage("");
    try {
      const { exportExecutiveReport } = await import("./lib/exportExecutiveReport");
      await exportExecutiveReport({ activities, generatedBy: "All Cabling Tech", leads, opportunities, locale });
      setExportMessage(t("reports.success"));
    } catch {
      setExportMessage(t("reports.failure"));
    } finally {
      setExporting(false);
    }
  };
  const pipelineTotal = openPipelineValue(opportunities);
  const openValued = opportunities.filter((item) => openStages.includes(item.stage) && item.amountCents !== null);
  const coverage = leadActivityCoverage(leads, activities);
  return <><PageHeader eyebrow={t("reports.eyebrow")} title={t("reports.title")} description={t("reports.description")} actions={<button className="action-button secondary" onClick={exportReport} disabled={exporting}><Download size={17} /> {exporting ? t("reports.exporting") : t("reports.exportBranded")}</button>} />{exportMessage && <div className="export-feedback" role="status" aria-live="polite">{exportMessage}</div>}<div className="report-brand-banner"><Brand inverse subtitle={t("reports.brandSubtitle")} /><div><strong>{t("reports.executive")}</strong><span>{t("reports.brandDescription")}</span></div><span className="report-period">{t("reports.period")}</span></div><div className="metrics-grid"><MetricCard label={t("reports.pipelineRevenue")} value={formatMoney(pipelineTotal)} detail={t("common.demoIndicator")} /><MetricCard label={t("reports.averageTicket")} value={formatMoney(openValued.length ? Math.round(pipelineTotal / openValued.length) : 0)} detail={t("reports.valuedDeals")} /><MetricCard label={t("reports.activityCoverage")} value={`${coverage.percentage}%`} detail={t("reports.leadsWithActionDynamic", { covered: coverage.covered, count: leads.length })} tone="positive" /><MetricCard label={t("reports.averageCycle")} value={t("reports.days")} detail={t("common.demoIndicator")} /></div><div className="reports-grid"><Panel title={t("reports.leadSource")} description={t("reports.workspaceDistribution")}><div className="donut-layout"><div className="donut-chart"><div><strong>{leads.length}</strong><span>leads</span></div></div><div className="legend"><span><i className="map-source" />{t("reports.map")} <strong>{leads.length ? Math.round(leads.filter((lead) => lead.source === "map").length / leads.length * 100) : 0}%</strong></span><span><i className="ref-source" />{t("reports.referral")} <strong>{leads.length ? Math.round(leads.filter((lead) => lead.source === "referral").length / leads.length * 100) : 0}%</strong></span><span><i className="inbound-source" />{t("reports.inbound")} <strong>{leads.length ? Math.round(leads.filter((lead) => lead.source === "inbound").length / leads.length * 100) : 0}%</strong></span></div></div></Panel><Panel title={t("reports.activityByOwner")} description={t("reports.lastThirty")}><div className="bar-chart">{["Dante Frota", "Leonardo Agiani", "Luciano Souza"].map((name) => { const count = activities.filter((item) => item.ownerName === name).length; return <div key={name}><span>{name.split(" ")[0]}</span><div><i style={{ width: `${Math.min(100, count * 25)}%` }} /></div><strong>{count}</strong></div>; })}</div></Panel><Panel title={t("reports.nextIndicators")} description={t("reports.planIndicators")} className="span-two"><div className="report-catalog"><span><TrendingUp size={18} />{t("reports.conversionBySource")}</span><span><CircleDollarSign size={18} />{t("reports.revenueForecast")}</span><span><UsersRound size={18} />{t("reports.teamPerformance")}</span><span><Clock3 size={18} />{t("reports.stageDuration")}</span></div></Panel></div></>;
}

const pages: Record<ModuleId, () => React.ReactNode> = { dashboard: Dashboard, leads: Leads, pipeline: Pipeline, activities: Activities, prospecting: Prospecting, companies: Companies, reports: Reports, admin: AdminGovernance };
export function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const Page = useMemo(() => pages[activeModule], [activeModule]);
  return <AppShell activeModule={activeModule} onNavigate={setActiveModule} mobileNavigationOpen={mobileNavigationOpen} onToggleNavigation={() => setMobileNavigationOpen((open) => !open)}><Page /></AppShell>;
}
