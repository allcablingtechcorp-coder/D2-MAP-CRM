import { createHash, randomUUID } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { GROUP_ID, companyIds } from "./companyWorkspaces.js";
import { canManageMemberships, parseMembershipDocument } from "./membershipPolicy.js";
import { parseCreateInvitationCommand } from "./governancePolicy.js";
import { exact, id, object } from "./lifecyclePolicy.js";
import { consumeRequestBudget, crmCallableOptions } from "./requestProtection.js";
import { sendAccessEmail } from "./emailDelivery.js";

const root = () => getFirestore().doc(`organizations/${GROUP_ID}`);
const live = (d: FirebaseFirestore.DocumentData) => d.status === "pending" && !d.archivedAt && d.expiresAt instanceof Timestamp && d.expiresAt.toMillis() > Date.now() && Array.isArray(d.companyIds) && d.companyIds.length > 0;
const audit = (uid:string,email:string,action:string,targetId:string) => ({organizationId:GROUP_ID,actorUid:uid,actorEmail:email,action,targetType:"invitation",targetId,occurredAt:Timestamp.now()});

export async function deliverInvitation(invitationId:string, uid:string) {
  const db=getFirestore(), ref=root().collection("invitations").doc(invitationId), attemptId=randomUUID();
  const target=await db.runTransaction(async tx=>{
    const [actor,snap]=await Promise.all([tx.get(root().collection("memberships").doc(uid)),tx.get(ref)]);
    if(!actor.exists || !canManageMemberships(parseMembershipDocument(actor.data()))) throw new HttpsError("permission-denied","Group super admin required");
    const data=snap.data(); if(!data||!live(data))throw new HttpsError("failed-precondition","Active invitation with companies required");
    const now=Timestamp.now(),previous=data.delivery?.attemptedAt;
    if(previous instanceof Timestamp && now.toMillis()-previous.toMillis()<60000)throw new HttpsError("resource-exhausted","Wait one minute before resending");
    const day=new Date().toISOString().slice(0,10), count=data.delivery?.day===day?Number(data.delivery?.count??0):0;
    if(count>=10)throw new HttpsError("resource-exhausted","Daily invitation email limit reached");
    tx.update(ref,{delivery:{status:"sending",attemptId,attemptedAt:now,day,count:count+1}});
    return {email:String(data.email),locale:String(data.locale??"en"),actorEmail:String(actor.data()!.email)};
  });
  let status:"provider_accepted"|"failed"="provider_accepted";
  try {await sendAccessEmail(target.email,target.locale);} catch {status="failed";}
  await db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref);
    if(snapshot.data()?.delivery?.attemptId!==attemptId)return;
    tx.update(ref,{"delivery.status":status,"delivery.updatedAt":Timestamp.now()});
    tx.create(root().collection("auditEvents").doc(),{...audit(uid,target.actorEmail,`invitation.email_${status}`,invitationId),reason:`Invitation for ${target.email}`});
  });
  return {status};
}

export const manageInvitation=onCall(crmCallableOptions,async request=>{
  if(!request.auth)throw new HttpsError("unauthenticated","Sign in required");
  const uid=request.auth.uid;await consumeRequestBudget(uid);
  const input=object(request.data);exact(input,["action","invitationId","patch"]);
  const invitationId=id(input.invitationId), action=input.action;
  if(action==="resend")return {delivery:await deliverInvitation(invitationId,uid)};
  if(action!=="renew"&&action!=="delete")throw new HttpsError("invalid-argument","Invalid action");
  const ref=root().collection("invitations").doc(invitationId);
  await getFirestore().runTransaction(async tx=>{
    const [actor,snap]=await Promise.all([tx.get(root().collection("memberships").doc(uid)),tx.get(ref)]);
    if(!actor.exists||!canManageMemberships(parseMembershipDocument(actor.data())))throw new HttpsError("permission-denied","Group super admin required");
    const data=snap.data();if(!data)throw new HttpsError("not-found","Invitation not found");
    if(data.archivedAt){if(action==="delete")return;throw new HttpsError("failed-precondition","Invitation removed");}
    const now=Timestamp.now();
    if(action==="delete"){
      tx.update(ref,{archivedAt:now,archivedByUid:uid,status:data.status==="accepted"?"accepted":"revoked"});
    }else{
      if(data.status==="accepted")throw new HttpsError("failed-precondition","User already accepted");
      const patch=object(input.patch);exact(patch,["role","scope","modules","companyIds"]);
      const command=parseCreateInvitationCommand({organizationId:GROUP_ID,email:data.email,teamIds:[],...patch});
      const selected=companyIds(command.companyIds);
      if(!selected.length||command.scope==="assigned_teams")throw new HttpsError("invalid-argument","Select companies and configure teams after acceptance");
      const lock=root().collection("invitationLocks").doc(createHash("sha256").update(command.email).digest("hex"));
      await tx.get(lock);
      const [members,others]=await Promise.all([tx.get(root().collection("memberships").where("email","==",command.email).limit(1)),tx.get(root().collection("invitations").where("email","==",command.email))]);
      if(!members.empty||others.docs.some(d=>d.id!==invitationId&&live(d.data())))throw new HttpsError("already-exists","Access or another live invitation exists");
      // Renewing must not bypass the email cooldown.
      const attempted=data.delivery?.attemptedAt;
      if(attempted instanceof Timestamp&&now.toMillis()-attempted.toMillis()<60000)throw new HttpsError("resource-exhausted","Wait one minute before renewing");
      tx.update(ref,{role:command.role,scope:command.scope,modules:command.modules,teamIds:[],companyIds:selected,status:"pending",invitedByUid:uid,expiresAt:Timestamp.fromMillis(now.toMillis()+7*86400000),updatedAt:now});
      tx.set(lock,{invitationId,updatedAt:now});
    }
    tx.create(root().collection("auditEvents").doc(),{...audit(uid,String(actor.data()!.email),`invitation.${action}`,invitationId),reason:`Invitation for ${data.email}`,before:{role:data.role,scope:data.scope,companyIds:data.companyIds??[],status:data.status},...(action==="renew"?{after:input.patch}:{})});
  });
  return action==="renew"?{delivery:await deliverInvitation(invitationId,uid)}:{deleted:true};
});

// Generic response prevents revealing whether an email is invited/registered.
export const requestEmailAccess=onCall(crmCallableOptions,async request=>{
  const input=object(request.data);exact(input,["email","locale"]);
  const email=typeof input.email==="string"?input.email.trim().toLowerCase():"";
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new HttpsError("invalid-argument","Valid email required");
  const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
  const db=getFirestore(),hour=Math.floor(Date.now()/3600000);
  const limits=[{key:`email-${hash(email)}`,max:5},{key:`ip-${hash(request.rawRequest.ip??"unknown")}`,max:20}];
  const allowed=await db.runTransaction(async tx=>{
    const refs=limits.map(l=>db.collection("emailRequestLimits").doc(l.key)),snaps=await Promise.all(refs.map(r=>tx.get(r)));
    if(snaps.some((s,i)=>s.data()?.hour===hour&&Number(s.data()?.count)>=limits[i]!.max))return false;
    refs.forEach((r,i)=>tx.set(r,{hour,count:snaps[i]!.data()?.hour===hour?Number(snaps[i]!.data()?.count??0)+1:1}));return true;
  });
  if(!allowed)throw new HttpsError("resource-exhausted","Please wait before requesting another link");
  const [members,invites]=await Promise.all([root().collection("memberships").where("email","==",email).limit(1).get(),root().collection("invitations").where("email","==",email).get()]);
  const member=members.docs[0]?.data();
  if(member?member.status==="active"&&Array.isArray(member.companyIds)&&member.companyIds.length:invites.docs.some(d=>live(d.data()))) {
    try{await sendAccessEmail(email,typeof input.locale==="string"?input.locale:"en");}catch{throw new HttpsError("unavailable","Email service unavailable. Try again later");}
  }
  return {requested:true};
});
