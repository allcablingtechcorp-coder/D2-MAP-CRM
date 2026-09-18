import { jsPDF } from "jspdf";
import type { Activity, Lead, Opportunity, OpportunityStage } from "../domain/crm.ts";
import { money, stageLabels } from "../domain/crm.ts";

interface ExecutiveReportInput {
  activities: Activity[];
  generatedBy: string;
  leads: Lead[];
  opportunities: Opportunity[];
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

function addFooter(doc: jsPDF, page: number, pageCount: number) {
  doc.setDrawColor(...line);
  doc.line(14, 282, 196, 282);
  doc.setTextColor(...slate);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("D2 Group CRM • Documento comercial confidencial", 14, 288);
  doc.text(`Página ${page} de ${pageCount}`, 196, 288, { align: "right" });
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

export function createExecutiveReportDocument({ activities, generatedBy, leads, opportunities }: ExecutiveReportInput, logo: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const pipelineValue = opportunities.reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
  const mapLeads = leads.filter((lead) => lead.source === "map").length;

  addHeader(doc, logo, "Relatório executivo comercial", "Pipeline, prospecção e execução da equipe");
  doc.setTextColor(...slate);
  doc.setFontSize(7.5);
  doc.text(`Gerado em ${generatedAt}`, 14, 45);
  doc.text(`Responsável: ${generatedBy}`, 196, 45, { align: "right" });

  metric(doc, 14, 52, 42, "PIPELINE ABERTO", money(pipelineValue), `${opportunities.length} oportunidades`);
  metric(doc, 60, 52, 42, "LEADS ATIVOS", String(leads.length), `${mapLeads} originados pelo mapa`);
  metric(doc, 106, 52, 42, "ATIVIDADES", String(activities.length), "Próximas ações registradas");
  metric(doc, 152, 52, 44, "CONVERSÃO", "28%", "Indicador demonstrativo");

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Distribuição do pipeline", 14, 91);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...slate);
  doc.setFontSize(7);
  doc.text("Valor por etapa comercial", 14, 96);

  const stages: OpportunityStage[] = ["discovery", "diagnosis", "proposal", "negotiation"];
  stages.forEach((stage, index) => {
    const y = 105 + index * 15;
    const value = opportunities.filter((item) => item.stage === stage).reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
    const width = pipelineValue ? Math.max(8, (value / pipelineValue) * 87) : 8;
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(stageLabels[stage], 14, y);
    doc.setTextColor(...slate);
    doc.setFont("helvetica", "normal");
    doc.text(money(value), 62, y, { align: "right" });
    doc.setFillColor(237, 241, 246);
    doc.roundedRect(69, y - 4, 87, 4, 2, 2, "F");
    doc.setFillColor(...blue);
    doc.roundedRect(69, y - 4, width, 4, 2, 2, "F");
    doc.setTextColor(...slate);
    doc.text(`${opportunities.filter((item) => item.stage === stage).length} negócio(s)`, 196, y, { align: "right" });
  });

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Oportunidades prioritárias", 14, 174);
  doc.setFillColor(...navy);
  doc.rect(14, 180, 182, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.text("EMPRESA / OPORTUNIDADE", 18, 186);
  doc.text("ETAPA", 112, 186);
  doc.text("RESPONSÁVEL", 143, 186);
  doc.text("VALOR", 192, 186, { align: "right" });
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
    doc.text(stageLabels[item.stage], 112, y);
    doc.setTextColor(...slate);
    doc.text(item.ownerName, 143, y);
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.text(money(item.amountCents), 192, y, { align: "right" });
  });

  doc.setFillColor(235, 248, 243);
  doc.roundedRect(14, 258, 182, 14, 2, 2, "F");
  doc.setTextColor(...green);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Origem geográfica integrada", 19, 264);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(63, 112, 94);
  doc.setFontSize(6.5);
  doc.text(`${mapLeads} leads desta visão foram identificados por prospecção no mapa.`, 19, 268.5);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    addFooter(doc, page, pageCount);
  }
  doc.setProperties({ title: "D2 Group CRM — Relatório executivo", subject: "Resumo comercial", author: generatedBy, creator: "D2 Group CRM" });
  return doc;
}

export async function exportExecutiveReport(input: ExecutiveReportInput) {
  const logo = await imageAsDataUrl("./logo.png");
  const doc = createExecutiveReportDocument(input, logo);
  doc.save(`D2_CRM_Relatorio_Executivo_${new Date().toISOString().slice(0, 10)}.pdf`);
}
