export interface RecordMetadata { ownerUid?: string; teamId?: string | null; companyId?: string; revision?: string; archived?: boolean; }
export type LeadQualification = "new" | "contacting" | "qualified" | "nurturing" | "disqualified";
export type OpportunityStage = "discovery" | "diagnosis" | "proposal" | "negotiation" | "won" | "lost";
export type ActivityKind = "call" | "email" | "meeting" | "visit" | "note";

export interface Lead extends RecordMetadata {
  id: string;
  companyName: string;
  location: string;
  ownerName: string;
  qualification: LeadQualification;
  source: "map" | "referral" | "inbound" | "manual";
  priority: "high" | "medium" | "low";
  nextAction: string;
  nextActionAt: string;
  lastActivityAt: string;
}

export interface Opportunity extends RecordMetadata {
  id: string;
  title: string;
  companyName: string;
  ownerName: string;
  stage: OpportunityStage;
  amountCents: number | null;
  currency: "USD";
  nextAction: string;
  expectedCloseAt: string;
}

export interface Activity extends RecordMetadata {
  id: string;
  kind: ActivityKind;
  subject: string;
  companyName: string;
  ownerName: string;
  dueAt: string;
  completed: boolean;
  completedAt?: string;
}

export interface Company extends RecordMetadata {
  id: string;
  name: string;
  location: string;
  ownerName: string;
  industry: string;
  website: string;
  phone: string;
  createdAt: string;
}

export interface Contact extends RecordMetadata {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  ownerName: string;
  createdAt: string;
}

export const qualificationLabels: Record<LeadQualification, string> = {
  new: "Novo",
  contacting: "Em contato",
  qualified: "Qualificado",
  nurturing: "Nutrição",
  disqualified: "Desqualificado",
};

export const stageLabels: Record<OpportunityStage, string> = {
  discovery: "Descoberta",
  diagnosis: "Diagnóstico",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

export const openStages: OpportunityStage[] = ["discovery", "diagnosis", "proposal", "negotiation"];

export const money = (amountCents: number | null, currency = "USD") => {
  if (amountCents === null) return "Valor não informado";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
};
