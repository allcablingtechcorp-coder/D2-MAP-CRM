export const protectedOwnerEmail = "allcablingtechcorp@gmail.com";

export const roles = ["owner", "operations_admin", "sales_manager", "sales_rep", "sdr", "viewer"] as const;
export const statuses = ["invited", "active", "suspended", "revoked"] as const;
export const scopes = ["organization", "assigned_teams", "assigned_records", "custom"] as const;
export const modules = ["dashboard", "leads", "pipeline", "activities", "prospecting", "companies", "reports", "admin"] as const;

export type RoleId = typeof roles[number];
export type MembershipStatus = typeof statuses[number];
export type AccessScope = typeof scopes[number];
export type ModuleId = typeof modules[number];

export interface MembershipDocument {
  email: string;
  displayName: string;
  role: RoleId;
  status: MembershipStatus;
  scope: AccessScope;
  modules: ModuleId[];
  permissionOverrides?: Record<string, boolean>;
  ownerProtected?: boolean;
}

export interface MembershipPatch {
  role: RoleId;
  status: MembershipStatus;
  scope: AccessScope;
  modules: ModuleId[];
}

export interface SaveMembershipInput {
  organizationId: string;
  targetUid: string;
  patch: MembershipPatch;
  reason: string;
}

export class InputValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function requireExactKeys(value: Record<string, unknown>, allowed: readonly string[], context: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new InputValidationError(`${context} contains unsupported fields`);
}

function requiredIdentifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new InputValidationError(`${field} is invalid`);
  }
  return value;
}

export function parseSaveMembershipInput(value: unknown): SaveMembershipInput {
  if (!isRecord(value)) throw new InputValidationError("Request data must be an object");
  requireExactKeys(value, ["organizationId", "targetUid", "patch", "reason"], "Request data");
  if (!isRecord(value.patch)) throw new InputValidationError("patch is invalid");
  requireExactKeys(value.patch, ["role", "status", "scope", "modules"], "patch");

  const role = value.patch.role;
  const status = value.patch.status;
  const scope = value.patch.scope;
  const moduleValues = value.patch.modules;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";

  if (!isOneOf(role, roles)) throw new InputValidationError("patch.role is invalid");
  if (!isOneOf(status, statuses)) throw new InputValidationError("patch.status is invalid");
  if (!isOneOf(scope, scopes)) throw new InputValidationError("patch.scope is invalid");
  if (!Array.isArray(moduleValues) || moduleValues.length === 0 || moduleValues.some((item) => !isOneOf(item, modules))) {
    throw new InputValidationError("patch.modules is invalid");
  }
  if (!reason || reason.length > 500) throw new InputValidationError("reason is required and must contain at most 500 characters");

  return {
    organizationId: requiredIdentifier(value.organizationId, "organizationId"),
    targetUid: requiredIdentifier(value.targetUid, "targetUid"),
    patch: { role, status, scope, modules: [...new Set(moduleValues)] },
    reason,
  };
}

export function parseMembershipDocument(value: unknown): MembershipDocument {
  if (!isRecord(value)) throw new InputValidationError("Membership document is invalid");
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const displayName = typeof value.displayName === "string" ? value.displayName.trim() : "";
  const role = value.role;
  const status = value.status;
  const scope = value.scope;
  const moduleValues = value.modules;

  if (!email || !displayName) throw new InputValidationError("Membership identity is invalid");
  if (!isOneOf(role, roles) || !isOneOf(status, statuses) || !isOneOf(scope, scopes)) {
    throw new InputValidationError("Membership access fields are invalid");
  }
  if (!Array.isArray(moduleValues) || moduleValues.some((item) => !isOneOf(item, modules))) {
    throw new InputValidationError("Membership modules are invalid");
  }
  if (value.ownerProtected !== undefined && typeof value.ownerProtected !== "boolean") {
    throw new InputValidationError("Membership ownerProtected flag is invalid");
  }
  if (value.permissionOverrides !== undefined && (!isRecord(value.permissionOverrides) || Object.values(value.permissionOverrides).some((item) => typeof item !== "boolean"))) {
    throw new InputValidationError("Membership permission overrides are invalid");
  }

  return {
    email,
    displayName,
    role,
    status,
    scope,
    modules: [...new Set(moduleValues)],
    ...(value.permissionOverrides ? { permissionOverrides: value.permissionOverrides as Record<string, boolean> } : {}),
    ...(value.ownerProtected !== undefined ? { ownerProtected: value.ownerProtected } : {}),
  };
}

export function isProtectedOwner(membership: MembershipDocument): boolean {
  return membership.ownerProtected === true || membership.email.trim().toLowerCase() === protectedOwnerEmail;
}

export function canManageMemberships(actor: MembershipDocument): boolean {
  return actor.role === "owner" && actor.status === "active" && actor.modules.includes("admin")
    && actor.permissionOverrides?.["membership.manage"] !== false;
}

export function removesActiveOwner(before: MembershipDocument, patch: MembershipPatch): boolean {
  return before.role === "owner" && before.status === "active" && (patch.role !== "owner" || patch.status !== "active");
}

export function membershipChanges(before: MembershipDocument, patch: MembershipPatch): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of ["role", "status", "scope", "modules"] as const) {
    const from = before[field];
    const to = patch[field];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }
  return changes;
}
