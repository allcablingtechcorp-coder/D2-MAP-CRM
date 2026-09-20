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
    modules: ["dashboard"],
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

  it("allows active owners and operations administrators to list memberships", async () => {
    const ownerDatabase = environment.authenticatedContext("owner").firestore();
    const operationsDatabase = environment.authenticatedContext("operations").firestore();
    await assertSucceeds(getDocs(collection(ownerDatabase, `organizations/${organizationId}/memberships`)));
    await assertSucceeds(getDocs(collection(operationsDatabase, `organizations/${organizationId}/memberships`)));
  });

  it("rejects membership lists for sales users and suspended administrators", async () => {
    const representativeDatabase = environment.authenticatedContext("representative").firestore();
    const suspendedAdminDatabase = environment.authenticatedContext("suspended").firestore();
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

  it("limits invitations and audit logs to active administrators", async () => {
    const ownerDatabase = environment.authenticatedContext("owner").firestore();
    const operationsDatabase = environment.authenticatedContext("operations").firestore();
    const representativeDatabase = environment.authenticatedContext("representative").firestore();
    const invitation = doc(ownerDatabase, `organizations/${organizationId}/invitations/invite-1`);
    const audit = doc(operationsDatabase, `organizations/${organizationId}/auditEvents/audit-1`);
    await assertSucceeds(getDoc(invitation));
    await assertSucceeds(getDoc(audit));
    await assertFails(getDoc(doc(representativeDatabase, invitation.path)));
    await assertFails(getDoc(doc(representativeDatabase, audit.path)));
    await assertFails(setDoc(doc(ownerDatabase, `organizations/${organizationId}/auditEvents/client-write`), { action: "forged" }));
  });

  it("denies unknown and legacy paths by default", async () => {
    const ownerDatabase = environment.authenticatedContext("owner").firestore();
    await assertFails(getDoc(doc(ownerDatabase, "users/legacy-user")));
    await assertFails(getDoc(doc(ownerDatabase, `organizations/${organizationId}/leads/lead-1`)));
  });
});
