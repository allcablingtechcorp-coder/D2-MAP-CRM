import type { Lead, LeadQualification } from "./crm";

export interface LeadFilters {
  query: string;
  qualification: LeadQualification | "all";
  ownerName: string | "all";
  priority: Lead["priority"] | "all";
  source: Lead["source"] | "all";
}

export const emptyLeadFilters: LeadFilters = {
  query: "",
  qualification: "all",
  ownerName: "all",
  priority: "all",
  source: "all",
};

export function filterLeads(leads: Lead[], filters: LeadFilters): Lead[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return leads.filter((lead) => {
    const matchesQuery = !query || `${lead.companyName} ${lead.location} ${lead.ownerName}`.toLocaleLowerCase().includes(query);
    return matchesQuery
      && (filters.qualification === "all" || lead.qualification === filters.qualification)
      && (filters.ownerName === "all" || lead.ownerName === filters.ownerName)
      && (filters.priority === "all" || lead.priority === filters.priority)
      && (filters.source === "all" || lead.source === filters.source);
  });
}

export function activeLeadFilterCount(filters: LeadFilters): number {
  return [filters.qualification, filters.ownerName, filters.priority, filters.source].filter((value) => value !== "all").length;
}
