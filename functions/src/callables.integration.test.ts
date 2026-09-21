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
    await api.createCommercialCompany.run(request("rep", { name: "Pipeline test", location: "FL", industry: "", website: "", phone: "" }));
    const data = { companyName: "Pipeline test", title: "Network", amountCents: 10000, nextAction: "Call", expectedCloseAt: "2026-10-01" };
    await expect(api.createCommercialOpportunity.run(request("rep", { ...data, expectedCloseAt: "2026-02-30" }))).rejects.toMatchObject({ code: "invalid-argument" });
    const { opportunity } = await api.createCommercialOpportunity.run(request("rep", data));
    await expect(api.transitionCommercialOpportunity.run(request("rep", { recordId: opportunity.id, stage: "won" }))).rejects.toMatchObject({ code: "failed-precondition" });
    for (const stage of ["diagnosis", "proposal", "negotiation", "won"]) await api.transitionCommercialOpportunity.run(request("rep", { recordId: opportunity.id, stage }));
    expect((await api.loadCommercialWorkspace.run(request("rep", {}))).opportunities[0]?.stage).toBe("won");
    await expect(api.transitionCommercialOpportunity.run(request("rep", { recordId: opportunity.id, stage: "lost" }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("edits with optimistic concurrency, preserves archive history and rejects forged ownership", async () => {
    const { company } = await api.createCommercialCompany.run(request("rep", { name: "Lifecycle", location: "FL", industry: "", website: "", phone: "" }));
    const change = { collection: "companies", recordId: company.id, revision: company.revision, reason: "Correct contact information" };
    await expect(api.changeCommercialRecord.run(request("rep", { ...change, action: "edit", patch: { ownerUid: "owner" } }))).rejects.toMatchObject({ code: "invalid-argument" });
    await api.changeCommercialRecord.run(request("rep", { ...change, action: "edit", patch: { name: "Lifecycle updated", phone: "555-0100" } }));
    await expect(api.changeCommercialRecord.run(request("rep", { ...change, action: "edit", patch: { phone: "stale" } }))).rejects.toMatchObject({ code: "aborted" });
    const page = () => api.loadCommercialPage.run(request("rep", { collection: "companies" }));
    let updated = (await page()).records[0]!;
    expect(updated).toMatchObject({ id: company.id, name: "Lifecycle updated", phone: "555-0100" });
    await api.changeCommercialRecord.run(request("rep", { ...change, revision: updated.revision, action: "archive" }));
    updated = (await page()).records[0]!; expect(updated.archived).toBe(true);
    await api.changeCommercialRecord.run(request("rep", { ...change, revision: updated.revision, action: "restore" }));
    expect((await page()).records[0]!.archived).toBe(false);
    expect((await api.commercialRecordHistory.run(request("rep", { collection: "companies", recordId: company.id }))).events).toHaveLength(4);
    await org().collection("memberships").doc("rep").update({ role: "viewer" });
    await expect(api.changeCommercialRecord.run(request("rep", { ...change, action: "archive" }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("reassigns only with authority and removes the prior user's access including history", async () => {
    await org().collection("memberships").doc("other").set({ ...member, email: "other@example.test", displayName: "Other rep" });
    const { company } = await api.createCommercialCompany.run(request("rep", { name: "Portfolio", location: "FL", industry: "", website: "", phone: "" }));
    const command = { collection: "companies", recordId: company.id, revision: company.revision, action: "reassign", ownerUid: "other", teamId: null, reason: "Transfer portfolio" };
    await expect(api.changeCommercialRecord.run(request("rep", command))).rejects.toMatchObject({ code: "permission-denied" });
    await api.changeCommercialRecord.run(request("owner", command));
    expect((await api.loadCommercialPage.run(request("rep", { collection: "companies" }))).records).toHaveLength(0);
    expect((await api.loadCommercialPage.run(request("other", { collection: "companies" }))).records[0]).toMatchObject({ ownerUid: "other", ownerName: "Other rep" });
    await expect(api.commercialRecordHistory.run(request("rep", { collection: "companies", recordId: company.id }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("uses company IDs for homonymous companies and refuses inaccessible relationships", async () => {
    const first = (await api.createCommercialCompany.run(request("rep", { name: "Same name", location: "Miami", industry: "", website: "", phone: "" }))).company;
    const second = (await api.createCommercialCompany.run(request("rep", { name: "Same name", location: "Orlando", industry: "", website: "", phone: "" }))).company;
    const data = { companyName: "Same name", kind: "call", subject: "Only Orlando", dueAt: "2026-10-01T12:00:00.000Z" };
    await expect(api.createCommercialActivity.run(request("rep", data))).rejects.toMatchObject({ code: "failed-precondition" });
    const { activity } = await api.createCommercialActivity.run(request("rep", { ...data, companyId: second.id }));
    expect(activity.companyId).toBe(second.id); expect(activity.companyId).not.toBe(first.id);
    await org().collection("companies").doc(first.id).update({ ownerUid: "someone-else" });
    await expect(api.changeCommercialRecord.run(request("rep", { collection: "activities", recordId: activity.id, revision: activity.revision, action: "edit", patch: { companyId: first.id }, reason: "Attempt cross account link" }))).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("requires reopen permission and preserves closed opportunity audit history", async () => {
    const ref = org().collection("opportunities").doc("closed");
    await ref.set({ ownerUid: "rep", title: "Closed", stage: "won", amountCents: 1000 });
    const command = { collection: "opportunities", recordId: "closed", revision: "", action: "reopen", reason: "Customer reopened scope" };
    await expect(api.changeCommercialRecord.run(request("rep", command))).rejects.toMatchObject({ code: "permission-denied" });
    await api.changeCommercialRecord.run(request("owner", command));
    expect((await ref.get()).data()?.stage).toBe("discovery");
    expect((await ref.collection("history").get()).docs[0]?.data().changes.stage).toEqual({ before: "won", after: "discovery" });
  });

  it("paginates more than 500 records without omissions, duplicates or cross-user leaks", async () => {
    const writer = getFirestore().bulkWriter();
    for (let i=0;i<501;i++) writer.create(org().collection("leads").doc(`lead-${String(i).padStart(4,"0")}`), { ownerUid: "rep" });
    writer.create(org().collection("leads").doc("private"), { ownerUid: "other" }); await writer.close();
    const ids: string[] = []; let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<typeof api.loadCommercialPage.run>> = await api.loadCommercialPage.run(request("rep", { collection: "leads", cursor }));
      ids.push(...page.records.map((item) => item.id)); cursor = page.nextCursor;
    } while(cursor);
    expect(ids).toHaveLength(501); expect(new Set(ids).size).toBe(501); expect(ids).not.toContain("private");
    await org().collection("memberships").doc("rep").update({ modules: ["dashboard"] });
    expect((await api.loadCommercialPage.run(request("rep", { collection: "contacts" }))).records).toEqual([]);
  });

  it("validates explicit team selection and keeps preferences private", async () => {
    await org().collection("teams").doc("south").set({ name: "South" });
    await org().collection("teams").doc("north").set({ name: "North" });
    await org().collection("memberships").doc("rep").update({ scope: "assigned_teams", teamIds: ["south"] });
    const data = { name: "Team company", location: "FL", industry: "", website: "", phone: "" };
    await expect(api.createCommercialCompany.run(request("rep", { ...data, teamId: "north" }))).rejects.toMatchObject({ code: "permission-denied" });
    expect((await api.createCommercialCompany.run(request("rep", { ...data, teamId: "south" }))).company.teamId).toBe("south");
    expect((await api.listAssignmentOptions.run(request("rep", {}))).teams.map((team) => team.id)).toEqual(["south"]);
    await api.userPreferences.run(request("rep", { locale: "es" }));
    expect((await api.userPreferences.run(request("rep", {}))).locale).toBe("es");
    expect((await api.userPreferences.run(request("owner", {}))).locale).toBe(null);
    await expect(api.userPreferences.run(request("rep", { uid: "owner", locale: "pt" }))).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("refuses a partial workspace instead of returning misleading truncated report totals", async () => {
    const writer = getFirestore().bulkWriter();
    for (let index = 0; index < 501; index++) writer.create(org().collection("leads").doc(`lead-${index}`), { ownerUid: "rep" });
    await writer.close();
    await expect(api.loadCommercialWorkspace.run(request("rep", {}))).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("atomically schedules a mapped lead, deduplicates retries and records the actual visitor", async () => {
    await org().collection("memberships").doc("rep").update({modules:[...member.modules,"prospecting"]});
    await org().collection("memberships").doc("owner").update({modules:[...owner.modules,"prospecting"]});
    const plan={requestId:"visit-request",action:"plan",placeId:"google-place",name:"Office",location:"Boca",position:{lat:26,lng:-80},at:new Date(Date.now()+86400000).toISOString(),note:"Meet facilities"};
    const [first,second]=await Promise.all([api.saveProspectingVisit.run(request("rep",plan)),api.saveProspectingVisit.run(request("rep",plan))]);
    expect(first).toEqual(second);expect((await org().collection("leads").get()).size).toBe(1);expect((await org().collection("activities").get()).size).toBe(1);
    const at=new Date(Date.now()-3600000).toISOString();
    const complete={...plan,requestId:"complete-request",action:"complete",leadId:first.leadId,activityId:first.activityId,at,note:"Met the buyer"};
    await api.saveProspectingVisit.run(request("owner",complete));
    await api.saveProspectingVisit.run(request("owner",complete));
    const loaded=await api.loadCommercialPage.run(request("owner",{collection:"activities"}));
    expect(loaded.records[0]).toMatchObject({completed:true,ownerName:"Rep",completedByName:"Owner",completedAt:at,visitNote:"Met the buyer"});
    expect((await org().collection("leads").doc(first.leadId).collection("history").get()).size).toBe(2);
    expect((await api.loadCommercialPage.run(request("rep",{collection:"leads"}))).records[0]).toMatchObject({placeId:"google-place",position:{lat:26,lng:-80}});
    await api.saveProspectingVisit.run(request("owner",{...complete,requestId:"manager-revisit",activityId:undefined}));
    const visits=(await api.loadCommercialPage.run(request("rep",{collection:"activities"}))).records;
    expect(visits).toHaveLength(2);
    expect(visits.every(visit=>visit.ownerName==="Rep"&&visit.completedByName==="Owner")).toBe(true);
  });

  it("rejects forged visitors, another seller's place, archived leads and future completed visits", async () => {
    await org().collection("memberships").doc("rep").update({modules:[...member.modules,"prospecting"]});
    await org().collection("memberships").doc("other").set({...member,modules:[...member.modules,"prospecting"]});
    const data={requestId:"initial",action:"save",placeId:"private-place",name:"Private",location:"FL",position:{lat:26,lng:-80}};
    const saved=await api.saveProspectingVisit.run(request("rep",data));
    await expect(api.saveProspectingVisit.run(request("other",{...data,requestId:"steal",action:"plan"}))).rejects.toMatchObject({code:"permission-denied"});
    await expect(api.saveProspectingVisit.run(request("rep",{...data,completedByName:"Someone else"}))).rejects.toMatchObject({code:"invalid-argument"});
    await expect(api.saveProspectingVisit.run(request("rep",{...data,requestId:"future",action:"complete",at:new Date(Date.now()+86400000).toISOString()}))).rejects.toMatchObject({code:"invalid-argument"});
    await org().collection("leads").doc(saved.leadId).update({archived:true});
    await expect(api.saveProspectingVisit.run(request("rep",{...data,requestId:"archived",action:"plan"}))).rejects.toMatchObject({code:"failed-precondition"});
    expect((await org().collection("activities").get()).empty).toBe(true);
  });

  it("keeps a mapped place linked after a company rename and supports prospecting-only scopes", async () => {
    await org().collection("memberships").doc("rep").update({modules:["prospecting"]});
    const data={requestId:"save",action:"save",placeId:"stable-place",name:"Original",location:"FL",position:{lat:26,lng:-80}};
    const saved=await api.saveProspectingVisit.run(request("rep",data));
    await api.saveProspectingVisit.run(request("rep",{...data,requestId:"revisit",action:"plan",name:"Renamed"}));
    const leads=await api.loadCommercialPage.run(request("rep",{collection:"leads"}));
    expect(leads.records).toHaveLength(1);expect(leads.records[0].id).toBe(saved.leadId);
    expect((await api.loadCommercialPage.run(request("rep",{collection:"activities"}))).records).toHaveLength(1);
    await org().collection("memberships").doc("rep").update({status:"suspended"});
    await expect(api.saveProspectingVisit.run(request("rep",{...data,requestId:"blocked"}))).rejects.toMatchObject({code:"permission-denied"});
  });
});
