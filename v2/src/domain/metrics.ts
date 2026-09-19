import type { Activity, Lead, Opportunity } from "./crm";
import { openStages } from "./crm";

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
