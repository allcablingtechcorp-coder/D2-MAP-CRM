import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";

// Never connect these destructive fixtures to a real Firebase project.
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST && process.env.GCLOUD_PROJECT === "demo-d2-map-crm";
describe.skipIf(!enabled)("callable transactions against the Firestore emulator", () => {
  let api: typeof import("./index.js");
  const organizationId = "audit-integration";
  const owner = { email: "owner@example.test", displayName: "Owner", role: "owner", status: "active", scope: "organization", modules: ["dashboard", "leads", "companies", "pipeline", "activities", "reports", "admin"] };
  const member = { email: "rep@example.test", displayName: "Rep", role: "sales_rep", status: "active", scope: "assigned_records", modules: ["leads", "companies", "pipeline", "activities"] };
  const request = (uid: string, data: object, token: Record<string, unknown> = {}) => ({ data: { organizationId, ...data }, auth: { uid, token: { email: uid === "owner" ? owner.email : member.email, email_verified: true, auth_time: 123456, firebase: { sign_in_provider: "google.com" }, ...token } } }) as CallableRequest;
  const org = () => getFirestore().doc(`organizations/${organizationId}`);
  const invite = (email = "new@example.test") => ({ email, role: "sales_rep", scope: "assigned_records", modules: ["leads", "companies"], teamIds: [] });

  beforeAll(async () => { api = await import("./index.js"); });
  beforeEach(async () => {
    await getFirestore().recursiveDelete(org());
    await org().set({ name: "Isolated audit fixtures" });
    await org().collection("memberships").doc("owner").set(owner);
    await org().collection("memberships").doc("rep").set(member);
  });

  it("saves a legacy membership without teamIds and commits a serializable audit event", async () => {
    const result = await api.saveMembership.run(request("owner", { targetUid: "rep", reason: "Audit review", patch: { role: "viewer", status: "active", scope: "assigned_records", modules: ["leads"], teamIds: [] } }));
    expect(result.saved).toBe(true);
    expect((await org().collection("memberships").doc("rep").get()).data()?.role).toBe("viewer");
    expect((await org().collection("auditEvents").doc(result.auditEventId).get()).data()?.changes.role.to).toBe("viewer");
  });

  it("rejects unverified invitation identities without creating access", async () => {
    await api.createGovernanceInvitation.run(request("owner", invite()));
    await expect(api.acceptGovernanceInvitation.run(request("new", {}, { email: "new@example.test", email_verified: false }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await org().collection("memberships").doc("new").get()).exists).toBe(false);
  });

  it("accepts the matching verified identity once, preserves revocation, and hides the invitation from other identities", async () => {
    await api.createGovernanceInvitation.run(request("owner", invite()));
    expect(await api.acceptGovernanceInvitation.run(request("other", {}, { email: "other@example.test" }))).toEqual({ accepted: false });
    expect(await api.acceptGovernanceInvitation.run(request("new", {}, { email: "new@example.test" }))).toEqual({ accepted: true });
    await org().collection("memberships").doc("new").update({ status: "revoked" });
    expect(await api.acceptGovernanceInvitation.run(request("new", {}, { email: "new@example.test" }))).toEqual({ accepted: false });
    expect((await org().collection("auditEvents").where("action", "==", "membership.invitation_accepted").get()).size).toBe(1);
  });

  it("allows renewing an expired invitation and prevents simultaneous duplicates", async () => {
    const first = await api.createGovernanceInvitation.run(request("owner", invite()));
    await org().collection("invitations").doc(first.invitation.id).update({ expiresAt: Timestamp.fromMillis(1) });
    const directory = await api.listGovernanceDirectory.run(request("owner", {}));
    expect(directory.invitations[0]?.status).toBe("expired");
    const results = await Promise.allSettled([api.createGovernanceInvitation.run(request("owner", invite())), api.createGovernanceInvitation.run(request("owner", invite()))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await api.acceptGovernanceInvitation.run(request("new", {}, { email: "new@example.test" }))).toEqual({ accepted: true });
  });

  it("derives session outcome from membership and rejects unknown organizations", async () => {
    await api.recordSessionEvent.run(request("stranger", { event: "signed_in" }, { email: "stranger@example.test" }));
    const events = await org().collection("auditEvents").get();
    expect(events.docs.map((document) => document.data().action)).toEqual(["auth.access_denied"]);
    await expect(api.recordSessionEvent.run(request("owner", { organizationId: "nonexistent-audit-org", event: "signed_in" }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("enforces cross-user isolation, module restrictions and suspended access", async () => {
    await org().collection("companies").doc("private").set({ ownerUid: "other", name: "Private", teamId: "team-b" });
    await org().collection("contacts").doc("mine").set({ ownerUid: "rep", email: "private@example.test" });
    const snapshot = await api.loadCommercialWorkspace.run(request("rep", {}));
    expect(snapshot.companies).toHaveLength(0);
    await expect(api.createCommercialContact.run(request("rep", { companyId: "private", name: "Attempt", title: "", email: "contact@example.test", phone: "" }))).rejects.toMatchObject({ code: "permission-denied" });
    await org().collection("memberships").doc("rep").update({ modules: ["dashboard"] });
    expect((await api.loadCommercialWorkspace.run(request("rep", {}))).contacts).toHaveLength(0);
    await org().collection("memberships").doc("rep").update({ status: "suspended" });
    await expect(api.createCommercialCompany.run(request("rep", { name: "Blocked", location: "FL", industry: "", website: "", phone: "" }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("persists companies and contacts, audits mutations, and keeps repeated completion idempotent", async () => {
    const { company } = await api.createCommercialCompany.run(request("rep", { name: "Test company", location: "FL", industry: "Construction", website: "", phone: "" }));
    await api.createCommercialContact.run(request("rep", { companyId: company.id, name: "Contact", title: "Buyer", email: "buyer@example.test", phone: "" }));
    const { activity } = await api.createCommercialActivity.run(request("rep", { companyName: company.name, kind: "call", subject: "Follow up", dueAt: "2026-10-01T12:00:00.000Z" }));
    await api.completeCommercialActivity.run(request("rep", { recordId: activity.id }));
    await api.completeCommercialActivity.run(request("rep", { recordId: activity.id }));
    const loaded = await api.loadCommercialWorkspace.run(request("rep", {}));
    expect(loaded.companies[0]?.id).toBe(company.id);
    expect(loaded.contacts[0]?.email).toBe("buyer@example.test");
    expect(loaded.activities[0]?.completed).toBe(true);
    expect((await org().collection("auditEvents").where("action", "==", "commercial.activity_completed").get()).size).toBe(1);
  });

  it("protects the corporate owner and rejects self-promotion and forged identities", async () => {
    await org().collection("memberships").doc("owner").update({ email: "allcablingtechcorp@gmail.com", ownerProtected: true });
    const patch = { role: "viewer", status: "suspended", scope: "assigned_records", modules: ["leads"], teamIds: [] };
    await expect(api.saveMembership.run(request("owner", { targetUid: "owner", patch, reason: "Attempt" }))).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(api.saveMembership.run(request("rep", { targetUid: "rep", patch: { ...patch, role: "owner" }, reason: "Attempt" }))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(api.createGovernanceInvitation.run(request("rep", invite()))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(api.createCommercialCompany.run(request("rep", { name: "Test", location: "FL", ownerUid: "owner" }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect((await org().collection("auditEvents").get()).empty).toBe(true);
  });

  it("isolates assigned teams and organizations for both reads and writes", async () => {
    await org().collection("memberships").doc("rep").update({ scope: "assigned_teams", teamIds: ["south"] });
    await org().collection("activities").doc("south-record").set({ ownerUid: "coworker", teamId: "south", completed: false });
    await org().collection("activities").doc("north-record").set({ ownerUid: "rep", teamId: "north", completed: false });
    expect((await api.loadCommercialWorkspace.run(request("rep", {}))).activities.map((item) => item.id)).toEqual(["south-record"]);
    await api.completeCommercialActivity.run(request("rep", { recordId: "south-record" }));
    await expect(api.completeCommercialActivity.run(request("rep", { recordId: "north-record" }))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(api.loadCommercialWorkspace.run(request("rep", { organizationId: "other-org" }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("persists controlled pipeline transitions and rejects impossible stages and dates", async () => {
    const data = { companyName: "Pipeline test", title: "Network", amountCents: 10000, nextAction: "Call", expectedCloseAt: "2026-10-01" };
    await expect(api.createCommercialOpportunity.run(request("rep", { ...data, expectedCloseAt: "2026-02-30" }))).rejects.toMatchObject({ code: "invalid-argument" });
    const { opportunity } = await api.createCommercialOpportunity.run(request("rep", data));
    await expect(api.transitionCommercialOpportunity.run(request("rep", { recordId: opportunity.id, stage: "won" }))).rejects.toMatchObject({ code: "failed-precondition" });
    for (const stage of ["diagnosis", "proposal", "negotiation", "won"]) await api.transitionCommercialOpportunity.run(request("rep", { recordId: opportunity.id, stage }));
    expect((await api.loadCommercialWorkspace.run(request("rep", {}))).opportunities[0]?.stage).toBe("won");
    await expect(api.transitionCommercialOpportunity.run(request("rep", { recordId: opportunity.id, stage: "lost" }))).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("refuses a partial workspace instead of returning misleading truncated report totals", async () => {
    const writer = getFirestore().bulkWriter();
    for (let index = 0; index < 501; index++) writer.create(org().collection("leads").doc(`lead-${index}`), { ownerUid: "rep" });
    await writer.close();
    await expect(api.loadCommercialWorkspace.run(request("rep", {}))).rejects.toMatchObject({ code: "resource-exhausted" });
  });
});
