import type { Activity, Lead } from "./crm";
export type VisitStatus = "new" | "saved" | "planned" | "visited";
export interface MapProspect { id: string; name: string; location: string; score: number | null; position: {lat:number;lng:number}; }
const normalized = (value: string) => value.trim().toLocaleLowerCase("en-US").replace(/\s+/g," ");
export function prospectLead(prospect: MapProspect, leads: Lead[]) {
  const exact = leads.find(lead=>lead.placeId===prospect.id);
  if (exact) return exact;
  const matches = leads.filter(lead=>!lead.placeId && normalized(lead.companyName)===normalized(prospect.name) && normalized(lead.location)===normalized(prospect.location));
  return matches.length === 1 ? matches[0] : undefined;
}
export function visitsForLead(lead: Lead | undefined, activities: Activity[]) {
  return !lead?.companyId ? [] : activities.filter(a=>!a.archived && a.kind === "visit" && a.companyId===lead.companyId).sort((a,b)=>(b.completedAt || b.dueAt).localeCompare(a.completedAt || a.dueAt));
}
export function prospectStatus(lead: Lead | undefined, visits: Activity[]): VisitStatus {
  if(visits.some(a=>!a.completed)) return "planned";
  if(visits.some(a=>a.completed)) return "visited";
  return lead ? "saved" : "new";
}
export const visitColors: Record<VisitStatus,string> = {new:"#475569",saved:"#2563eb",planned:"#b45309",visited:"#047857"};
