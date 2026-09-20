import type { Lead } from "../domain/crm";

export function csvCell(value: string): string {
  // Prevent spreadsheet formula execution, including formulas after whitespace.
  const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportLeads(leads: Lead[], headers: string[]) {
  const rows = leads.map((lead) => [lead.companyName, lead.location, lead.ownerName, lead.qualification, lead.source, lead.nextAction, lead.nextActionAt]);
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `D2_CRM_Leads_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
