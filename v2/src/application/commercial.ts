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
  saveProspectingVisit(input: ProspectVisitInput): Promise<{ leadId: string; activityId: string | null }>;
  changeRecord(input: RecordChange): Promise<void>;
  assignmentOptions(): Promise<AssignmentOptions>;
  history(collection: RecordCollection, recordId: string): Promise<RecordEvent[]>;
  preferences(locale?: string): Promise<{ locale: string | null }>;
  load(): Promise<CommercialWorkspaceSnapshot>;
  createLead(input: LeadInput): Promise<LeadCreationResult>;
  createActivity(input: Omit<Activity, "id" | "completed">): Promise<Activity>;
  createOpportunity(input: Omit<Opportunity, "id" | "stage" | "currency">): Promise<Opportunity>;
  transitionOpportunity(id: string, stage: OpportunityStage): Promise<Opportunity>;
  completeActivity(id: string): Promise<Activity>;
  createCompany(input: Omit<Company, "id" | "ownerName" | "createdAt">): Promise<Company>;
  createContact(input: Omit<Contact, "id" | "ownerName" | "createdAt" | "companyName">): Promise<Contact>;
}

export interface ProspectVisitInput {
  requestId: string;
  action: "save" | "plan" | "complete";
  placeId: string;
  name: string;
  location: string;
  position: { lat: number; lng: number };
  leadId?: string;
  activityId?: string;
  at?: string;
  note?: string;
  teamId?: string | null;
}

export type RecordCollection = keyof CommercialWorkspaceSnapshot;
export type CommercialRecord = Lead | Company | Contact | Activity | Opportunity;
export interface RecordChange {
  collection: RecordCollection;
  recordId: string;
  revision: string;
  action: "edit" | "archive" | "restore" | "reassign" | "reopen";
  reason: string;
  patch?: Record<string, unknown>;
  ownerUid?: string;
  teamId?: string | null;
}
export interface AssignmentOptions { members: { uid: string; name: string; teamIds: string[] }[]; teams: { id: string; name: string }[]; canAssign: boolean; }
export interface RecordEvent { id: string; action: string; actor: string; reason: string; at: string; }
