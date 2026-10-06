import type { Membership } from "./access";

// UI visibility follows the protected group membership. The backend separately
// validates the signed lease and current permissions on every operation.
export function canUseGroupAdministration(member:Membership,embedded:boolean,reportAll:boolean):boolean {
  return !reportAll && member.status==="active" && member.role==="owner"
    && (!embedded || member.ownerProtected===true);
}
