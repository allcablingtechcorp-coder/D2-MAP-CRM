import {useCompany} from "../application/CompanyContext";
import {useBusinessText} from "../i18n/businesses";
import {combineCompanyReports,type CompanyReport} from "../domain/companyReports";
import {hasPermission} from "../domain/access";
import type {BusinessId} from "../domain/businesses";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useCrmWorkspace } from "../application/CrmWorkspaceLive";
import { useRuntimeSession } from "../application/SessionRuntime";
import { closedDealWinRate, leadSourceDistribution, openPipelineValue } from "../domain/metrics";
import { openStages } from "../domain/crm";
import { useI18n, type TranslationKey } from "../i18n/i18n";
import { Brand } from "./Brand";
import { MetricCard, PageHeader } from "./AppShell";

export function Reports() {
  const { t, locale, formatMoney, formatDateTime } = useI18n();
  const workspace=useCrmWorkspace(),company=useCompany(),l=useBusinessText();
  const [selectedIds,setSelectedIds]=useState<BusinessId[]>([company.active.id]);
  const [permitted,setPermitted]=useState<BusinessId[]>([company.active.id]);
  const [reportState,setReportState]=useState<{key:string;reports:CompanyReport[];exportAllowed:boolean;error:boolean}>({key:"",reports:[],exportAllowed:false,error:false});
  const [reload,setReload]=useState(0);
  const selectionKey=[...selectedIds].sort().join(",");
  const {leads,opportunities,activities}=useMemo(()=>combineCompanyReports(reportState.reports),[reportState.reports]);
  const loading=reportState.key!==selectionKey;
  const can=(_permission:string)=>reportState.exportAllowed;
  const runtime = useRuntimeSession();
  useEffect(()=>{
    let current=true;
    if(runtime.mode==="demo"){setPermitted(company.available.map(b=>b.id));return;}
    Promise.all(company.available.map(async b=>{const member=await company.repositories!(b.id).memberships.findByUid(runtime.identity.uid);return member?.status==="active"&&member.modules.includes("reports")&&hasPermission(member,"report.read")?b.id:null;})).then(ids=>{if(current)setPermitted(ids.filter((id):id is BusinessId=>!!id));}).catch(()=>{if(current)setPermitted([company.active.id]);});
    return()=>{current=false;};
  },[runtime.mode,company.available.map(b=>b.id).join(","),company.active.id]);
  useEffect(()=>{
    let current=true;setReportState(s=>({...s,key:"",error:false}));
    Promise.all(selectedIds.map(async id=>{
      const business=company.available.find(b=>b.id===id);if(!business)throw Error("No company access");
      if(runtime.mode==="demo")return {report:{business,data:workspace.records},exportAllowed:true};
      const repositories=company.repositories!(id),member=await repositories.memberships.findByUid(runtime.identity.uid);
      if(!member||member.status!=="active"||!member.modules.includes("reports")||!hasPermission(member,"report.read"))throw Error("No report access");
      const data=await repositories.commercial.load();
      return {report:{business,data},exportAllowed:hasPermission(member,"report.export")};
    })).then(rows=>{if(current)setReportState({key:selectionKey,reports:rows.map(r=>r.report),exportAllowed:rows.length>0&&rows.every(r=>r.exportAllowed),error:false});}).catch(()=>{if(current)setReportState({key:selectionKey,reports:[],exportAllowed:false,error:true});});
    return()=>{current=false;};
  },[selectionKey,reload,runtime.mode,JSON.stringify(runtime.membership)]);
  const selection=<fieldset className="report-company-selection"><legend>{l.reports}</legend>{company.available.map(b=><label key={b.id}><input type="checkbox" disabled={!permitted.includes(b.id)} checked={selectedIds.includes(b.id)} onChange={()=>setSelectedIds(ids=>ids.includes(b.id)?ids.filter(id=>id!==b.id):[...ids,b.id])}/><img src={b.logo} alt={b.name}/></label>)}<small>{l.restricted}</small></fieldset>;
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const pipelineTotal = openPipelineValue(opportunities);
  const valued = opportunities.filter((item) => openStages.includes(item.stage) && item.amountCents !== null);
  const winRate = closedDealWinRate(opportunities);
  const distribution = leadSourceDistribution(leads);
  const owners = [...new Set(activities.map((item) => item.ownerName))].map((name) => ({ name, count: activities.filter((item) => item.ownerName === name).length })).sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...owners.map((item) => item.count));
  const exportReport = async () => {
    if (!can("report.export")) return;
    setExporting(true); setMessage("");
    try {
      const reports = runtime.mode === "firebase" ? await Promise.all(reportState.reports.map(async report => {
        const repositories = company.repositories!(report.business.id);
        const member = await repositories.memberships.findByUid(runtime.identity.uid);
        if (!member || member.status !== "active" || !member.modules.includes("reports") || !hasPermission(member,"report.read") || !hasPermission(member,"report.export")) throw Error("Report access changed");
        return {...report,data:await repositories.commercial.load()};
      })) : reportState.reports;
      const fresh = combineCompanyReports(reports);
      const { exportExecutiveReport } = await import("../lib/exportExecutiveReport");
      await exportExecutiveReport({ ...fresh, generatedBy: runtime.identity?.displayName ?? "All Cabling Tech", locale, companies:reports });
      setMessage(t("reports.success"));
    } catch { setMessage(t("reports.failure")); }
    finally { setExporting(false); }
  };
  if(loading||reportState.error||!selectedIds.length)return <><PageHeader title={t("reports.title")} description={t("reports.description")}/>{selection}<p role={reportState.error?"alert":"status"}>{!selectedIds.length?l.select:reportState.error?l.reportFailure:l.loading}</p>{reportState.error&&<button className="action-button" onClick={()=>setReload(r=>r+1)}>{l.reload}</button>}</>;
  return <>
    <PageHeader eyebrow={t("reports.eyebrow")} title={t("reports.title")} description={t("reports.description")} actions={<button className="action-button secondary" onClick={exportReport} disabled={loading || exporting || !can("report.export")}><Download size={17} />{t(exporting ? "reports.exporting" : "reports.exportBranded")}</button>} />
    {selection}
    {message && <div className="export-feedback" role="status">{message}</div>}
    <div className="report-brand-banner"><Brand inverse subtitle={t("reports.brandSubtitle")} /><div><strong>{t("reports.executive")}</strong><span>{reportState.reports.map(r=>r.business.name).join(" + ")}</span></div><span className="report-period">{formatDateTime(new Date().toISOString())}</span></div>
    <div className="metrics-grid">
      <MetricCard label={t("reports.pipelineRevenue")} value={formatMoney(pipelineTotal)} detail={t("audit.openOnly")} />
      <MetricCard label={t("reports.averageTicket")} value={valued.length ? formatMoney(Math.round(pipelineTotal / valued.length)) : "—"} detail={t("reports.valuedDeals")} />
      <MetricCard label={t("audit.winRate")} value={winRate === null ? "—" : `${winRate}%`} detail={t(winRate === null ? "audit.noClosedDeals" : "audit.winRateDefinition")} />
      <MetricCard label={t("activities.completed")} value={String(activities.filter((item) => item.completed).length)} detail={t("audit.allAuthorizedRecords")} />
    </div>
    <section className="panel company-report-breakdown"><header className="panel-header"><h2>{l.companyTotals}</h2></header><div className="company-report-cards">{reportState.reports.map(r=><article key={r.business.id}><img src={r.business.logo} alt={r.business.name}/><dl><div><dt>{l.leads}</dt><dd>{r.data.leads.filter(x=>!x.archived).length}</dd></div><div><dt>{l.pipeline}</dt><dd>{formatMoney(openPipelineValue(r.data.opportunities.filter(x=>!x.archived)))}</dd></div><div><dt>{l.activity}</dt><dd>{r.data.activities.filter(x=>!x.archived&&x.completed&&x.kind==="visit").length}</dd></div></dl></article>)}</div></section>
    <div className="reports-grid">
      <section className="panel"><header className="panel-header"><div><h2>{t("reports.leadSource")}</h2><p>{t("audit.allAuthorizedRecords")}</p></div></header><div className="donut-layout"><div className="donut-chart" style={{ background: distribution.background }}><div><strong>{leads.length}</strong><span>leads</span></div></div><div className="legend">{distribution.sources.map((item) => <span key={item.source}><i style={{ background: item.color }} />{t(`source.${item.source}` as TranslationKey)}<strong>{Math.round(item.percentage)}%</strong></span>)}</div></div></section>
      <section className="panel"><header className="panel-header"><div><h2>{t("reports.activityByOwner")}</h2><p>{t("audit.allAuthorizedRecords")}</p></div></header><div className="bar-chart">{owners.length === 0 ? <p>{t("audit.noData")}</p> : owners.map((item) => <div key={item.name}><span title={item.name}>{item.name}</span><div><i style={{ width: `${item.count / maxCount * 100}%` }} /></div><strong>{item.count}</strong></div>)}</div></section>
      <section className="panel span-two"><header className="panel-header"><div><h2>{t("audit.metricMethod")}</h2><p>{t("audit.metricExplanation")}</p></div></header></section>
    </div>
  </>;
}
