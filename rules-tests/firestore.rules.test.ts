import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "demo-d2-map-crm";
const organizationId = "d2-group";
const rulesPath = fileURLToPath(new URL("../firestore.rules", import.meta.url));

let environment: RulesTestEnvironment;

function membershipPath(uid: string): string {
  return `organizations/${organizationId}/memberships/${uid}`;
}

function membership(role: string, status = "active") {
  return {
    email: `${role}@example.com`,
    displayName: role,
    role,
    status,
    scope: "organization",
    modules: ["dashboard", "admin"],
  };
}

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(rulesPath, "utf8") },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      setDoc(doc(database, membershipPath("owner")), membership("owner")),
      setDoc(doc(database, membershipPath("operations")), membership("operations_admin")),
      setDoc(doc(database, membershipPath("representative")), membership("sales_rep")),
      setDoc(doc(database, membershipPath("suspended")), membership("sales_rep", "suspended")),
      setDoc(doc(database, membershipPath("suspended-admin")), membership("operations_admin", "suspended")),
      setDoc(doc(database, membershipPath("no-admin-module")), { ...membership("owner"), modules: ["dashboard"] }),
      setDoc(doc(database, membershipPath("denied-admin")), { ...membership("owner"), permissionOverrides: { "membership.read": false, "audit.read": false } }),
      setDoc(doc(database, `organizations/${organizationId}/invitations/invite-1`), { email: "new@example.com" }),
      setDoc(doc(database, `organizations/${organizationId}/auditEvents/audit-1`), { action: "membership.updated" }),
      setDoc(doc(database, `organizations/${organizationId}`), { name: "D2 Group" }),
      setDoc(doc(database, "users/legacy-user"), { email: "legacy@example.com" }),
    ]);
  });
});

afterAll(async () => {
  await environment.cleanup();
});

describe("Firestore governance rules", () => {
  it("limits a Portal custom-token session to its company and expiration", async () => {
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await updateDoc(doc(db, membershipPath("owner")), { companyIds: ["d2-smart-home", "d2-hvac-solutions"] });
      for (const org of ["d2-smart-home", "d2-hvac-solutions"])
        await setDoc(doc(db, `organizations/${org}/memberships/owner`), membership("owner"));
    });
    const claims = { firebase: { sign_in_provider: "custom" }, portal_bridge: true,
      portal_company: "smart", portal_until: Math.floor(Date.now() / 1000) + 900 };
    const db = environment.authenticatedContext("owner", claims).firestore();
    await assertSucceeds(getDoc(doc(db, membershipPath("owner"))));
    await assertSucceeds(getDoc(doc(db, "organizations/d2-smart-home/memberships/owner")));
    await assertFails(getDoc(doc(db, "organizations/d2-hvac-solutions/memberships/owner")));
    await assertFails(getDocs(collection(db, "organizations/d2-group/auditEvents")));
    const expired = environment.authenticatedContext("owner", { ...claims, portal_until: 1 }).firestore();
    await assertFails(getDoc(doc(expired, "organizations/d2-smart-home/memberships/owner")));
    const refreshedWithoutClaims = environment.authenticatedContext("owner", { firebase: { sign_in_provider: "custom" } }).firestore();
    await assertFails(getDoc(doc(refreshedWithoutClaims, "organizations/d2-smart-home/memberships/owner")));
  });
  it("isolates company directories and rejects stale grants or cross-company self reads",async()=>{
    await environment.withSecurityRulesDisabled(async context=>{
      const db=context.firestore();
      await updateDoc(doc(db,membershipPath("operations")),{companyIds:["d2-smart-home"]});
      for(const org of ["d2-smart-home","d2-hvac-solutions"]){
        await setDoc(doc(db,`organizations/${org}/memberships/operations`),membership("operations_admin"));
        await setDoc(doc(db,`organizations/${org}/auditEvents/one`),{action:"visit"});
      }
    });
    const db=environment.authenticatedContext("operations").firestore();
    await assertSucceeds(getDocs(collection(db,"organizations/d2-smart-home/memberships")));
    await assertSucceeds(getDocs(collection(db,"organizations/d2-smart-home/auditEvents")));
    await assertFails(getDocs(collection(db,"organizations/d2-hvac-solutions/memberships")));
    await assertFails(getDoc(doc(db,"organizations/d2-hvac-solutions/memberships/operations")));
    await assertFails(getDocs(collection(db,"organizations/d2-hvac-solutions/auditEvents")));
    await assertFails(updateDoc(doc(db,membershipPath("operations")),{companyIds:["d2-smart-home","d2-hvac-solutions"]}));
    await environment.withSecurityRulesDisabled(async context=>updateDoc(doc(context.firestore(),membershipPath("operations")),{status:"suspended"}));
    await assertFails(getDocs(collection(db,"organizations/d2-smart-home/auditEvents")));
  });
  it("rejects unauthenticated membership reads", async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(database, membershipPath("representative"))));
  });

  it("allows a user to read their own membership even when suspended", async () => {
    const activeDatabase = environment.authenticatedContext("representative").firestore();
    const suspendedDatabase = environment.authenticatedContext("suspended").firestore();
    await assertSucceeds(getDoc(doc(activeDatabase, membershipPath("representative"))));
    await assertSucceeds(getDoc(doc(suspendedDatabase, membershipPath("suspended"))));
  });

  it("limits the group directory to the super admin", async () => {
    const ownerDatabase = environment.authenticatedContext("owner").firestore();
    const operationsDatabase = environment.authenticatedContext("operations").firestore();
    await assertSucceeds(getDocs(collection(ownerDatabase, `organizations/${organizationId}/memberships`)));
    await assertFails(getDocs(collection(operationsDatabase, `organizations/${organizationId}/memberships`)));
  });

  it("rejects membership lists for sales users and suspended administrators", async () => {
    const representativeDatabase = environment.authenticatedContext("representative").firestore();
    const suspendedAdminDatabase = environment.authenticatedContext("suspended-admin").firestore();
    await assertFails(getDocs(collection(representativeDatabase, `organizations/${organizationId}/memberships`)));
    await assertFails(getDocs(collection(suspendedAdminDatabase, `organizations/${organizationId}/memberships`)));
  });

  it("rejects all direct membership writes including owner writes", async () => {
    const ownerDatabase = environment.authenticatedContext("owner").firestore();
    const reference = doc(ownerDatabase, membershipPath("representative"));
    await assertFails(setDoc(doc(ownerDatabase, membershipPath("new-member")), membership("viewer")));
    await assertFails(updateDoc(reference, { role: "owner" }));
    await assertFails(deleteDoc(reference));
  });

  it("limits group invitations and audit logs to the active super admin", async () => {
    const ownerDatabase = environment.authenticatedContext("owner").firestore();
    const operationsDatabase = environment.authenticatedContext("operations").firestore();
    const representativeDatabase = environment.authenticatedContext("representative").firestore();
    const invitation = doc(ownerDatabase, `organizations/${organizationId}/invitations/invite-1`);
    const audit = doc(ownerDatabase, `organizations/${organizationId}/auditEvents/audit-1`);
    await assertSucceeds(getDoc(invitation));
    await assertSucceeds(getDoc(audit));
    await assertFails(getDoc(doc(operationsDatabase, audit.path)));
    await assertFails(getDoc(doc(representativeDatabase, invitation.path)));
    await assertFails(getDoc(doc(representativeDatabase, audit.path)));
    await assertFails(setDoc(doc(ownerDatabase, `organizations/${organizationId}/auditEvents/client-write`), { action: "forged" }));
  });

  it("denies unknown and legacy paths by default", async () => {
    const ownerDatabase = environment.authenticatedContext("owner").firestore();
    await assertFails(getDoc(doc(ownerDatabase, "users/legacy-user")));
    await assertFails(getDoc(doc(ownerDatabase, `organizations/${organizationId}/leads/lead-1`)));
  });

  it("honors denied permissions and removed admin modules on the server", async () => {
    for (const uid of ["no-admin-module", "denied-admin"]) {
      const db = environment.authenticatedContext(uid).firestore();
      await assertFails(getDocs(collection(db, `organizations/${organizationId}/memberships`)));
      await assertFails(getDocs(collection(db, `organizations/${organizationId}/auditEvents`)));
      await assertSucceeds(getDoc(doc(db, membershipPath(uid))));
    }
  });

  it("denies cross-organization reads even for an owner", async () => {
    const db = environment.authenticatedContext("owner").firestore();
    await assertFails(getDocs(collection(db, "organizations/another-organization/memberships")));
    await assertFails(getDoc(doc(db, "organizations/another-organization/auditEvents/event")));
  });

  it("revokes administrative reads after suspension", async () => {
    const db = environment.authenticatedContext("owner").firestore();
    await assertSucceeds(getDocs(collection(db, `organizations/${organizationId}/memberships`)));
    await environment.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), membershipPath("owner")), { status: "suspended" }));
    await assertFails(getDocs(collection(db, `organizations/${organizationId}/memberships`)));
  });
});
