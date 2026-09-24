import { requireCommercialNamespace, requireGroupAccess } from "./companyWorkspaces.js";
import { createHash } from "node:crypto";
import { getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { crmCallableOptions, consumeRequestBudget, assertPortalLease } from "./requestProtection.js";
import { object, exact, id } from "./lifecyclePolicy.js";
import { parseMembershipDocument } from "./membershipPolicy.js";
import { canUseCommercialPermission, canAccessCommercialRecord } from "./commercialPolicy.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0,32);
const normalize = (value: string) => value.trim().toLocaleLowerCase("en-US").replace(/\s+/g," ");
function text(value: unknown, max: number, optional = false) {
  if (typeof value !== "string" || value.trim().length > max || (!optional && !value.trim())) throw new HttpsError("invalid-argument", "Invalid text");
  return value.trim();
}

// Save the place, lead and visit together. A request ID makes retry safe.
export const saveProspectingVisit = onCall(crmCallableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  assertPortalLease(request.auth.token, (request.data as { organizationId?: unknown } | null)?.organizationId);
  const uid = request.auth.uid;
  await consumeRequestBudget(uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  const input = object(request.data);
  exact(input,["organizationId","requestId","action","placeId","name","location","position","leadId","activityId","at","note","teamId"]);
  const org = id(input.organizationId), requestId = id(input.requestId);
  const action = text(input.action,12), placeId = text(input.placeId,300), name = text(input.name,200), location = text(input.location,300);
  if (!["save","plan","complete"].includes(action)) throw new HttpsError("invalid-argument","Invalid action");
  const point = object(input.position); exact(point,["lat","lng"]);
  if (typeof point.lat !== "number" || !Number.isFinite(point.lat) || Math.abs(point.lat)>90 || typeof point.lng !== "number" || !Number.isFinite(point.lng) || Math.abs(point.lng)>180) throw new HttpsError("invalid-argument","Invalid coordinates");
  const position = { lat: point.lat, lng: point.lng };
  const note = input.note === undefined ? "" : text(input.note,2000,true);
  const at = input.at === undefined ? Timestamp.now() : Timestamp.fromMillis(Date.parse(text(input.at,64)) || 0);
  if (at.toMillis()<946684800000 || (action === "complete" && at.toMillis()>Date.now()+300000)) throw new HttpsError("invalid-argument","Invalid visit date");
  if (input.activityId !== undefined && action !== "complete") throw new HttpsError("invalid-argument","Activity only applies to completion");
  const db = getFirestore(), root = db.doc(`organizations/${org}`);
  const operation = root.collection("prospectingOperations").doc(hash(uid+":"+requestId));
  const placeRef = root.collection("mapPlaces").doc(hash(placeId));
  return db.runTransaction(async tx => {
    await requireGroupAccess(org,uid,tx);
    const actorSnap = await tx.get(root.collection("memberships").doc(uid));
    if (!actorSnap.exists) throw new HttpsError("permission-denied","Membership required");
    const actor = parseMembershipDocument(actorSnap.data());
    if (!actor.modules.includes("prospecting") || !canUseCommercialPermission(actor,"lead.create") || (action !== "save" && !canUseCommercialPermission(actor,"activity.create"))) throw new HttpsError("permission-denied","Prospecting permission required");
    const access = (data: DocumentData) => {
      if (!canAccessCommercialRecord(actor,uid,{ownerUid:String(data.ownerUid),teamId:typeof data.teamId === "string" ? data.teamId : null})) throw new HttpsError("permission-denied","Record outside scope");
      if (data.archived) throw new HttpsError("failed-precondition","Restore the record first");
    };
    const [placeSnap, prior] = await Promise.all([tx.get(placeRef),tx.get(operation)]);
    const leadId = placeSnap.exists ? id(placeSnap.data()!.leadId) : input.leadId ? id(input.leadId) : hash(normalize(name)+"\n"+normalize(location));
    if (input.leadId && input.leadId !== leadId) throw new HttpsError("failed-precondition","Place already linked");
    const leadRef = root.collection("leads").doc(leadId), leadSnap = await tx.get(leadRef);
    const oldLead = leadSnap.data();
    if (oldLead) { access(oldLead); if(oldLead.placeId && oldLead.placeId!==placeId) throw new HttpsError("failed-precondition","Lead linked to another place"); }
    const companyId = oldLead?.companyId ? id(oldLead.companyId) : leadId;
    const companyRef = root.collection("companies").doc(companyId), companySnap = await tx.get(companyRef);
    if (companySnap.exists) access(companySnap.data()!);
    const selectedTeam = input.teamId === undefined ? actor.scope === "assigned_teams" ? actor.teamIds?.[0] : null : input.teamId === null ? null : id(input.teamId);
    const teamId = oldLead ? oldLead.teamId ?? null : selectedTeam ?? null;
    if (actor.scope === "assigned_teams" && (!teamId || !actor.teamIds?.includes(teamId))) throw new HttpsError("permission-denied","Select an assigned team");
    if (teamId && !(await tx.get(root.collection("teams").doc(teamId))).exists) throw new HttpsError("failed-precondition","Team does not exist");
    if (prior.exists) {
      if (prior.data()!.placeId !== placeId || prior.data()!.action !== action) throw new HttpsError("invalid-argument","Request ID was reused");
      return { leadId, activityId: prior.data()!.activityId ?? null };
    }
    const activityId = action === "save" ? null : input.activityId ? id(input.activityId) : hash(uid+":"+requestId);
    const activityRef = activityId ? root.collection("activities").doc(activityId) : null;
    const oldActivity = activityRef ? (await tx.get(activityRef)).data() : undefined;
    if (input.activityId) {
      if (!oldActivity || oldActivity.kind!=="visit" || oldActivity.companyId!==companyId) throw new HttpsError("failed-precondition","Visit does not match company");
      access(oldActivity);
      if (oldActivity.completed) throw new HttpsError("failed-precondition","Visit already completed");
    } else if (oldActivity) throw new HttpsError("already-exists","Visit already exists");
    const now = Timestamp.now(), audit = root.collection("auditEvents").doc();
    const metadata = { organizationId:org, ownerUid:uid, ownerName:actor.displayName, teamId, createdByUid:uid, createdAt:now, updatedByUid:uid, updatedAt:now };
    if (!companySnap.exists) tx.create(companyRef,{...metadata,name,nameNormalized:normalize(name),location,industry:"",website:"",phone:""});
    if (!oldLead) tx.create(leadRef,{...metadata,companyId,companyName:companySnap.data()?.name ?? name,companyNameNormalized:normalize(name),location,locationNormalized:normalize(location),placeId,position,source:"map",qualification:"new",priority:"medium",nextAction:"",nextActionAt:at,lastActivityAt:now});
    else tx.update(leadRef,{placeId,position,updatedByUid:uid,updatedAt:now,...(action === "complete" ? {lastActivityAt:now} : {})});
    tx.set(placeRef,{leadId,placeId,updatedAt:now});
    if (activityRef) {
      const completion = action === "complete" ? {completed:true,completedAt:at,completedByUid:uid,completedByName:actor.displayName,visitNote:note} : {};
      if (oldActivity) tx.update(activityRef,{...completion,updatedByUid:uid,updatedAt:now});
      // Keep the visit visible in the lead owner's portfolio, even when a manager
      // records it. The actual visitor is stored separately in completion.
      else tx.create(activityRef,{...metadata,...(oldLead?{ownerUid:oldLead.ownerUid,ownerName:oldLead.ownerName}:{}),companyId,companyName:companySnap.data()?.name ?? name,kind:"visit",subject:note || name,dueAt:at,completed:false,visitNote:note,...completion});
    }
    const event = { organizationId:org,actorUid:uid,actorEmail:actor.email,action:`commercial.visit_${action}`,targetType:"lead",targetId:leadId,summary:note || action,reason:note,occurredAt:now,activityId };
    tx.create(audit,event); tx.create(leadRef.collection("history").doc(audit.id),event);
    if (activityRef) tx.create(activityRef.collection("history").doc(audit.id),event);
    tx.create(operation,{leadId,activityId,placeId,action,createdAt:now});
    return {leadId,activityId};
  });
});
