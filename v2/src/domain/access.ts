export type RoleId =
  | "owner"
  | "operations_admin"
  | "sales_manager"
  | "sales_rep"
  | "sdr"
  | "viewer";

export type ModuleId =
  | "dashboard"
  | "leads"
  | "pipeline"
  | "activities"
  | "prospecting"
  | "companies"
  | "reports"
  | "admin";

export type Permission =
  | "lead.read"
  | "lead.create"
  | "lead.update"
  | "lead.assign"
  | "opportunity.read"
  | "opportunity.update"
  | "opportunity.close"
  | "opportunity.reopen"
  | "activity.read"
  | "activity.create"
  | "prospecting.search"
  | "report.read"
  | "report.export"
  | "suppression.request"
  | "suppression.manage"
  | "membership.read"
  | "membership.manage"
  | "audit.read"
  | "organization.manage";

export type AccessScope = "organization" | "assigned_teams" | "assigned_records" | "custom";

export type MembershipStatus = "invited" | "active" | "suspended" | "revoked";

export interface Membership {
  uid: string;
  email: string;
  displayName: string;
  role: RoleId;
  status: MembershipStatus;
  scope: AccessScope;
  modules: ModuleId[];
  permissionOverrides?: Partial<Record<Permission, boolean>>;
  ownerProtected?: boolean;
}

export const PROTECTED_OWNER_EMAIL = "allcablingtechcorp@gmail.com";

const allPermissions: Permission[] = [
  "lead.read",
  "lead.create",
  "lead.update",
  "lead.assign",
  "opportunity.read",
  "opportunity.update",
  "opportunity.close",
  "opportunity.reopen",
  "activity.read",
  "activity.create",
  "prospecting.search",
  "report.read",
  "report.export",
  "suppression.request",
  "suppression.manage",
  "membership.read",
  "membership.manage",
  "audit.read",
  "organization.manage",
];

export const roleLabels: Record<RoleId, string> = {
  owner: "Super Admin / Proprietário",
  operations_admin: "Administrador operacional",
  sales_manager: "Gestor comercial",
  sales_rep: "Vendedor",
  sdr: "SDR / Prospecção",
  viewer: "Leitura / Analista",
};

export const rolePermissions: Record<RoleId, ReadonlySet<Permission>> = {
  owner: new Set(allPermissions),
  operations_admin: new Set([
    "lead.read",
    "lead.create",
    "lead.update",
    "lead.assign",
    "opportunity.read",
    "opportunity.update",
    "opportunity.close",
    "opportunity.reopen",
    "activity.read",
    "activity.create",
    "prospecting.search",
    "report.read",
    "report.export",
    "suppression.manage",
    "membership.read",
    "audit.read",
  ]),
  sales_manager: new Set([
    "lead.read",
    "lead.create",
    "lead.update",
    "lead.assign",
    "opportunity.read",
    "opportunity.update",
    "opportunity.close",
    "opportunity.reopen",
    "activity.read",
    "activity.create",
    "prospecting.search",
    "report.read",
    "suppression.request",
  ]),
  sales_rep: new Set([
    "lead.read",
    "lead.create",
    "lead.update",
    "opportunity.read",
    "opportunity.update",
    "opportunity.close",
    "activity.read",
    "activity.create",
    "prospecting.search",
    "report.read",
    "suppression.request",
  ]),
  sdr: new Set([
    "lead.read",
    "lead.create",
    "lead.update",
    "activity.read",
    "activity.create",
    "prospecting.search",
    "report.read",
    "suppression.request",
  ]),
  viewer: new Set(["lead.read", "opportunity.read", "activity.read", "report.read"]),
};

export function hasPermission(membership: Membership, permission: Permission): boolean {
  if (membership.status !== "active") return false;

  const override = membership.permissionOverrides?.[permission];
  if (override !== undefined) return override;

  return rolePermissions[membership.role].has(permission);
}

export function canManageMembership(actor: Membership, target: Membership): boolean {
  if (!hasPermission(actor, "membership.manage")) return false;
  if (!actor.modules.includes("admin")) return false;
  if (target.ownerProtected || target.email.trim().toLowerCase() === PROTECTED_OWNER_EMAIL) return false;
  return actor.role === "owner";
}

export function canAccessModule(membership: Membership, moduleId: ModuleId): boolean {
  if (membership.status !== "active" || !membership.modules.includes(moduleId)) return false;
  if (moduleId === "admin") return ["owner", "operations_admin"].includes(membership.role) && hasPermission(membership, "membership.read") && hasPermission(membership, "audit.read");
  const required: Partial<Record<ModuleId, Permission>> = { leads: "lead.read", pipeline: "opportunity.read", activities: "activity.read", prospecting: "prospecting.search", companies: "lead.read", reports: "report.read" };
  return !required[moduleId] || hasPermission(membership, required[moduleId]);
}

export function canPerformCommercialAction(membership: Membership | null, permission: Permission): boolean {
  if (!membership) return true; // Explicit standalone demo mode only.
  const modules: Partial<Record<Permission, ModuleId[]>> = {
    "lead.create": ["leads", "companies", "prospecting"],
    "opportunity.update": ["pipeline"], "opportunity.close": ["pipeline"],
    "activity.create": ["activities"], "report.export": ["reports"],
  };
  return hasPermission(membership, permission) && (modules[permission] ?? []).some((module) => canAccessModule(membership, module));
}
