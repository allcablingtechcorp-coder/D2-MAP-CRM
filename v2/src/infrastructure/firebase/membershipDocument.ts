import type { AccessScope, Membership, MembershipStatus, ModuleId, Permission, RoleId } from "../../domain/access";

type MembershipDocument = Omit<Membership, "uid">;

const roles: RoleId[] = ["owner", "operations_admin", "sales_manager", "sales_rep", "sdr", "viewer"];
const statuses: MembershipStatus[] = ["invited", "active", "suspended", "revoked"];
const scopes: AccessScope[] = ["organization", "assigned_teams", "assigned_records", "custom"];
const modules: ModuleId[] = ["dashboard", "leads", "pipeline", "activities", "prospecting", "companies", "reports", "admin"];
const permissions: Permission[] = [
  "lead.read", "lead.create", "lead.update", "lead.assign",
  "opportunity.read", "opportunity.update", "opportunity.close", "opportunity.reopen",
  "activity.read", "activity.create", "prospecting.search", "report.read", "report.export",
  "suppression.request", "suppression.manage", "membership.read", "membership.manage",
  "audit.read", "organization.manage",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function requiredString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid membership field: ${key}`);
  return value.trim();
}

function readPermissionOverrides(value: unknown): Membership["permissionOverrides"] {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("Invalid membership field: permissionOverrides");
  const entries = Object.entries(value);
  if (entries.some(([permission, enabled]) => !isOneOf(permission, permissions) || typeof enabled !== "boolean")) {
    throw new Error("Invalid membership field: permissionOverrides");
  }
  return Object.fromEntries(entries) as Partial<Record<Permission, boolean>>;
}

export function membershipFromDocument(uid: string, value: unknown): Membership {
  if (!isRecord(value)) throw new Error("Invalid membership document");
  const role = value.role;
  const status = value.status;
  const scope = value.scope;
  const moduleValues = value.modules;
  if (!isOneOf(role, roles)) throw new Error("Invalid membership field: role");
  if (!isOneOf(status, statuses)) throw new Error("Invalid membership field: status");
  if (!isOneOf(scope, scopes)) throw new Error("Invalid membership field: scope");
  if (!Array.isArray(moduleValues) || moduleValues.some((module) => !isOneOf(module, modules))) {
    throw new Error("Invalid membership field: modules");
  }
  if (value.ownerProtected !== undefined && typeof value.ownerProtected !== "boolean") {
    throw new Error("Invalid membership field: ownerProtected");
  }
  const permissionOverrides = readPermissionOverrides(value.permissionOverrides);
  if (value.teamIds !== undefined && (!Array.isArray(value.teamIds) || value.teamIds.some((teamId) => typeof teamId !== "string" || !teamId.trim()))) {
    throw new Error("Invalid membership field: teamIds");
  }
  return {
    uid,
    ...(Array.isArray(value.companyIds) ? { companyIds: value.companyIds.filter((id): id is string => id === "d2-smart-home" || id === "d2-hvac-solutions") } : {}),
    email: requiredString(value, "email").toLowerCase(),
    displayName: requiredString(value, "displayName"),
    role,
    status,
    scope,
    modules: [...moduleValues],
    ...(value.teamIds ? { teamIds: [...new Set(value.teamIds as string[])] } : {}),
    ...(permissionOverrides ? { permissionOverrides } : {}),
    ...(value.ownerProtected !== undefined ? { ownerProtected: value.ownerProtected } : {}),
  };
}

export function membershipToDocument(membership: Membership): MembershipDocument {
  const { uid: _uid, ...document } = membership;
  return document;
}
