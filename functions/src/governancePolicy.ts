import { InputValidationError, modules, roles, scopes, type AccessScope, type ModuleId, type RoleId } from "./membershipPolicy.js";

export interface CreateInvitationCommand {
  organizationId: string;
  email: string;
  role: Exclude<RoleId, "owner">;
  scope: Exclude<AccessScope, "custom">;
  modules: ModuleId[];
  teamIds: string[];
}

function record(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new InputValidationError("Request data must be an object");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !allowed.includes(key))) throw new InputValidationError("Request contains unsupported fields");
  return result;
}

function identifier(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new InputValidationError(`${name} is invalid`);
  return value;
}

function identifiers(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(item))) throw new InputValidationError(`${name} is invalid`);
  return [...new Set(value)];
}

export function parseCreateInvitationCommand(value: unknown): CreateInvitationCommand {
  const input = record(value, ["organizationId", "email", "role", "scope", "modules", "teamIds"]);
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputValidationError("email is invalid");
  if (typeof input.role !== "string" || !roles.includes(input.role as RoleId) || input.role === "owner") throw new InputValidationError("role is invalid");
  if (typeof input.scope !== "string" || !scopes.includes(input.scope as AccessScope) || input.scope === "custom") throw new InputValidationError("scope is invalid");
  if (!Array.isArray(input.modules) || input.modules.length === 0 || input.modules.length > 8 || input.modules.some((item) => typeof item !== "string" || !modules.includes(item as ModuleId))) throw new InputValidationError("modules are invalid");
  const teamIds = identifiers(input.teamIds, "teamIds");
  if (input.scope === "assigned_teams" && teamIds.length === 0) throw new InputValidationError("teamIds requires at least one team for assigned_teams scope");
  return { organizationId: identifier(input.organizationId, "organizationId"), email, role: input.role as Exclude<RoleId, "owner">, scope: input.scope as Exclude<AccessScope, "custom">, modules: [...new Set(input.modules as ModuleId[])], teamIds };
}

export function parseCreateTeamCommand(value: unknown): { organizationId: string; name: string } {
  const input = record(value, ["organizationId", "name"]);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) throw new InputValidationError("name is invalid");
  return { organizationId: identifier(input.organizationId, "organizationId"), name };
}

export function parseOrganizationCommand(value: unknown): { organizationId: string } {
  const input = record(value, ["organizationId"]);
  return { organizationId: identifier(input.organizationId, "organizationId") };
}

export function parseSessionCommand(value: unknown): { organizationId: string; event: "signed_in" | "access_denied" } {
  const input = record(value, ["organizationId", "event"]);
  if (input.event !== "signed_in" && input.event !== "access_denied") throw new InputValidationError("event is invalid");
  return { organizationId: identifier(input.organizationId, "organizationId"), event: input.event };
}
