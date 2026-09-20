import type { Activity, Lead, Opportunity, OpportunityStage } from "./crm";

export interface LeadInput {
  companyName: string;
  location: string;
  ownerName: string;
  source: Lead["source"];
  priority: Lead["priority"];
  nextAction: string;
  nextActionAt: string;
}

export type LeadCreationResult =
  | { ok: true; lead: Lead }
  | { ok: false; reason: "required_fields" | "invalid_date" | "duplicate" | "permission_denied" | "server_error"; duplicate?: Lead };

export type OpportunityTransitionResult =
  | { ok: true; opportunity: Opportunity; from: OpportunityStage; to: OpportunityStage }
  | { ok: false; reason: "closed_opportunity" | "invalid_transition" | "amount_required" | "next_action_required" };

const stageSequence: OpportunityStage[] = ["discovery", "diagnosis", "proposal", "negotiation", "won"];

export function normalizeBusinessText(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function findDuplicateLead(leads: Lead[], companyName: string, location: string): Lead | undefined {
  const companyKey = normalizeBusinessText(companyName);
  const locationKey = normalizeBusinessText(location);
  return leads.find((lead) => normalizeBusinessText(lead.companyName) === companyKey && normalizeBusinessText(lead.location) === locationKey);
}

export function createLead(input: LeadInput, leads: Lead[], now: Date, id: string): LeadCreationResult {
  if (![input.companyName, input.location, input.ownerName, input.nextAction, input.nextActionAt].every((value) => value.trim())) {
    return { ok: false, reason: "required_fields" };
  }
  const duplicate = findDuplicateLead(leads, input.companyName, input.location);
  if (duplicate) return { ok: false, reason: "duplicate", duplicate };
  const nextActionAt = new Date(input.nextActionAt);
  if (Number.isNaN(nextActionAt.getTime())) return { ok: false, reason: "invalid_date" };
  return {
    ok: true,
    lead: {
      id,
      companyName: input.companyName.trim(),
      location: input.location.trim(),
      ownerName: input.ownerName.trim(),
      qualification: "new",
      source: input.source,
      priority: input.priority,
      nextAction: input.nextAction.trim(),
      nextActionAt: nextActionAt.toISOString(),
      lastActivityAt: now.toISOString(),
    },
  };
}

export function nextOpenStage(stage: OpportunityStage): OpportunityStage | null {
  if (stage === "lost" || stage === "won") return null;
  return stageSequence[stageSequence.indexOf(stage) + 1] ?? null;
}

export function transitionOpportunity(opportunity: Opportunity, to: OpportunityStage): OpportunityTransitionResult {
  if (opportunity.stage === "won" || opportunity.stage === "lost") return { ok: false, reason: "closed_opportunity" };
  const expected = nextOpenStage(opportunity.stage);
  if (to !== expected && to !== "lost") return { ok: false, reason: "invalid_transition" };
  if ((to === "proposal" || to === "negotiation" || to === "won") && (!opportunity.amountCents || opportunity.amountCents <= 0)) {
    return { ok: false, reason: "amount_required" };
  }
  if (!opportunity.nextAction.trim() && to !== "won" && to !== "lost") return { ok: false, reason: "next_action_required" };
  return { ok: true, opportunity: { ...opportunity, stage: to }, from: opportunity.stage, to };
}

export function completeActivity(activity: Activity): Activity {
  return activity.completed ? activity : { ...activity, completed: true };
}
