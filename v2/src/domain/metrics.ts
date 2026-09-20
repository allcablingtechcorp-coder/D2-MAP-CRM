import type { Activity, Lead, Opportunity } from "./crm";
import { openStages } from "./crm.ts";

function localDayBounds(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

export function pendingDueToday(activities: Activity[], now = new Date()): number {
  const { start, end } = localDayBounds(now);
  return activities.filter((activity) => {
    const dueAt = new Date(activity.dueAt).getTime();
    return !activity.completed && Number.isFinite(dueAt) && dueAt >= start && dueAt < end;
  }).length;
}

export function pendingNextSevenDays(activities: Activity[], now = new Date()): number {
  const { start } = localDayBounds(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return activities.filter((activity) => {
    const dueAt = new Date(activity.dueAt).getTime();
    return !activity.completed && Number.isFinite(dueAt) && dueAt >= start && dueAt < end.getTime();
  }).length;
}

export function openPipelineValue(opportunities: Opportunity[]): number {
  return opportunities
    .filter((opportunity) => openStages.includes(opportunity.stage))
    .reduce((sum, opportunity) => sum + (opportunity.amountCents ?? 0), 0);
}

export function leadActivityCoverage(leads: Lead[], activities: Activity[]): { covered: number; percentage: number } {
  const leadCompanies = new Set(leads.map((lead) => lead.companyName));
  const covered = new Set(activities.filter((activity) => leadCompanies.has(activity.companyName)).map((activity) => activity.companyName)).size;
  return { covered, percentage: leads.length ? Math.round((covered / leads.length) * 100) : 0 };
}

/** Closed-deal win rate; no closed deals means no measurement, not zero wins. */
export function closedDealWinRate(opportunities: Opportunity[]): number | null {
  const closed = opportunities.filter((item) => item.stage === "won" || item.stage === "lost");
  return closed.length ? Math.round(closed.filter((item) => item.stage === "won").length / closed.length * 100) : null;
}

export function leadSourceDistribution(leads: Lead[]) {
  const colors = { map: "#3971db", referral: "#16a279", inbound: "#e6a32a", manual: "#8b5cf6" };
  let offset = 0;
  const sources = (["map", "referral", "inbound", "manual"] as const).map((source) => {
    const count = leads.filter((lead) => lead.source === source).length;
    const percentage = leads.length ? count / leads.length * 100 : 0;
    const start = offset;
    offset += percentage;
    return { source, count, percentage, color: colors[source], start, end: offset };
  });
  return { sources, background: leads.length ? `conic-gradient(${sources.map((item) => `${item.color} ${item.start}% ${item.end}%`).join(", ")})` : "#edf1f5" };
}
