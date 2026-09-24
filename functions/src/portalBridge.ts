import { getApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { crmCallableOptions, consumeRequestBudget } from "./requestProtection.js";
import { GROUP_ID } from "./companyWorkspaces.js";
import { isProtectedOwner, parseMembershipDocument } from "./membershipPolicy.js";

const PORTAL_PROJECT = "d2-group-system";
const PORTAL_SESSION_URL = "https://d2-group-system.web.app/api/workspace";
const PORTAL_OWNER_EMAIL = "dante.frota@allcablingtech.com";
const CRM_OWNER_EMAIL = "allcablingtechcorp@gmail.com";
const CRM_RUNTIME_SERVICE_ACCOUNT = "d2-crm-runtime@d2-map-crm.iam.gserviceaccount.com";
const organizationByCompany = { smart: "d2-smart-home", hvac: "d2-hvac-solutions" } as const;
type Company = keyof typeof organizationByCompany;

export function portalCrmGrant(session: unknown, uid: string, email: string, company: Company): boolean {
  if (!session || typeof session !== "object") return false;
  const state = session as Record<string, unknown>;
  const grants = state.grants as Record<string, { status?: string; modules?: { crm?: { scope?: string; actions?: string[] } } }> | undefined;
  return state.uid === uid && state.email === email && state.superAdmin === true
    && email === PORTAL_OWNER_EMAIL && Array.isArray(state.companies) && state.companies.includes(company)
    && grants?.[company]?.status === "active" && grants[company].modules?.crm?.scope === "company"
    && grants[company].modules?.crm?.actions?.includes("read") === true;
}

function verifier() {
  const app = (() => { try { return getApp("d2-portal-verifier"); } catch { return initializeApp({ projectId: PORTAL_PROJECT }, "d2-portal-verifier"); } })();
  return getAuth(app);
}

function tokenSigner() {
  const app = (() => { try { return getApp("d2-crm-token-signer"); } catch { return initializeApp({ projectId: "d2-map-crm", serviceAccountId: CRM_RUNTIME_SERVICE_ACCOUNT }, "d2-crm-token-signer"); } })();
  return getAuth(app);
}

export const portalCrmExchange = onCall(crmCallableOptions, async request => {
  const input = request.data as { portalToken?: unknown; company?: unknown } | null;
  if (!input || Object.keys(input).some(key => !["portalToken", "company"].includes(key))
    || typeof input.portalToken !== "string" || input.portalToken.length < 100 || input.portalToken.length > 8000
    || (input.company !== "smart" && input.company !== "hvac")) throw new HttpsError("invalid-argument", "Invalid Portal handoff");
  const company = input.company as Company;
  let decoded;
  try { decoded = await verifier().verifyIdToken(input.portalToken); }
  catch { throw new HttpsError("unauthenticated", "Portal session is invalid"); }
  const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
  if (email !== PORTAL_OWNER_EMAIL) throw new HttpsError("permission-denied", "Portal owner access required");
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
  const auth = getAuth();
  const user = await auth.getUserByEmail(CRM_OWNER_EMAIL);
  if (user.disabled) throw new HttpsError("permission-denied", "CRM owner account is disabled");
  const db = getFirestore(), org = organizationByCompany[company];
  const [group, member] = await Promise.all([
    db.doc(`organizations/${GROUP_ID}/memberships/${user.uid}`).get(),
    db.doc(`organizations/${org}/memberships/${user.uid}`).get(),
  ]);
  if (!group.exists || !member.exists) throw new HttpsError("permission-denied", "CRM membership is unavailable");
  const groupAccess = parseMembershipDocument(group.data()), companyAccess = parseMembershipDocument(member.data());
  if (!isProtectedOwner(groupAccess) || groupAccess.role !== "owner" || groupAccess.status !== "active"
    || !Array.isArray(group.data()?.companyIds) || !group.data()!.companyIds.includes(org)
    || companyAccess.role !== "owner" || companyAccess.status !== "active" || companyAccess.email !== CRM_OWNER_EMAIL)
    throw new HttpsError("permission-denied", "CRM owner membership is unavailable");
  const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;
  const token = await tokenSigner().createCustomToken(user.uid, { portal_bridge: true, portal_company: company, portal_until: expiresAt });
  return { token, expiresAt };
});
