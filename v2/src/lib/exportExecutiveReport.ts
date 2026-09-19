import { jsPDF } from "jspdf";
import type { Activity, Lead, Opportunity, OpportunityStage } from "../domain/crm.ts";
import { localeCode, translate, type Locale, type TranslationKey } from "../i18n/translations.ts";

interface ExecutiveReportInput {
  activities: Activity[];
  generatedBy: string;
  leads: Lead[];
  opportunities: Opportunity[];
  locale?: Locale;
}

const navy: [number, number, number] = [12, 23, 43];
const blue: [number, number, number] = [45, 100, 216];
const slate: [number, number, number] = [104, 117, 138];
const line: [number, number, number] = [226, 232, 240];
const green: [number, number, number] = [14, 159, 110];

async function imageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível carregar o logo institucional.");
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao processar o logo."));
    reader.readAsDataURL(blob);
  });
}

function addHeader(doc: jsPDF, logo: string, title: string, subtitle: string) {
  doc.setFillColor(...navy);
  doc.rect(0, 0, 210, 37, "F");
  doc.addImage(logo, "PNG", 14, 8, 43, 17);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 67, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(190, 202, 221);
  doc.text(subtitle, 67, 24);
}

function addFooter(doc: jsPDF, locale: Locale, page: number, pageCount: number) {
  doc.setDrawColor(...line);
  doc.line(14, 282, 196, 282);
  doc.setTextColor(...slate);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(translate(locale, "report.confidential"), 14, 288);
  doc.text(translate(locale, "report.page", { page, total: pageCount }), 196, 288, { align: "right" });
}

function metric(doc: jsPDF, x: number, y: number, width: number, label: string, value: string, detail: string) {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...line);
  doc.roundedRect(x, y, width, 27, 2, 2, "FD");
  doc.setTextColor(...slate);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(label, x + 5, y + 7);
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(value, x + 5, y + 16);
  doc.setTextColor(...slate);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(detail, x + 5, y + 22);
}

export function createExecutiveReportDocument({ activities, generatedBy, leads, opportunities, locale = "pt" }: ExecutiveReportInput, logo: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const generatedAt = new Intl.DateTimeFormat(localeCode[locale], { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const pipelineValue = opportunities.reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
  const mapLeads = leads.filter((lead) => lead.source === "map").length;
  const formatMoney = (amountCents: number | null) => amountCents === null ? translate(locale, "common.notInformed") : new Intl.NumberFormat(localeCode[locale], { style: "currency", currency: "USD" }).format(amountCents / 100);
  const stageKey = (stage: OpportunityStage) => `stage.${stage}` as TranslationKey;

  addHeader(doc, logo, translate(locale, "report.documentTitle"), translate(locale, "report.documentSubtitle"));
  doc.setTextColor(...slate);
  doc.setFontSize(7.5);
  doc.text(translate(locale, "report.generatedAt", { date: generatedAt }), 14, 45);
  doc.text(translate(locale, "report.responsible", { name: generatedBy }), 196, 45, { align: "right" });

  metric(doc, 14, 52, 42, translate(locale, "dashboard.openPipeline").toUpperCase(), formatMoney(pipelineValue), translate(locale, "dashboard.activeOpportunities", { count: opportunities.length }));
  metric(doc, 60, 52, 42, translate(locale, "dashboard.activeLeads").toUpperCase(), String(leads.length), translate(locale, "dashboard.mapOrigin", { count: mapLeads }));
  metric(doc, 106, 52, 42, translate(locale, "report.activities"), String(activities.length), translate(locale, "report.nextActions"));
  metric(doc, 152, 52, 44, translate(locale, "report.conversion"), "28%", translate(locale, "common.demoIndicator"));

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(translate(locale, "report.pipelineDistribution"), 14, 91);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...slate);
  doc.setFontSize(7);
  doc.text(translate(locale, "report.stageValue"), 14, 96);

  const stages: OpportunityStage[] = ["discovery", "diagnosis", "proposal", "negotiation"];
  stages.forEach((stage, index) => {
    const y = 105 + index * 15;
    const value = opportunities.filter((item) => item.stage === stage).reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
    const width = pipelineValue ? Math.max(8, (value / pipelineValue) * 87) : 8;
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(translate(locale, stageKey(stage)), 14, y);
    doc.setTextColor(...slate);
    doc.setFont("helvetica", "normal");
    doc.text(formatMoney(value), 62, y, { align: "right" });
    doc.setFillColor(237, 241, 246);
    doc.roundedRect(69, y - 4, 87, 4, 2, 2, "F");
    doc.setFillColor(...blue);
    doc.roundedRect(69, y - 4, width, 4, 2, 2, "F");
    doc.setTextColor(...slate);
    const stageCount = opportunities.filter((item) => item.stage === stage).length;
    doc.text(`${stageCount} ${translate(locale, stageCount === 1 ? "common.deal" : "common.deals")}`, 196, y, { align: "right" });
  });

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(translate(locale, "report.priorityOpportunities"), 14, 174);
  doc.setFillColor(...navy);
  doc.rect(14, 180, 182, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.text(translate(locale, "report.companyOpportunity"), 18, 186);
  doc.text(translate(locale, "report.stage"), 112, 186);
  doc.text(translate(locale, "report.owner"), 143, 186);
  doc.text(translate(locale, "report.value"), 192, 186, { align: "right" });
  opportunities.slice(0, 4).forEach((item, index) => {
    const y = 197 + index * 14;
    if (index % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(14, y - 7, 182, 14, "F"); }
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(item.companyName.slice(0, 46), 18, y - 1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slate);
    doc.setFontSize(6.3);
    doc.text(item.title.slice(0, 57), 18, y + 3);
    doc.setTextColor(...blue);
    doc.text(translate(locale, stageKey(item.stage)), 112, y);
    doc.setTextColor(...slate);
    doc.text(item.ownerName, 143, y);
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.text(formatMoney(item.amountCents), 192, y, { align: "right" });
  });

  doc.setFillColor(235, 248, 243);
  doc.roundedRect(14, 258, 182, 14, 2, 2, "F");
  doc.setTextColor(...green);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(translate(locale, "report.geoOrigin"), 19, 264);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(63, 112, 94);
  doc.setFontSize(6.5);
  doc.text(translate(locale, "report.geoDescription", { count: mapLeads }), 19, 268.5);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    addFooter(doc, locale, page, pageCount);
  }
  doc.setProperties({ title: `D2 Group CRM — ${translate(locale, "reports.executive")}`, subject: translate(locale, "report.subject"), author: generatedBy, creator: "D2 Group CRM" });
  return doc;
}

export async function exportExecutiveReport(input: ExecutiveReportInput) {
  const logo = await imageAsDataUrl("./logo.png");
  const doc = createExecutiveReportDocument(input, logo);
  doc.save(`D2_CRM_Relatorio_Executivo_${new Date().toISOString().slice(0, 10)}.pdf`);
}
