import { defineBoolean } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import { canManageMemberships, parseMembershipDocument } from "./membershipPolicy.js";
export const crmCallableOptions = { region: "us-central1", memory: "256MiB" as const, timeoutSeconds: 60, maxInstances: 3, serviceAccount: "d2-crm-runtime@d2-map-crm.iam.gserviceaccount.com", enforceAppCheck: defineBoolean("CRM_ENFORCE_APPCHECK", { default: false }) };

// Bridge authority is signed after live Portal and CRM checks. Every owner
// request also rechecks the server-managed protected membership below.
export function assertPortalLease(token: Record<string, unknown>, organizationId: unknown, allowGroup = false, reportRead = false) {
  const firebase = token.firebase as { sign_in_provider?: unknown } | undefined;
  const custom = firebase?.sign_in_provider === "custom";
  if (!custom && token.portal_bridge !== true) return;
  const company = token.portal_company;
  const until = token.portal_until;
  if (!custom || token.portal_bridge !== true || (company !== "smart" && company !== "hvac")
    || typeof until !== "number" || !Number.isSafeInteger(until) || until <= Math.floor(Date.now() / 1000))
    throw new HttpsError("permission-denied", "Portal CRM session expired");
  const allowed = company === "smart" ? "d2-smart-home" : "d2-hvac-solutions";
  if(token.portal_report_all===true){
    if(!reportRead||(!["d2-smart-home","d2-hvac-solutions"].includes(String(organizationId))&&!(allowGroup&&organizationId==="d2-group")))throw new HttpsError("permission-denied","Combined report sessions are read-only");
    return;
  }
  if(token.portal_owner===true && ["d2-group","d2-smart-home","d2-hvac-solutions"].includes(String(organizationId)))return;
  if (organizationId !== allowed && !(allowGroup && organizationId === "d2-group"))
    throw new HttpsError("permission-denied", "Company is outside this Portal session");
}

export async function assertPortalRequest(auth: {uid:string;token:Record<string,unknown>}, organizationId:unknown, allowGroup=false, reportRead=false) {
  assertPortalLease(auth.token,organizationId,allowGroup,reportRead);
  if(auth.token.portal_bridge!==true || auth.token.portal_owner!==true || auth.token.portal_report_all===true)return;
  const snapshot=await getFirestore().doc(`organizations/d2-group/memberships/${auth.uid}`).get();
  if(!snapshot.exists)throw new HttpsError("permission-denied","Protected CRM owner required");
  const membership=parseMembershipDocument(snapshot.data());
  const email=String(auth.token.email||"").trim().toLowerCase();
  if(membership.ownerProtected!==true || !canManageMemberships(membership)
    || membership.email!=="allcablingtechcorp@gmail.com" || email!==membership.email
    || !["d2-smart-home","d2-hvac-solutions"].every(id=>snapshot.data()?.companyIds?.includes(id)))
    throw new HttpsError("permission-denied","Protected CRM owner access changed");
}

// One bounded document per authenticated identity, never a new document per request.
export async function consumeRequestBudget(uid: string) {
  const ref = getFirestore().doc(`systemRateLimits/${createHash("sha256").update(uid).digest("hex")}`);
  const minute = Math.floor(Date.now()/60000);
  await getFirestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref), data = snapshot.data();
    const count = data?.minute === minute ? Number(data.count) : 0;
    if (count >= 360) throw new HttpsError("resource-exhausted", "Request limit reached. Retry in one minute.");
    tx.set(ref, { minute, count: count+1 });
  });
}
