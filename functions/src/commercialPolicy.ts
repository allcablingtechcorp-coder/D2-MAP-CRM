import type { MembershipDocument, RoleId } from "./membershipPolicy.js";
import { InputValidationError } from "./membershipPolicy.js";

export type CommercialPermission =
  | "lead.read" | "lead.create" | "lead.assign"
  | "opportunity.read" | "opportunity.update" | "opportunity.close"
  | "activity.read" | "activity.create";

export interface CommercialRecordAccess {
  ownerUid: string;
  teamId: string | null;
}

export interface CreateLeadInput {
  organizationId: string;
  companyName: string;
  location: string;
  source: "map" | "referral" | "inbound" | "manual";
  priority: "high" | "medium" | "low";
  nextAction: string;
  nextActionAt: string;
}

export interface CreateActivityInput {
  organizationId: string;
  kind: "call" | "email" | "meeting" | "visit" | "note";
  subject: string;
  companyName: string;
  dueAt: string;
}

export interface CreateOpportunityInput {
  organizationId: string;
  title: string;
  companyName: string;
  amountCents: number | null;
  nextAction: string;
  expectedCloseAt: string;
}

export interface RecordCommandInput {
  organizationId: string;
  recordId: string;
}

export interface TransitionOpportunityInput extends RecordCommandInput {
  stage: "discovery" | "diagnosis" | "proposal" | "negotiation" | "won" | "lost";
}

const rolePermissions: Record<RoleId, ReadonlySet<CommercialPermission>> = {
  owner: new Set(["lead.read", "lead.create", "lead.assign", "opportunity.read", "opportunity.update", "opportunity.close", "activity.read", "activity.create"]),
  operations_admin: new Set(["lead.read", "lead.create", "lead.assign", "opportunity.read", "opportunity.update", "opportunity.close", "activity.read", "activity.create"]),
  sales_manager: new Set(["lead.read", "lead.create", "lead.assign", "opportunity.read", "opportunity.update", "opportunity.close", "activity.read", "activity.create"]),
  sales_rep: new Set(["lead.read", "lead.create", "opportunity.read", "opportunity.update", "opportunity.close", "activity.read", "activity.create"]),
  sdr: new Set(["lead.read", "lead.create", "activity.read", "activity.create"]),
  viewer: new Set(["lead.read", "opportunity.read", "activity.read"]),
};

const permissionModules: Record<CommercialPermission, readonly string[]> = {
  "lead.read": ["dashboard", "leads", "companies", "reports"],
  "lead.create": ["leads", "companies", "prospecting"],
  "lead.assign": ["leads", "companies"],
  "opportunity.read": ["dashboard", "pipeline", "companies", "reports"],
  "opportunity.update": ["pipeline", "companies"],
  "opportunity.close": ["pipeline"],
  "activity.read": ["dashboard", "activities", "companies", "reports"],
  "activity.create": ["activities", "companies"],
};

const stages = ["discovery", "diagnosis", "proposal", "negotiation", "won", "lost"] as const;
const sources = ["map", "referral", "inbound", "manual"] as const;
const priorities = ["high", "medium", "low"] as const;
const activityKinds = ["call", "email", "meeting", "visit", "note"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new InputValidationError("Request contains unsupported fields");
}

function identifier(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new InputValidationError(`${name} is invalid`);
  return value;
}

function text(value: unknown, name: string, maxLength: number): string {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > maxLength) throw new InputValidationError(`${name} is invalid`);
  return result;
}

function isoDate(value: unknown, name: string): string {
  const result = text(value, name, 64);
  if (!Number.isFinite(Date.parse(result))) throw new InputValidationError(`${name} is invalid`);
  return new Date(result).toISOString();
}

function dateOnly(value: unknown, name: string): string {
  const result = text(value, name, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T12:00:00Z`))) throw new InputValidationError(`${name} is invalid`);
  return result;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], name: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new InputValidationError(`${name} is invalid`);
  return value as T;
}

function requestObject(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isRecord(value)) throw new InputValidationError("Request data must be an object");
  exactKeys(value, allowed);
  return value;
}

export function hasCommercialPermission(membership: MembershipDocument, permission: CommercialPermission): boolean {
  if (membership.status !== "active") return false;
  const override = membership.permissionOverrides?.[permission];
  if (override !== undefined) return override;
  return rolePermissions[membership.role].has(permission);
}

export function canUseCommercialPermission(membership: MembershipDocument, permission: CommercialPermission): boolean {
  return hasCommercialPermission(membership, permission)
    && permissionModules[permission].some((moduleId) => membership.modules.includes(moduleId as never));
}

export function canAccessCommercialRecord(membership: MembershipDocument, actorUid: string, record: CommercialRecordAccess): boolean {
  if (membership.status !== "active") return false;
  if (membership.scope === "organization") return true;
  if (membership.scope === "assigned_records") return record.ownerUid === actorUid;
  if (membership.scope === "assigned_teams") return record.teamId !== null && (membership.teamIds ?? []).includes(record.teamId);
  return false;
}

export function parseOrganizationInput(value: unknown): { organizationId: string } {
  const input = requestObject(value, ["organizationId"]);
  return { organizationId: identifier(input.organizationId, "organizationId") };
}

export function parseCreateLeadInput(value: unknown): CreateLeadInput {
  const input = requestObject(value, ["organizationId", "companyName", "location", "source", "priority", "nextAction", "nextActionAt"]);
  return {
    organizationId: identifier(input.organizationId, "organizationId"),
    companyName: text(input.companyName, "companyName", 200),
    location: text(input.location, "location", 300),
    source: oneOf(input.source, sources, "source"),
    priority: oneOf(input.priority, priorities, "priority"),
    nextAction: text(input.nextAction, "nextAction", 500),
    nextActionAt: isoDate(input.nextActionAt, "nextActionAt"),
  };
}

export function parseCreateActivityInput(value: unknown): CreateActivityInput {
  const input = requestObject(value, ["organizationId", "kind", "subject", "companyName", "dueAt"]);
  return {
    organizationId: identifier(input.organizationId, "organizationId"),
    kind: oneOf(input.kind, activityKinds, "kind"),
    subject: text(input.subject, "subject", 500),
    companyName: text(input.companyName, "companyName", 200),
    dueAt: isoDate(input.dueAt, "dueAt"),
  };
}

export function parseCreateOpportunityInput(value: unknown): CreateOpportunityInput {
  const input = requestObject(value, ["organizationId", "title", "companyName", "amountCents", "nextAction", "expectedCloseAt"]);
  if (input.amountCents !== null && (!Number.isSafeInteger(input.amountCents) || Number(input.amountCents) <= 0 || Number(input.amountCents) > 999_999_999_999)) {
    throw new InputValidationError("amountCents is invalid");
  }
  return {
    organizationId: identifier(input.organizationId, "organizationId"),
    title: text(input.title, "title", 200),
    companyName: text(input.companyName, "companyName", 200),
    amountCents: input.amountCents === null ? null : Number(input.amountCents),
    nextAction: text(input.nextAction, "nextAction", 500),
    expectedCloseAt: dateOnly(input.expectedCloseAt, "expectedCloseAt"),
  };
}

export function parseRecordCommandInput(value: unknown): RecordCommandInput {
  const input = requestObject(value, ["organizationId", "recordId"]);
  return { organizationId: identifier(input.organizationId, "organizationId"), recordId: identifier(input.recordId, "recordId") };
}

export function parseTransitionOpportunityInput(value: unknown): TransitionOpportunityInput {
  const input = requestObject(value, ["organizationId", "recordId", "stage"]);
  return {
    organizationId: identifier(input.organizationId, "organizationId"),
    recordId: identifier(input.recordId, "recordId"),
    stage: oneOf(input.stage, stages, "stage"),
  };
}

export const opportunityTransitions: Record<TransitionOpportunityInput["stage"], readonly TransitionOpportunityInput["stage"][]> = {
  discovery: ["diagnosis", "lost"], diagnosis: ["proposal", "lost"], proposal: ["negotiation", "lost"],
  negotiation: ["won", "lost"], won: [], lost: ["discovery"],
};
