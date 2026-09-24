import { getFirestore, FieldValue, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { crmCallableOptions, consumeRequestBudget, assertPortalLease } from "./requestProtection.js";
import { exact, id, object } from "./lifecyclePolicy.js";
import { canManageMemberships, isProtectedOwner, parseMembershipDocument } from "./membershipPolicy.js";

export const GROUP_ID = "d2-group";
export const COMPANY_IDS = ["d2-smart-home", "d2-hvac-solutions"] as const;
export function requireCommercialNamespace(org:string) {
  if(org === GROUP_ID) throw new HttpsError("failed-precondition","Select an operating company");
}
export function companyIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 2 || value.some(v => !COMPANY_IDS.includes(v))) throw new HttpsError("invalid-argument", "Select valid companies");
  return [...new Set(value)];
}
export async function requireGroupAccess(org: string, uid: string, tx?: Transaction) {
  if (!COMPANY_IDS.includes(org as typeof COMPANY_IDS[number])) return;
  const ref = getFirestore().doc(`organizations/${GROUP_ID}/memberships/${uid}`);
  const snap = await (tx ? tx.get(ref) : ref.get());
  const data = snap.data();
  if (!data || data.status !== "active" || !(Array.isArray(data.companyIds) && data.companyIds.includes(org))) throw new HttpsError("permission-denied", "Company access required");
}

// Only the group super admin can grant/revoke company access. Company roles remain independent.
export const companyAccess = onCall(crmCallableOptions, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  assertPortalLease(request.auth.token, (request.data as { organizationId?: unknown } | null)?.organizationId);
  const uid = request.auth.uid; await consumeRequestBudget(uid);
  const input = object(request.data); exact(input,["action","targetUid","companyIds","reason"]);
  const db = getFirestore(), root = db.doc(`organizations/${GROUP_ID}`);
  const actorRef = root.collection("memberships").doc(uid);
  if (input.action === "list") {
    const actor = await actorRef.get();
    if (!actor.exists || !canManageMemberships(parseMembershipDocument(actor.data()))) throw new HttpsError("permission-denied", "Group super admin required");
    const members = await root.collection("memberships").limit(501).get();
    if (members.size > 500) throw new HttpsError("resource-exhausted", "Directory capacity exceeded");
    return {members: members.docs.map(doc => ({uid:doc.id,email:doc.data().email,displayName:doc.data().displayName,status:doc.data().status,protected: isProtectedOwner(parseMembershipDocument(doc.data())),companyIds:doc.data().companyIds ?? []}))};
  }
  if (input.action !== "save") throw new HttpsError("invalid-argument", "Invalid action");
  const targetUid=id(input.targetUid), selected=companyIds(input.companyIds);
  const reason=typeof input.reason === "string" ? input.reason.trim() : "";
  if(reason.length<3||reason.length>500) throw new HttpsError("invalid-argument","Reason required");
  await db.runTransaction(async tx => {
    const targetRef=root.collection("memberships").doc(targetUid);
    const refs=COMPANY_IDS.map(org=>db.doc(`organizations/${org}/memberships/${targetUid}`));
    const [actorSnap,targetSnap,...copies]=await Promise.all([tx.get(actorRef),tx.get(targetRef),...refs.map(ref=>tx.get(ref))]);
    if(!actorSnap.exists||!canManageMemberships(parseMembershipDocument(actorSnap.data()))) throw new HttpsError("permission-denied","Group super admin required");
    if(!targetSnap.exists) throw new HttpsError("not-found","Member not found");
    const target=parseMembershipDocument(targetSnap.data());
    if(isProtectedOwner(target)||target.role==="owner"||targetUid===uid) throw new HttpsError("failed-precondition","Owner access is protected");
    if(target.status!=="active"&&selected.length) throw new HttpsError("failed-precondition","Activate the group membership first");
    const now=FieldValue.serverTimestamp();
    COMPANY_IDS.forEach((org,index)=>{
      if(selected.includes(org)) {
        if(copies[index]!.exists) tx.update(refs[index]!,{status:"active",updatedAt:now,updatedByUid:uid});
        else tx.create(refs[index]!,{...target,teamIds:[],scope:target.scope==="assigned_teams"?"assigned_records":target.scope,status:"active",createdAt:now,updatedAt:now,updatedByUid:uid});
      } else if(copies[index]!.exists) tx.update(refs[index]!,{status:"revoked",updatedAt:now,updatedByUid:uid});
      if(selected.includes(org)||copies[index]!.exists) tx.create(db.collection(`organizations/${org}/auditEvents`).doc(),{organizationId:org,action:"membership.company_access",actorUid:uid,actorEmail:actorSnap.data()!.email,targetType:"membership",targetId:targetUid,reason,occurredAt:now});
    });
    tx.update(targetRef,{companyIds:selected,updatedAt:now,updatedByUid:uid});
    tx.create(root.collection("auditEvents").doc(),{organizationId:GROUP_ID,action:"membership.company_access",actorUid:uid,actorEmail:actorSnap.data()!.email,targetType:"membership",targetId:targetUid,reason,changes:{companyIds:{before:targetSnap.data()!.companyIds??[],after:selected}},occurredAt:now});
  });
  return {saved:true};
});
