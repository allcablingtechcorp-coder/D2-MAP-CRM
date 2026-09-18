import { useMemo, useState } from "react";
import {
  Building2, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, Clock3,
  Download, Filter, ListFilter, MapPin, MoreHorizontal, Phone, Plus, Route,
  Search, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp, UserPlus, UsersRound,
} from "lucide-react";
import { AppShell, MetricCard, PageHeader } from "./components/AppShell";
import { Brand } from "./components/Brand";
import { demoActivities, demoLeads, demoMemberships, demoOpportunities } from "./data/demo";
import type { Membership, ModuleId } from "./domain/access";
import type { RoleId } from "./domain/access";
import { openStages, type ActivityKind, type LeadQualification, type OpportunityStage } from "./domain/crm";
import { useI18n, type TranslationKey } from "./i18n/i18n";

const stageKeys: Record<OpportunityStage, TranslationKey> = { discovery: "stage.discovery", diagnosis: "stage.diagnosis", proposal: "stage.proposal", negotiation: "stage.negotiation", won: "stage.won", lost: "stage.lost" };
const qualificationKeys: Record<LeadQualification, TranslationKey> = { new: "qualification.new", contacting: "qualification.contacting", qualified: "qualification.qualified", nurturing: "qualification.nurturing", disqualified: "qualification.disqualified" };
const roleKeys: Record<RoleId, TranslationKey> = { owner: "role.owner", operations_admin: "role.operations_admin", sales_manager: "role.sales_manager", sales_rep: "role.sales_rep", sdr: "role.sdr", viewer: "role.viewer" };
const activityKeys: Record<ActivityKind, TranslationKey> = { call: "activity.call", email: "activity.email", meeting: "activity.meeting", visit: "activity.visit", note: "activity.note" };

function ActionButton({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  return <button className={`action-button ${secondary ? "secondary" : ""}`}>{children}</button>;
}

function Panel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><header className="panel-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>{children}</section>;
}

function Dashboard() {
  const { t, formatDateTime, formatMoney, formatShortDate } = useI18n();
  const pipelineValue = demoOpportunities.reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
  const chart = openStages.map((stage) => ({
    stage,
    count: demoOpportunities.filter((item) => item.stage === stage).length,
    value: demoOpportunities.filter((item) => item.stage === stage).reduce((sum, item) => sum + (item.amountCents ?? 0), 0),
  }));
  return <>
    <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("dashboard.title")} description={t("dashboard.description")} actions={<ActionButton><Plus size={17} /> {t("dashboard.newLead")}</ActionButton>} />
    <div className="metrics-grid">
      <MetricCard label={t("dashboard.openPipeline")} value={formatMoney(pipelineValue)} detail={t("dashboard.activeOpportunities", { count: demoOpportunities.length })} tone="positive" />
      <MetricCard label={t("dashboard.activeLeads")} value={String(demoLeads.length)} detail={t("dashboard.mapOrigin", { count: 2 })} />
      <MetricCard label={t("dashboard.pendingActivities")} value={String(demoActivities.length)} detail={t("dashboard.dueToday", { count: 1 })} tone="warning" />
      <MetricCard label={t("dashboard.estimatedConversion")} value="28%" detail={t("common.demoIndicator")} />
    </div>
    <div className="dashboard-grid">
      <Panel title={t("dashboard.salesPipeline")} description={t("dashboard.valueByStage")} action={<button className="text-button">{t("dashboard.openPipelineAction")} <ChevronRight size={16} /></button>}>
        <div className="pipeline-summary">{chart.map((item, index) => <div className="pipeline-row" key={item.stage}><div className="pipeline-row-label"><span>{t(stageKeys[item.stage])}</span><strong>{formatMoney(item.value)}</strong></div><div className="progress-track"><span style={{ width: `${96 - index * 16}%` }} /></div><small>{item.count} {t(item.count === 1 ? "common.deal" : "common.deals")}</small></div>)}</div>
      </Panel>
      <Panel title={t("dashboard.todayPriorities")} description={t("dashboard.teamNextActions")} action={<button className="icon-button"><MoreHorizontal size={19} /></button>}>
        <div className="activity-list">{demoActivities.map((activity) => <div className="activity-item" key={activity.id}><div className={`activity-icon ${activity.kind}`}>{activity.kind === "call" ? <Phone size={16} /> : activity.kind === "visit" ? <MapPin size={16} /> : <CalendarDays size={16} />}</div><div><strong>{activity.subject}</strong><span>{activity.companyName}</span></div><time>{formatDateTime(activity.dueAt)}</time></div>)}</div>
      </Panel>
      <Panel title={t("dashboard.attentionDeals")} description={t("dashboard.criticalActions")} className="span-two">
        <div className="attention-list">{demoOpportunities.slice(0, 3).map((opportunity) => <div className="attention-item" key={opportunity.id}><div className="company-mark">{opportunity.companyName.slice(0, 2).toUpperCase()}</div><div><strong>{opportunity.companyName}</strong><span>{opportunity.nextAction}</span></div><span className={`stage-pill ${opportunity.stage}`}>{t(stageKeys[opportunity.stage])}</span><strong>{formatMoney(opportunity.amountCents)}</strong><time>{formatShortDate(`${opportunity.expectedCloseAt}T12:00:00`)}</time></div>)}</div>
      </Panel>
    </div>
  </>;
}

function Leads() {
  const { t, formatDateTime } = useI18n();
  const [query, setQuery] = useState("");
  const filtered = demoLeads.filter((lead) => `${lead.companyName} ${lead.location} ${lead.ownerName}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeader eyebrow={t("leads.eyebrow")} title={t("leads.title")} description={t("leads.description")} actions={<ActionButton><UserPlus size={17} /> {t("leads.add")}</ActionButton>} />
    <div className="toolbar"><label className="table-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("leads.search")} /></label><ActionButton secondary><ListFilter size={16} /> {t("common.filters")}</ActionButton><ActionButton secondary><Download size={16} /> {t("common.export")}</ActionButton></div>
    <Panel title={t("leads.workspaceCount", { count: filtered.length })} description={t("leads.demoDescription")}>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>{t("leads.company")}</th><th>{t("leads.status")}</th><th>{t("leads.priority")}</th><th>{t("leads.owner")}</th><th>{t("leads.nextAction")}</th><th>{t("leads.lastActivity")}</th><th /></tr></thead><tbody>{filtered.map((lead) => <tr key={lead.id}>
        <td><div className="table-primary"><span className="company-mark small">{lead.companyName.slice(0, 2).toUpperCase()}</span><div><strong>{lead.companyName}</strong><span><MapPin size={12} /> {lead.location}</span></div></div></td>
        <td><span className={`status-pill ${lead.qualification}`}>{t(qualificationKeys[lead.qualification])}</span></td><td><span className={`priority ${lead.priority}`}><i /> {t(`priority.${lead.priority}` as TranslationKey)}</span></td>
        <td>{lead.ownerName}</td><td><strong className="cell-action">{lead.nextAction}</strong><span>{formatDateTime(lead.nextActionAt)}</span></td><td>{formatDateTime(lead.lastActivityAt)}</td><td><button className="icon-button"><MoreHorizontal size={18} /></button></td>
      </tr>)}</tbody></table></div>
    </Panel>
  </>;
}

function Pipeline() {
  const { t, formatMoney, formatShortDate } = useI18n();
  const columns: OpportunityStage[] = ["discovery", "diagnosis", "proposal", "negotiation"];
  return <>
    <PageHeader eyebrow={t("pipeline.eyebrow")} title={t("pipeline.title")} description={t("pipeline.description")} actions={<ActionButton><Plus size={17} /> {t("pipeline.newOpportunity")}</ActionButton>} />
    <div className="pipeline-toolbar"><div><strong>{t("pipeline.main")}</strong><span>{t("pipeline.summary", { count: demoOpportunities.length, value: formatMoney(demoOpportunities.reduce((sum, item) => sum + (item.amountCents ?? 0), 0)) })}</span></div><ActionButton secondary><SlidersHorizontal size={16} /> {t("pipeline.customize")}</ActionButton></div>
    <div className="kanban-board">{columns.map((stage) => { const items = demoOpportunities.filter((item) => item.stage === stage); return <section className="kanban-column" key={stage}>
      <header><div><i className={`stage-dot ${stage}`} /><strong>{t(stageKeys[stage])}</strong><span>{items.length}</span></div><strong>{formatMoney(items.reduce((sum, item) => sum + (item.amountCents ?? 0), 0))}</strong></header>
      <div className="kanban-cards">{items.map((item) => <article className="deal-card" key={item.id}><div className="deal-top"><span>{item.companyName}</span><button className="icon-button"><MoreHorizontal size={17} /></button></div><h3>{item.title}</h3><strong className="deal-value">{formatMoney(item.amountCents)}</strong><div className="deal-next"><Clock3 size={14} /><span>{item.nextAction}</span></div><footer><span className="mini-avatar">{item.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><time>{formatShortDate(`${item.expectedCloseAt}T12:00:00`)}</time></footer></article>)}</div>
      <button className="add-card"><Plus size={15} /> {t("pipeline.addDeal")}</button></section>; })}</div>
  </>;
}

function Activities() {
  const { t, formatDateTime } = useI18n();
  return <><PageHeader eyebrow={t("activities.eyebrow")} title={t("activities.title")} description={t("activities.description")} actions={<ActionButton><Plus size={17} /> {t("activities.new")}</ActionButton>} />
    <div className="metrics-grid compact"><MetricCard label={t("activities.today")} value="1" detail={t("activities.onTime")} /><MetricCard label={t("activities.nextSeven")} value="3" detail={t("activities.teamSchedule")} /><MetricCard label={t("activities.completedMonth")} value="18" detail={t("common.demoIndicator")} tone="positive" /></div>
    <Panel title={t("activities.schedule")} description={t("activities.ordered")} action={<ActionButton secondary><Filter size={16} /> {t("common.filter")}</ActionButton>}><div className="agenda-list">{demoActivities.map((activity) => <article key={activity.id}><button className="complete-control" aria-label={t("activities.markComplete")}><CheckCircle2 size={20} /></button><div className={`activity-kind ${activity.kind}`}>{t(activityKeys[activity.kind])}</div><div className="agenda-copy"><strong>{activity.subject}</strong><span>{activity.companyName}</span></div><div className="agenda-owner"><span className="mini-avatar">{activity.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{activity.ownerName}</div><time>{formatDateTime(activity.dueAt)}</time><button className="icon-button"><MoreHorizontal size={18} /></button></article>)}</div></Panel>
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
  return <><PageHeader eyebrow={t("prospecting.eyebrow")} title={t("prospecting.title")} description={t("prospecting.description")} actions={<ActionButton secondary><Route size={17} /> {t("prospecting.planRoute")}</ActionButton>} />
    <div className="prospecting-shell"><aside className="prospecting-panel"><div className="prospecting-search"><label>{t("prospecting.searchLabel")}</label><div><Search size={17} /><input key={`search-${t("prospecting.searchValue")}`} defaultValue={t("prospecting.searchValue")} /></div></div><div className="search-grid"><label>{t("prospecting.location")}<input defaultValue="Boca Raton, FL" /></label><label>{t("prospecting.radius")}<select defaultValue="20"><option value="20">{t("prospecting.miles", { count: 20 })}</option><option value="35">{t("prospecting.miles", { count: 35 })}</option></select></label></div><button className="action-button full"><Sparkles size={17} /> {t("prospecting.searchCompanies")}</button><div className="result-summary"><div><strong>{t("prospecting.qualifiedResults", { count: 3 })}</strong><span>{t("prospecting.sorted")}</span></div><button className="icon-button"><Filter size={17} /></button></div><div className="map-result-list">{mapResults.map((result, index) => <button className={`map-result ${selected === index ? "selected" : ""}`} key={result.name} onClick={() => setSelected(index)}><div className="result-score">{result.score}</div><div><strong>{result.name}</strong><span>{t(result.categoryKey)}</span><small><MapPin size={12} /> {result.location}</small></div><ChevronRight size={17} /></button>)}</div></aside>
      <section className="map-canvas" aria-label={t("prospecting.mapLabel")}><div className="map-grid" /><div className="water-shape" /><span className="map-city city-one">Boca Raton</span><span className="map-city city-two">Deerfield Beach</span><span className="map-city city-three">Pompano Beach</span>{mapResults.map((result, index) => <button key={result.name} className={`map-pin ${selected === index ? "selected" : ""}`} onClick={() => setSelected(index)} style={{ left: `${result.x}%`, top: `${result.y}%` }}><MapPin size={selected === index ? 24 : 19} fill="currentColor" /><span>{index + 1}</span></button>)}<div className="map-detail"><div className="map-detail-heading"><span className="company-mark">{mapResults[selected].name.slice(0, 2).toUpperCase()}</span><div><strong>{mapResults[selected].name}</strong><span>{t(mapResults[selected].categoryKey)} • {mapResults[selected].location}</span></div></div><div className="score-line"><span>{t("prospecting.commercialFit")}</span><strong>{mapResults[selected].score}/100</strong></div><button className="action-button full"><Plus size={16} /> {t("prospecting.addAsLead")}</button></div><div className="map-notice">{t("prospecting.mapNotice")}</div></section>
    </div>
  </>;
}

function Companies() {
  const { t } = useI18n();
  const companies = demoLeads.map((lead, index) => ({ ...lead, contacts: index + 1, opportunities: demoOpportunities.filter((item) => item.companyName === lead.companyName).length }));
  return <><PageHeader eyebrow={t("companies.eyebrow")} title={t("companies.title")} description={t("companies.description")} actions={<ActionButton><Building2 size={17} /> {t("companies.new")}</ActionButton>} /><Panel title={t("companies.count", { count: companies.length })} description={t("companies.demoDescription")}><div className="company-grid">{companies.map((company) => <article className="company-card" key={company.id}><div className="company-card-top"><span className="company-mark">{company.companyName.slice(0, 2).toUpperCase()}</span><button className="icon-button"><MoreHorizontal size={18} /></button></div><h3>{company.companyName}</h3><span><MapPin size={13} /> {company.location}</span><div className="company-stats"><div><strong>{company.contacts}</strong><span>{t("companies.contacts")}</span></div><div><strong>{company.opportunities}</strong><span>{t("companies.deals")}</span></div></div><footer><span className="mini-avatar">{company.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{company.ownerName}<ChevronRight size={16} /></footer></article>)}</div></Panel></>;
}

function Reports() {
  const { locale, t, formatMoney } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const exportReport = async () => {
    setExporting(true);
    setExportMessage("");
    try {
      const { exportExecutiveReport } = await import("./lib/exportExecutiveReport");
      await exportExecutiveReport({ activities: demoActivities, generatedBy: "All Cabling Tech", leads: demoLeads, opportunities: demoOpportunities, locale });
      setExportMessage(t("reports.success"));
    } catch {
      setExportMessage(t("reports.failure"));
    } finally {
      setExporting(false);
    }
  };
  return <><PageHeader eyebrow={t("reports.eyebrow")} title={t("reports.title")} description={t("reports.description")} actions={<button className="action-button secondary" onClick={exportReport} disabled={exporting}><Download size={17} /> {exporting ? t("reports.exporting") : t("reports.exportBranded")}</button>} />{exportMessage && <div className="export-feedback" role="status" aria-live="polite">{exportMessage}</div>}<div className="report-brand-banner"><Brand inverse subtitle={t("reports.brandSubtitle")} /><div><strong>{t("reports.executive")}</strong><span>{t("reports.brandDescription")}</span></div><span className="report-period">{t("reports.period")}</span></div><div className="metrics-grid"><MetricCard label={t("reports.pipelineRevenue")} value={formatMoney(5950000)} detail={t("common.demoIndicator")} /><MetricCard label={t("reports.averageTicket")} value={formatMoney(1983300)} detail={t("reports.valuedDeals")} /><MetricCard label={t("reports.activityCoverage")} value="75%" detail={t("reports.leadsWithAction")} tone="positive" /><MetricCard label={t("reports.averageCycle")} value={t("reports.days")} detail={t("common.demoIndicator")} /></div><div className="reports-grid"><Panel title={t("reports.leadSource")} description={t("reports.workspaceDistribution")}><div className="donut-layout"><div className="donut-chart"><div><strong>4</strong><span>leads</span></div></div><div className="legend"><span><i className="map-source" />{t("reports.map")} <strong>50%</strong></span><span><i className="ref-source" />{t("reports.referral")} <strong>25%</strong></span><span><i className="inbound-source" />{t("reports.inbound")} <strong>25%</strong></span></div></div></Panel><Panel title={t("reports.activityByOwner")} description={t("reports.lastThirty")}><div className="bar-chart">{[{ n: "Dante", v: 92 }, { n: "Leonardo", v: 68 }, { n: "Luciano", v: 54 }].map((item) => <div key={item.n}><span>{item.n}</span><div><i style={{ width: `${item.v}%` }} /></div><strong>{item.v}</strong></div>)}</div></Panel><Panel title={t("reports.nextIndicators")} description={t("reports.planIndicators")} className="span-two"><div className="report-catalog"><span><TrendingUp size={18} />{t("reports.conversionBySource")}</span><span><CircleDollarSign size={18} />{t("reports.revenueForecast")}</span><span><UsersRound size={18} />{t("reports.teamPerformance")}</span><span><Clock3 size={18} />{t("reports.stageDuration")}</span></div></Panel></div></>;
}

function Admin() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Membership>(demoMemberships[0]);
  const scopeLabel = selected.scope === "organization" ? t("admin.allOrganization") : selected.scope === "assigned_teams" ? t("admin.assignedTeams") : t("admin.assignedRecords");
  return <><PageHeader eyebrow={t("admin.eyebrow")} title={t("admin.title")} description={t("admin.description")} actions={<ActionButton><UserPlus size={17} /> {t("admin.invite")}</ActionButton>} /><div className="admin-alert"><ShieldCheck size={21} /><div><strong>{t("admin.protectedOwner")}</strong><span>{t("admin.protectedDescription")}</span></div></div><div className="admin-grid"><Panel title={t("admin.usersAccess")} description={t("admin.demoRecords", { count: demoMemberships.length })}><div className="member-list">{demoMemberships.map((member) => <button key={member.uid} onClick={() => setSelected(member)} className={selected.uid === member.uid ? "selected" : ""}><span className="member-avatar">{member.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{member.displayName}</strong><span>{member.email}</span></div><span className={`member-status ${member.status}`}>{t(member.status === "active" ? "common.active" : "common.invited")}</span><ChevronRight size={16} /></button>)}</div></Panel><Panel title={t("admin.accessSummary")} description={t("admin.preview")}><div className="access-detail"><div className="access-identity"><span className="member-avatar large">{selected.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{selected.displayName}</strong><span>{selected.email}</span></div></div><label>{t("admin.assignedRole")}<div className="readonly-field"><ShieldCheck size={17} /><span>{t(roleKeys[selected.role])}</span><ChevronRight size={16} /></div></label><label>{t("admin.dataScope")}<div className="readonly-field"><UsersRound size={17} /><span>{scopeLabel}</span></div></label><div><span className="field-label">{t("admin.allowedModules")}</span><div className="module-tags">{selected.modules.map((module) => <span key={module}>{t(`nav.${module}` as TranslationKey)}</span>)}</div></div><div className="access-actions"><ActionButton secondary>{t("common.cancel")}</ActionButton><ActionButton><ShieldCheck size={16} /> {t("admin.review")}</ActionButton></div><small className="prototype-copy">{t("admin.prototype")}</small></div></Panel></div></>;
}

const pages: Record<ModuleId, () => React.ReactNode> = { dashboard: Dashboard, leads: Leads, pipeline: Pipeline, activities: Activities, prospecting: Prospecting, companies: Companies, reports: Reports, admin: Admin };
export function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const Page = useMemo(() => pages[activeModule], [activeModule]);
  return <AppShell activeModule={activeModule} onNavigate={setActiveModule} mobileNavigationOpen={mobileNavigationOpen} onToggleNavigation={() => setMobileNavigationOpen((open) => !open)}><Page /></AppShell>;
}
