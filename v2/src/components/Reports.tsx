import { useState } from "react";
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
  const { leads, opportunities, activities, can, loading } = useCrmWorkspace();
  const runtime = useRuntimeSession();
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
      const { exportExecutiveReport } = await import("../lib/exportExecutiveReport");
      await exportExecutiveReport({ activities, generatedBy: runtime.identity?.displayName ?? "All Cabling Tech", leads, opportunities, locale });
      setMessage(t("reports.success"));
    } catch { setMessage(t("reports.failure")); }
    finally { setExporting(false); }
  };
  return <>
    <PageHeader eyebrow={t("reports.eyebrow")} title={t("reports.title")} description={t("reports.description")} actions={<button className="action-button secondary" onClick={exportReport} disabled={loading || exporting || !can("report.export")}><Download size={17} />{t(exporting ? "reports.exporting" : "reports.exportBranded")}</button>} />
    {message && <div className="export-feedback" role="status">{message}</div>}
    <div className="report-brand-banner"><Brand inverse subtitle={t("reports.brandSubtitle")} /><div><strong>{t("reports.executive")}</strong><span>{t("audit.allAuthorizedRecords")}</span></div><span className="report-period">{formatDateTime(new Date().toISOString())}</span></div>
    <div className="metrics-grid">
      <MetricCard label={t("reports.pipelineRevenue")} value={formatMoney(pipelineTotal)} detail={t("audit.openOnly")} />
      <MetricCard label={t("reports.averageTicket")} value={valued.length ? formatMoney(Math.round(pipelineTotal / valued.length)) : "—"} detail={t("reports.valuedDeals")} />
      <MetricCard label={t("audit.winRate")} value={winRate === null ? "—" : `${winRate}%`} detail={t(winRate === null ? "audit.noClosedDeals" : "audit.winRateDefinition")} />
      <MetricCard label={t("activities.completed")} value={String(activities.filter((item) => item.completed).length)} detail={t("audit.allAuthorizedRecords")} />
    </div>
    <div className="reports-grid">
      <section className="panel"><header className="panel-header"><div><h2>{t("reports.leadSource")}</h2><p>{t("audit.allAuthorizedRecords")}</p></div></header><div className="donut-layout"><div className="donut-chart" style={{ background: distribution.background }}><div><strong>{leads.length}</strong><span>leads</span></div></div><div className="legend">{distribution.sources.map((item) => <span key={item.source}><i style={{ background: item.color }} />{t(`source.${item.source}` as TranslationKey)}<strong>{Math.round(item.percentage)}%</strong></span>)}</div></div></section>
      <section className="panel"><header className="panel-header"><div><h2>{t("reports.activityByOwner")}</h2><p>{t("audit.allAuthorizedRecords")}</p></div></header><div className="bar-chart">{owners.length === 0 ? <p>{t("audit.noData")}</p> : owners.map((item) => <div key={item.name}><span title={item.name}>{item.name}</span><div><i style={{ width: `${item.count / maxCount * 100}%` }} /></div><strong>{item.count}</strong></div>)}</div></section>
      <section className="panel span-two"><header className="panel-header"><div><h2>{t("audit.metricMethod")}</h2><p>{t("audit.metricExplanation")}</p></div></header></section>
    </div>
  </>;
}
