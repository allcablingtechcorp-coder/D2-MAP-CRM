import { getApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { crmCallableOptions, consumeRequestBudget } from "./requestProtection.js";
import { GROUP_ID } from "./companyWorkspaces.js";
import { canManageMemberships, isProtectedOwner, parseMembershipDocument, type MembershipDocument } from "./membershipPolicy.js";

const PORTAL_PROJECT = "d2-group-system";
const PORTAL_SESSION_URL = "https://d2-group-system.web.app/api/workspace";
const PORTAL_OWNER_EMAIL = "dante.frota@allcablingtech.com";
const CRM_OWNER_EMAIL = "allcablingtechcorp@gmail.com";
const LEONARDO_PORTAL_EMAIL = "leonardo.dantas@allcablingtech.com";
const LEONARDO_CRM_EMAIL = "leonardoagiani@gmail.com";
const CRM_RUNTIME_SERVICE_ACCOUNT = "d2-crm-runtime@d2-map-crm.iam.gserviceaccount.com";
const organizationByCompany = { smart: "d2-smart-home", hvac: "d2-hvac-solutions" } as const;
type Company = keyof typeof organizationByCompany;

export function leonardoCrmMembershipReady(group: MembershipDocument, company: MembershipDocument, companyIds: unknown): boolean {
  const requiredModules = ["dashboard", "leads", "pipeline", "activities", "prospecting", "companies", "reports"] as const;
  return Array.isArray(companyIds) && companyIds.includes("d2-smart-home") && !companyIds.includes("d2-hvac-solutions")
    && group.email === LEONARDO_CRM_EMAIL && company.email === LEONARDO_CRM_EMAIL
    && group.status === "active" && company.status === "active"
    && group.role === "sales_manager" && company.role === "sales_manager"
    && company.scope === "organization" && !isProtectedOwner(group) && !isProtectedOwner(company)
    && requiredModules.every(module => company.modules.includes(module));
}

export function portalCrmGrant(session: unknown, uid: string, email: string, company: Company): boolean {
  if (!session || typeof session !== "object") return false;
  const state = session as Record<string, unknown>;
  const grants = state.grants as Record<string, { status?: string; role?: string; modules?: { crm?: { scope?: string; actions?: string[] } } }> | undefined;
  const owner = state.superAdmin === true && email === PORTAL_OWNER_EMAIL;
  const leonardo = email === LEONARDO_PORTAL_EMAIL && company === "smart" && state.emailVerified === true
    && grants?.smart?.role === "manager" && ["read", "create", "edit", "assign"].every(action => grants?.smart?.modules?.crm?.actions?.includes(action));
  return state.uid === uid && state.email === email && (owner || leonardo)
    && Array.isArray(state.companies) && state.companies.includes(company)
    && grants?.[company]?.status === "active" && grants[company].modules?.crm?.scope === "company"
    && grants[company].modules?.crm?.actions?.includes("read") === true;
}

function verifier() {
  const app = (() => { try { return getApp("d2-portal-verifier"); } catch { return initializeApp({ projectId: PORTAL_PROJECT }, "d2-portal-verifier"); } })();
  return getAuth(app);
}

export function ownerPortalReady(session:unknown,uid:string,email:string,group:MembershipDocument,companyIds:unknown,members:Record<string,MembershipDocument>):boolean {
  const state=session as {superAdmin?:boolean}|null;
  return state?.superAdmin===true && email===PORTAL_OWNER_EMAIL
    && group.ownerProtected===true && group.email===CRM_OWNER_EMAIL && canManageMemberships(group)
    && Array.isArray(companyIds) && Object.values(organizationByCompany).every(id=>companyIds.includes(id)
      && members[id]?.email===CRM_OWNER_EMAIL && canManageMemberships(members[id]!))
    && ["smart","hvac"].every(value=>{
      if(!portalCrmGrant(session,uid,email,value as Company))return false;
      const grant=(session as {grants:Record<string,{modules:{crm:{actions:string[]}}}>}).grants[value]!.modules.crm;
      return ["read","create","edit","assign","export"].every(action=>grant.actions.includes(action));
    });
}

function tokenSigner() {
  const app = (() => { try { return getApp("d2-crm-token-signer"); } catch { return initializeApp({ projectId: "d2-map-crm", serviceAccountId: CRM_RUNTIME_SERVICE_ACCOUNT }, "d2-crm-token-signer"); } })();
  return getAuth(app);
}

export const portalCrmExchange = onCall(crmCallableOptions, async request => {
  const input = request.data as { portalToken?: unknown; company?: unknown; scope?:unknown } | null;
  if (!input || Object.keys(input).some(key => !["portalToken", "company", "scope"].includes(key))
    || (input.scope!==undefined&&input.scope!=="all")
    || typeof input.portalToken !== "string" || input.portalToken.length < 100 || input.portalToken.length > 8000
    || (input.company !== "smart" && input.company !== "hvac")) throw new HttpsError("invalid-argument", "Invalid Portal handoff");
  const company = input.company as Company;
  let decoded;
  try { decoded = await verifier().verifyIdToken(input.portalToken); }
  catch { throw new HttpsError("unauthenticated", "Portal session is invalid"); }
  const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
  await consumeRequestBudget(`portal:${decoded.uid}`);
  let session: unknown;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(PORTAL_SESSION_URL, { headers: { Authorization: `Bearer ${input.portalToken}` }, cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Portal session rejected");
      session = await response.json();
    } finally { clearTimeout(timer); }
  } catch { throw new HttpsError("unavailable", "Portal session could not be verified"); }
  if (!portalCrmGrant(session, decoded.uid, email, company)) throw new HttpsError("permission-denied", "CRM access is not authorized in the Portal");
  if(input.scope==="all"&&!["smart","hvac"].every(value=>portalCrmGrant(session,decoded.uid,email,value as Company)))throw new HttpsError("permission-denied","Combined reports require both company grants");
  const db = getFirestore(), org = organizationByCompany[company];
  const auth = getAuth(), owner = email === PORTAL_OWNER_EMAIL;
  let user;
  if (owner) user = await auth.getUserByEmail(CRM_OWNER_EMAIL);
  else {
    const link = (await db.doc(`portalIdentityLinks/${decoded.uid}`).get()).data();
    if (!link || company !== "smart" || link.portalEmail !== LEONARDO_PORTAL_EMAIL
      || link.crmEmail !== LEONARDO_CRM_EMAIL || link.companyId !== org || typeof link.crmUid !== "string")
      throw new HttpsError("permission-denied", "CRM identity link is unavailable");
    user = await auth.getUser(link.crmUid);
    if (user.email?.trim().toLowerCase() !== LEONARDO_CRM_EMAIL) throw new HttpsError("permission-denied", "CRM identity link changed");
  }
  if (user.disabled) throw new HttpsError("permission-denied", "CRM account is disabled");
  const [group, member] = await Promise.all([
    db.doc(`organizations/${GROUP_ID}/memberships/${user.uid}`).get(),
    db.doc(`organizations/${org}/memberships/${user.uid}`).get(),
  ]);
  if (!group.exists || !member.exists) throw new HttpsError("permission-denied", "CRM membership is unavailable");
  const groupAccess = parseMembershipDocument(group.data()), companyAccess = parseMembershipDocument(member.data());
  if (!Array.isArray(group.data()?.companyIds) || !group.data()!.companyIds.includes(org)
    || groupAccess.status !== "active" || companyAccess.status !== "active")
    throw new HttpsError("permission-denied", "CRM membership is unavailable");
  if (owner) {
    if (!isProtectedOwner(groupAccess) || groupAccess.role !== "owner" || companyAccess.role !== "owner" || companyAccess.email !== CRM_OWNER_EMAIL)
      throw new HttpsError("permission-denied", "CRM owner membership is unavailable");
  } else if (!leonardoCrmMembershipReady(groupAccess, companyAccess, group.data()?.companyIds)) {
    throw new HttpsError("permission-denied", "CRM manager membership is unavailable");
  }
  if(input.scope==="all"){
    if(!owner||groupAccess.ownerProtected!==true||groupAccess.role!=="owner")throw new HttpsError("permission-denied","Combined reports require the protected owner");
    for(const companyId of Object.values(organizationByCompany)){
      const record=await db.doc(`organizations/${companyId}/memberships/${user.uid}`).get();
      const membership=record.exists?parseMembershipDocument(record.data()):null;
      if(!membership||membership.status!=="active"||membership.role!=="owner"||!group.data()?.companyIds?.includes(companyId))throw new HttpsError("permission-denied","Combined report membership is unavailable");
    }
  }
  const ownerMembers:Record<string,MembershipDocument>={[org]:companyAccess};
  if(owner && input.scope!=="all")for(const companyId of Object.values(organizationByCompany)){
    if(companyId===org)continue;
    const record=await db.doc(`organizations/${companyId}/memberships/${user.uid}`).get();
    if(record.exists)ownerMembers[companyId]=parseMembershipDocument(record.data());
  }
  const fullOwner=input.scope!=="all" && ownerPortalReady(session,decoded.uid,email,groupAccess,group.data()?.companyIds,ownerMembers);
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const token = await tokenSigner().createCustomToken(user.uid, { portal_bridge: true, portal_company: company, portal_until: expiresAt, ...(input.scope==="all"?{portal_report_all:true}:fullOwner?{portal_owner:true}:{}) });
  return { token, expiresAt };
});
