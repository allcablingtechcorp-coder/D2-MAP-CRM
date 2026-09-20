import type { Activity, Company, Contact, Lead, Opportunity, OpportunityStage } from "../domain/crm";
import type { LeadCreationResult, LeadInput } from "../domain/workflows";

export interface CommercialWorkspaceSnapshot {
  leads: Lead[];
  opportunities: Opportunity[];
  activities: Activity[];
  companies: Company[];
  contacts: Contact[];
}

export interface CommercialRepository {
  load(): Promise<CommercialWorkspaceSnapshot>;
  createLead(input: LeadInput): Promise<LeadCreationResult>;
  createActivity(input: Omit<Activity, "id" | "completed">): Promise<Activity>;
  createOpportunity(input: Omit<Opportunity, "id" | "stage" | "currency">): Promise<Opportunity>;
  transitionOpportunity(id: string, stage: OpportunityStage): Promise<Opportunity>;
  completeActivity(id: string): Promise<Activity>;
  createCompany(input: Omit<Company, "id" | "ownerName" | "createdAt">): Promise<Company>;
  createContact(input: Omit<Contact, "id" | "ownerName" | "createdAt" | "companyName">): Promise<Contact>;
}
