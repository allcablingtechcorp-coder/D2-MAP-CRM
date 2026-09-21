import { requireCommercialNamespace, requireGroupAccess, companyIds, GROUP_ID } from "./companyWorkspaces.js";
import { deliverInvitation } from "./invitationLifecycle.js";
export { manageInvitation, requestEmailAccess } from "./invitationLifecycle.js";
import { object, exact, id as inputId } from "./lifecyclePolicy.js";
import { FieldPath } from "firebase-admin/firestore";
import { crmCallableOptions, consumeRequestBudget } from "./requestProtection.js";
import { dateIso, serializeLead, serializeCompany, serializeContact, serializeActivity, serializeOpportunity } from "./commercialSerialization.js";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore, type DocumentData, type Query, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import {
  InputValidationError,
  canManageMemberships,
  isProtectedOwner,
  membershipChanges,
  parseMembershipDocument,
  parseSaveMembershipInput,
  removesActiveOwner,
} from "./membershipPolicy.js";
import {
  canAccessCommercialRecord,
  canUseCommercialPermission,
  opportunityTransitions,
  parseCreateActivityInput,
  parseCreateCompanyInput,
  parseCreateContactInput,
  parseCreateLeadInput,
  parseCreateOpportunityInput,
  parseOrganizationInput,
  parseRecordCommandInput,
  parseTransitionOpportunityInput,
  type CommercialPermission,
} from "./commercialPolicy.js";
import { parseCreateInvitationCommand, parseCreateTeamCommand, parseOrganizationCommand, parseSessionCommand } from "./governancePolicy.js";

initializeApp();

const database = getFirestore();
const callableOptions = crmCallableOptions;

export const saveMembership = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  const authenticatedUser = request.auth;

  let input;
  try {
    input = parseSaveMembershipInput(request.data);
  } catch (error) {
    if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message);
    throw error;
  }

  const organization = database.collection("organizations").doc(input.organizationId);
  const actorReference = organization.collection("memberships").doc(authenticatedUser.uid);
  const targetReference = organization.collection("memberships").doc(input.targetUid);
  const auditReference = organization.collection("auditEvents").doc();

  await database.runTransaction(async (transaction) => {
    await requireGroupAccess(input.organizationId, authenticatedUser.uid, transaction);
    const [actorSnapshot, targetSnapshot, ...teamSnapshots] = await Promise.all([
      transaction.get(actorReference),
      transaction.get(targetReference),
      ...input.patch.teamIds.map((teamId) => transaction.get(organization.collection("teams").doc(teamId))),
    ]);
    if (!actorSnapshot.exists) throw new HttpsError("permission-denied", "Active owner membership is required");
    if (!targetSnapshot.exists) throw new HttpsError("not-found", "Target membership was not found");
    if (teamSnapshots.some((snapshot) => !snapshot.exists)) throw new HttpsError("failed-precondition", "An assigned team does not exist");

    let actor;
    let target;
    try {
      actor = parseMembershipDocument(actorSnapshot.data());
      target = parseMembershipDocument(targetSnapshot.data());
    } catch {
      throw new HttpsError("failed-precondition", "Membership data is invalid");
    }

    if (!canManageMemberships(actor)) {
      throw new HttpsError("permission-denied", "Active owner membership is required");
    }
    if (isProtectedOwner(target)) {
      throw new HttpsError("failed-precondition", "The protected owner cannot be changed");
    }
    if (input.patch.role === "owner" && target.role !== "owner") {
      throw new HttpsError("failed-precondition", "Owner assignment requires a separate controlled workflow");
    }

    if (removesActiveOwner(target, input.patch)) {
      const activeOwnersQuery = organization.collection("memberships")
        .where("role", "==", "owner")
        .where("status", "==", "active")
        .limit(2);
      const activeOwners = await transaction.get(activeOwnersQuery);
      if (activeOwners.size <= 1) throw new HttpsError("failed-precondition", "The last active owner cannot be removed");
    }

    const changes = membershipChanges(target, input.patch);
    if (Object.keys(changes).length === 0) throw new HttpsError("failed-precondition", "No membership changes were provided");

    transaction.update(targetReference, {
      role: input.patch.role,
      status: input.patch.status,
      scope: input.patch.scope,
      modules: input.patch.modules,
      teamIds: input.patch.teamIds,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: authenticatedUser.uid,
    });
    transaction.create(auditReference, {
      organizationId: input.organizationId,
      action: input.patch.status === "suspended" ? "membership.suspended" : input.patch.status === "revoked" ? "membership.revoked" : "membership.updated",
      actorUid: authenticatedUser.uid,
      actorEmail: actor.email,
      targetType: "membership",
      targetId: input.targetUid,
      reason: input.reason,
      changes,
      occurredAt: FieldValue.serverTimestamp(),
    });
  });

  return { saved: true as const, auditEventId: auditReference.id };
});

async function commercialActor(organizationId: string, uid: string, transaction?: Transaction) {
  await requireGroupAccess(organizationId, uid, transaction);
  const reference = database.doc(`organizations/${organizationId}/memberships/${uid}`);
  const snapshot = await (transaction ? transaction.get(reference) : reference.get());
  if (!snapshot.exists) throw new HttpsError("permission-denied", "Active membership is required");
  try { return parseMembershipDocument(snapshot.data()); }
  catch { throw new HttpsError("failed-precondition", "Membership data is invalid"); }
}

function requireCommercialPermission(actor: Awaited<ReturnType<typeof commercialActor>>, permission: CommercialPermission): void {
  if (!canUseCommercialPermission(actor, permission)) throw new HttpsError("permission-denied", "The requested commercial operation is not allowed");
}

async function revalidateActor(transaction: Transaction, organizationId: string, uid: string, actor: Awaited<ReturnType<typeof commercialActor>>) {
  const current = await commercialActor(organizationId, uid, transaction);
  if (current.status !== "active" || JSON.stringify(current) !== JSON.stringify(actor)) throw new HttpsError("permission-denied", "Membership changed; reload before retrying");
}

function recordAccess(data: DocumentData): { ownerUid: string; teamId: string | null } {
  return { ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : "", teamId: typeof data.teamId === "string" ? data.teamId : null };
}

function requireRecordAccess(actor: Awaited<ReturnType<typeof commercialActor>>, uid: string, data: DocumentData): void {
  if (!canAccessCommercialRecord(actor, uid, recordAccess(data))) throw new HttpsError("permission-denied", "This record is outside the assigned scope");
}

function defaultTeamId(actor: Awaited<ReturnType<typeof commercialActor>>, selected?: string | null): string | null {
  if (selected !== undefined) {
    if (actor.scope === "assigned_teams" && (!selected || !actor.teamIds?.includes(selected))) throw new HttpsError("permission-denied", "Select an assigned team");
    if (selected && actor.scope !== "organization" && !actor.teamIds?.includes(selected)) throw new HttpsError("permission-denied", "Select an assigned team");
    return selected;
  }
  if (actor.scope !== "assigned_teams") return null;
  const teamId = actor.teamIds?.[0];
  if (!teamId) throw new HttpsError("failed-precondition", "A team-scoped member must be assigned to a team");
  return teamId;
}

function auditDocument(organizationId: string, actorUid: string, actorEmail: string, action: string, targetType: string, targetId: string, summary: string) {
  return {
    reference: database.collection(`organizations/${organizationId}/auditEvents`).doc(),
    data: { organizationId, actorUid, actorEmail, action, targetType, targetId, summary, occurredAt: FieldValue.serverTimestamp() },
  };
}

function queryForScope(base: Query, actor: Awaited<ReturnType<typeof commercialActor>>, uid: string): Query[] {
  if (actor.scope === "organization") return [base.limit(501)];
  if (actor.scope === "assigned_records") return [base.where("ownerUid", "==", uid).limit(501)];
  if (actor.scope === "assigned_teams") {
    const teams = actor.teamIds ?? [];
    if (!teams.length) return [];
    const queries: Query[] = [];
    for (let offset = 0; offset < teams.length; offset += 10) queries.push(base.where("teamId", "in", teams.slice(offset, offset + 10)).limit(501));
    return queries;
  }
  return [];
}

async function scopedDocuments(organizationId: string, collectionName: string, actor: Awaited<ReturnType<typeof commercialActor>>, uid: string): Promise<Array<{ id: string; data: DocumentData }>> {
  const queries = queryForScope(database.collection(`organizations/${organizationId}/${collectionName}`), actor, uid);
  const snapshots = await Promise.all(queries.map((query) => query.get()));
  if (snapshots.some((snapshot) => snapshot.size > 500)) throw new HttpsError("resource-exhausted", "Workspace exceeds the current 500-record per-scope limit; narrow the assigned scope before generating reports");
  const documents = new Map<string, { id: string; data: DocumentData }>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => documents.set(document.id, { id: document.id, data: document.data() })));
  return [...documents.values()];
}

export const loadCommercialWorkspace = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  let input;
  try { input = parseOrganizationInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  const [leads, opportunities, activities, companies, contacts] = await Promise.all([
    canUseCommercialPermission(actor, "lead.read") ? scopedDocuments(input.organizationId, "leads", actor, request.auth.uid) : [],
    canUseCommercialPermission(actor, "opportunity.read") ? scopedDocuments(input.organizationId, "opportunities", actor, request.auth.uid) : [],
    canUseCommercialPermission(actor, "activity.read") ? scopedDocuments(input.organizationId, "activities", actor, request.auth.uid) : [],
    actor.modules.includes("companies") && canUseCommercialPermission(actor, "lead.read") ? scopedDocuments(input.organizationId, "companies", actor, request.auth.uid) : [],
    actor.modules.includes("companies") && canUseCommercialPermission(actor, "lead.read") ? scopedDocuments(input.organizationId, "contacts", actor, request.auth.uid) : [],
  ]);
  return {
    leads: leads.map(serializeLead).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    opportunities: opportunities.map(serializeOpportunity),
    activities: activities.map(serializeActivity).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    companies: companies.map(serializeCompany).sort((a, b) => a.name.localeCompare(b.name)),
    contacts: contacts.map(serializeContact).sort((a, b) => a.name.localeCompare(b.name)),
  };
});

export const createCommercialLead = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  let input;
  try { input = parseCreateLeadInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "lead.create");
  const normalized = `${input.companyName.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ")}\n${input.location.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ")}`;
  const id = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  const reference = database.doc(`organizations/${input.organizationId}/leads/${id}`);
  const companyReference = database.doc(`organizations/${input.organizationId}/companies/${id}`);
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "commercial.lead_created", "lead", id, "Lead created");
  const now = Timestamp.now();
  const data = { organizationId: input.organizationId, ownerUid: request.auth.uid, ownerName: actor.displayName, teamId: defaultTeamId(actor, input.teamId), companyId: id, companyName: input.companyName, companyNameNormalized: input.companyName.toLocaleLowerCase("en-US"), location: input.location, locationNormalized: input.location.toLocaleLowerCase("en-US"), qualification: "new", source: input.source, priority: input.priority, nextAction: input.nextAction, nextActionAt: Timestamp.fromDate(new Date(input.nextActionAt)), lastActivityAt: now, createdByUid: request.auth.uid, createdAt: now, updatedByUid: request.auth.uid, updatedAt: now };
  await database.runTransaction(async (transaction) => {
    await revalidateActor(transaction, input.organizationId, request.auth!.uid, actor);
    if (data.teamId && !(await transaction.get(database.doc(`organizations/${input.organizationId}/teams/${data.teamId}`))).exists) throw new HttpsError("failed-precondition", "Selected team does not exist");
    const [leadSnapshot, companySnapshot] = await Promise.all([transaction.get(reference), transaction.get(companyReference)]);
    if (leadSnapshot.exists) throw new HttpsError("already-exists", "A lead already exists for this company and location");
    if (companySnapshot.exists) { requireRecordAccess(actor, request.auth!.uid, companySnapshot.data()!); if (companySnapshot.data()!.archived) throw new HttpsError("failed-precondition", "Restore the company first"); }
    transaction.create(reference, data);
    if (!companySnapshot.exists) transaction.create(companyReference, { organizationId: input.organizationId, ownerUid: request.auth!.uid, ownerName: actor.displayName, teamId: defaultTeamId(actor, input.teamId), name: input.companyName, nameNormalized: input.companyName.toLocaleLowerCase("en-US"), location: input.location, industry: "", website: "", phone: "", createdByUid: request.auth!.uid, createdAt: now, updatedByUid: request.auth!.uid, updatedAt: now });
    transaction.create(audit.reference, audit.data);
    transaction.create(reference.collection("history").doc(audit.reference.id), audit.data);
  });
  return { lead: serializeLead({ id, data }) };
});

function canReadGovernance(actor: Awaited<ReturnType<typeof commercialActor>>): boolean {
  return actor.status === "active" && ["owner", "operations_admin"].includes(actor.role) && actor.modules.includes("admin")
    && actor.permissionOverrides?.["membership.read"] !== false && actor.permissionOverrides?.["audit.read"] !== false;
}

function serializeInvitation(id: string, data: DocumentData) {
  const missingCompanies = data.organizationId === GROUP_ID && (!Array.isArray(data.companyIds) || !data.companyIds.length);
  const status = data.status === "pending" && (!isLiveInvitation(data) || missingCompanies) ? "expired" : String(data.status ?? "expired");
  return { id, deliveryStatus:data.delivery?.status ?? "not_sent", deliveryAt:dateIso(data.delivery?.updatedAt), needsCompanySelection:missingCompanies, ...(data.companyIds ? {companyIds:data.companyIds} : {}), organizationId: String(data.organizationId ?? ""), email: String(data.email ?? ""), role: String(data.role ?? "viewer"), scope: String(data.scope ?? "assigned_records"), modules: Array.isArray(data.modules) ? data.modules : [], teamIds: Array.isArray(data.teamIds) ? data.teamIds : [], status, invitedByUid: String(data.invitedByUid ?? ""), createdAt: dateIso(data.createdAt), expiresAt: dateIso(data.expiresAt) };
}

function isLiveInvitation(data: DocumentData): boolean {
  return data.status === "pending" && !data.archivedAt && data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > Date.now();
}

function invitationLock(organizationId: string, email: string) {
  return database.doc(`organizations/${organizationId}/invitationLocks/${createHash("sha256").update(email).digest("hex")}`);
}

export const listGovernanceDirectory = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  let input;
  try { const data = object(request.data); exact(data, ["organizationId", "collection", "cursor"]); if (data.collection !== undefined && !["invitations", "teams"].includes(String(data.collection))) throw new HttpsError("invalid-argument", "Invalid collection"); input = { organizationId: inputId(data.organizationId), collection: data.collection, cursor: data.cursor ? inputId(data.cursor) : "" }; }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  if ((input.organizationId === GROUP_ID && actor.role !== "owner") || !canReadGovernance(actor)) throw new HttpsError("permission-denied", "Administrative read access is required");
  const pageQuery = (kind: string) => { const query = database.collection(`organizations/${input.organizationId}/${kind}`).orderBy(FieldPath.documentId()); return (input.cursor ? query.startAfter(input.cursor) : query).limit(201).get(); };
  const [invitationSnapshot, teamSnapshot, membershipSnapshot] = await Promise.all([
    input.collection === "teams" ? { docs: [] } : pageQuery("invitations"),
    input.collection === "invitations" ? { docs: [] } : pageQuery("teams"),
    database.collection(`organizations/${input.organizationId}/memberships`).get(),
  ]);
  return {
    nextCursor: input.collection && (input.collection === "teams" ? teamSnapshot : invitationSnapshot).docs.length > 200 ? (input.collection === "teams" ? teamSnapshot : invitationSnapshot).docs[199]!.id : null,
    invitations: invitationSnapshot.docs.slice(0,200).filter(document=>!document.data().archivedAt).map((document) => serializeInvitation(document.id, document.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    teams: teamSnapshot.docs.slice(0,200).map((document) => {
      const data = document.data();
      return { id: document.id, organizationId: input.organizationId, name: String(data.name ?? ""), memberUids: membershipSnapshot.docs.filter((membership) => Array.isArray(membership.data().teamIds) && membership.data().teamIds.includes(document.id)).map((membership) => membership.id), createdAt: dateIso(data.createdAt) };
    }).sort((a, b) => a.name.localeCompare(b.name)),
  };
});

export const createGovernanceTeam = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  let input;
  try { input = parseCreateTeamCommand(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  if (!canManageMemberships(actor)) throw new HttpsError("permission-denied", "Owner access is required");
  const id = createHash("sha256").update(input.name.toLocaleLowerCase("en-US").replace(/\s+/g, " ")).digest("hex").slice(0, 24);
  const reference = database.doc(`organizations/${input.organizationId}/teams/${id}`);
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "team.created", "team", id, "Team created");
  const now = Timestamp.now();
  await database.runTransaction(async (transaction) => {
    await revalidateActor(transaction, input.organizationId, request.auth!.uid, actor);
    if ((await transaction.get(reference)).exists) throw new HttpsError("already-exists", "This team already exists");
    transaction.create(reference, { organizationId: input.organizationId, name: input.name, createdByUid: request.auth!.uid, createdAt: now, updatedAt: now });
    transaction.create(audit.reference, audit.data);
  });
  return { team: { id, organizationId: input.organizationId, name: input.name, memberUids: [], createdAt: now.toDate().toISOString() } };
});

export const createGovernanceInvitation = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  let input;
  try { input = parseCreateInvitationCommand(request.data); if (["d2-smart-home","d2-hvac-solutions"].includes(input.organizationId)) throw new HttpsError("failed-precondition","Issue company invitations through D2 Group"); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  if (!canManageMemberships(actor)) throw new HttpsError("permission-denied", "Owner access is required");
  const organization = database.collection("organizations").doc(input.organizationId);
  const reference = organization.collection("invitations").doc();
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "membership.invited", "invitation", reference.id, "Access invitation created");
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000);
  await database.runTransaction(async (transaction) => {
    const currentActor = await commercialActor(input.organizationId, request.auth!.uid, transaction);
    if (!canManageMemberships(currentActor)) throw new HttpsError("permission-denied", "Owner access is required");
    const lock = invitationLock(input.organizationId, input.email);
    await transaction.get(lock);
    const [membershipMatches, invitationMatches, ...teamSnapshots] = await Promise.all([
      transaction.get(organization.collection("memberships").where("email", "==", input.email).limit(1)),
      transaction.get(organization.collection("invitations").where("email", "==", input.email)),
      ...input.teamIds.map((teamId) => transaction.get(organization.collection("teams").doc(teamId))),
    ]);
    if (!membershipMatches.empty || invitationMatches.docs.some((document) => isLiveInvitation(document.data()) && (input.organizationId !== GROUP_ID || Array.isArray(document.data().companyIds)))) throw new HttpsError("already-exists", "This email already has access or a pending invitation");
    if (teamSnapshots.some((snapshot) => !snapshot.exists)) throw new HttpsError("failed-precondition", "An assigned team does not exist");
    const selectedCompanies = input.organizationId === GROUP_ID ? companyIds(input.companyIds) : [];
    if(input.organizationId === GROUP_ID && (!selectedCompanies.length || input.scope === "assigned_teams")) throw new HttpsError("invalid-argument","Select companies; configure teams inside each company after acceptance");
    const data = { ...(selectedCompanies.length ? {companyIds:selectedCompanies} : {}), organizationId: input.organizationId, email: input.email, role: input.role, scope: input.scope, modules: input.modules, teamIds: input.teamIds, status: "pending", invitedByUid: request.auth!.uid, createdAt: now, expiresAt };
    for (const document of invitationMatches.docs) if (document.data().status === "pending") transaction.update(document.ref, { status: "expired", updatedAt: now });
    transaction.set(lock, { invitationId: reference.id, updatedAt: now });
    transaction.create(reference, data); transaction.create(audit.reference, audit.data);
  });
  if(input.organizationId===GROUP_ID)await deliverInvitation(reference.id,request.auth.uid);
  return { invitation: serializeInvitation(reference.id, (await reference.get()).data()!) };
});

export const acceptGovernanceInvitation = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  let input;
  try { input = parseOrganizationCommand(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const email = typeof request.auth.token.email === "string" ? request.auth.token.email.trim().toLowerCase() : "";
  if (!email || request.auth.token.email_verified !== true || !["google.com","password"].includes(String(request.auth.token.firebase?.sign_in_provider))) throw new HttpsError("failed-precondition", "A verified email identity is required");
  const organization = database.collection("organizations").doc(input.organizationId);
  const membershipReference = organization.collection("memberships").doc(request.auth.uid);
  let accepted = false;
  await database.runTransaction(async (transaction) => {
    const lock = invitationLock(input.organizationId, email);
    await transaction.get(lock);
    const invitationQuery = organization.collection("invitations").where("email", "==", email);
    const [membershipSnapshot, invitations, existingIdentity] = await Promise.all([transaction.get(membershipReference), transaction.get(invitationQuery), transaction.get(organization.collection("memberships").where("email", "==", email).limit(1))]);
    if (membershipSnapshot.exists) { accepted = membershipSnapshot.data()?.status === "active" && membershipSnapshot.data()?.email === email; return; }
    if (!existingIdentity.empty) throw new HttpsError("failed-precondition", "This email already belongs to another membership");
    const invitation = invitations.docs.find((document) => isLiveInvitation(document.data()));
    if (!invitation) return;
    const data = invitation.data();
    const validated = parseCreateInvitationCommand({ organizationId: input.organizationId, email, role: data.role, scope: data.scope, modules: data.modules, teamIds: data.teamIds ?? [] });
    const issuer = await commercialActor(input.organizationId, String(data.invitedByUid), transaction);
    if (!canManageMemberships(issuer)) throw new HttpsError("failed-precondition", "The invitation issuer no longer has authority");
    const teams = await Promise.all(validated.teamIds.map((teamId) => transaction.get(organization.collection("teams").doc(teamId))));
    if (teams.some((team) => !team.exists)) throw new HttpsError("failed-precondition", "An assigned team no longer exists");
    const displayName = typeof request.auth!.token.name === "string" && request.auth!.token.name.trim() ? request.auth!.token.name.trim() : email;
    const selectedCompanies = input.organizationId === GROUP_ID ? companyIds(data.companyIds) : [];
    const membershipData = { ...(selectedCompanies.length ? {companyIds:selectedCompanies} : {}), email, displayName, role: data.role, status: "active", scope: data.scope, modules: data.modules, teamIds: Array.isArray(data.teamIds) ? data.teamIds : [], ownerProtected: false, invitedByUid: data.invitedByUid, invitationId: invitation.id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    const companyRefs = selectedCompanies.map(org=>database.doc(`organizations/${org}/memberships/${request.auth!.uid}`));
    const existingCopies = await Promise.all(companyRefs.map(ref=>transaction.get(ref)));
    if(existingCopies.some(snap=>snap.exists)) throw new HttpsError("failed-precondition","Company membership already exists");
    transaction.create(membershipReference,membershipData);
    const {companyIds:_companyIds,...companyMembership}=membershipData;
    companyRefs.forEach(ref=>transaction.create(ref,companyMembership));
    transaction.update(invitation.ref, { status: "accepted", acceptedByUid: request.auth!.uid, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    transaction.set(lock, { invitationId: invitation.id, acceptedByUid: request.auth!.uid, updatedAt: FieldValue.serverTimestamp() });
    const audit = auditDocument(input.organizationId, request.auth!.uid, email, "membership.invitation_accepted", "membership", request.auth!.uid, "Access invitation accepted");
    transaction.create(audit.reference, audit.data); accepted = true;
  });
  return { accepted };
});

export const recordSessionEvent = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  let input;
  try { input = parseSessionCommand(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const email = typeof request.auth.token.email === "string" ? request.auth.token.email.trim().toLowerCase() : "unknown";
  const authenticationTime = request.auth.token.auth_time;
  if (typeof authenticationTime !== "number" || !Number.isFinite(authenticationTime)) throw new HttpsError("unauthenticated", "Authentication time is required");
  await database.runTransaction(async (transaction) => {
    const organization = database.doc(`organizations/${input.organizationId}`);
    const [organizationSnapshot, membership] = await Promise.all([transaction.get(organization), transaction.get(organization.collection("memberships").doc(request.auth!.uid))]);
    if (!organizationSnapshot.exists) throw new HttpsError("permission-denied", "Organization is not available");
    // The browser's event is only a trigger; the server determines the access outcome.
    const allowed = membership.exists && membership.data()?.status === "active" && membership.data()?.email === email;
    const event = allowed ? "signed_in" : "access_denied";
    const id = createHash("sha256").update(`${request.auth!.uid}:${event}:${authenticationTime}`).digest("hex").slice(0, 32);
    const reference = organization.collection("auditEvents").doc(id);
    if ((await transaction.get(reference)).exists) return;
    transaction.create(reference, { organizationId: input.organizationId, action: `auth.${event}`, actorUid: request.auth!.uid, actorEmail: email, targetType: "session", targetId: String(authenticationTime), summary: allowed ? "Session authenticated" : "Access denied", occurredAt: FieldValue.serverTimestamp() });
  });
  return { recorded: true };
});

export const createCommercialCompany = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  let input;
  try { input = parseCreateCompanyInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "lead.create");
  const normalized = `${input.name.toLocaleLowerCase("en-US").replace(/\s+/g, " ")}\n${input.location.toLocaleLowerCase("en-US").replace(/\s+/g, " ")}`;
  const id = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  const reference = database.doc(`organizations/${input.organizationId}/companies/${id}`);
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "commercial.company_created", "company", id, "Company created");
  const now = Timestamp.now();
  const data = { organizationId: input.organizationId, ownerUid: request.auth.uid, ownerName: actor.displayName, teamId: defaultTeamId(actor, input.teamId), name: input.name, nameNormalized: input.name.toLocaleLowerCase("en-US"), location: input.location, industry: input.industry, website: input.website, phone: input.phone, createdByUid: request.auth.uid, createdAt: now, updatedByUid: request.auth.uid, updatedAt: now };
  await database.runTransaction(async (transaction) => {
    await revalidateActor(transaction, input.organizationId, request.auth!.uid, actor);
    if (data.teamId && !(await transaction.get(database.doc(`organizations/${input.organizationId}/teams/${data.teamId}`))).exists) throw new HttpsError("failed-precondition", "Selected team does not exist");
    if ((await transaction.get(reference)).exists) throw new HttpsError("already-exists", "This company already exists");
    transaction.create(reference, data); transaction.create(audit.reference, audit.data);
    transaction.create(reference.collection("history").doc(audit.reference.id), audit.data);
  });
  return { company: serializeCompany({ id, data }) };
});

export const createCommercialContact = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  let input;
  try { input = parseCreateContactInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "lead.create");
  if (!actor.modules.includes("companies")) throw new HttpsError("permission-denied", "Companies access is required");
  const companyReference = database.doc(`organizations/${input.organizationId}/companies/${input.companyId}`);
  const companySnapshot = await companyReference.get();
  if (!companySnapshot.exists) throw new HttpsError("not-found", "Company was not found");
  const company = companySnapshot.data()!; requireRecordAccess(actor, request.auth.uid, company);
  if (company.archived) throw new HttpsError("failed-precondition", "Restore the company first");
  const reference = database.collection(`organizations/${input.organizationId}/contacts`).doc();
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "commercial.contact_created", "contact", reference.id, "Contact created");
  const now = Timestamp.now();
  const data = { organizationId: input.organizationId, ownerUid: String(company.ownerUid), ownerName: String(company.ownerName), teamId: typeof company.teamId === "string" ? company.teamId : null, companyId: input.companyId, companyName: String(company.name), name: input.name, title: input.title, email: input.email, phone: input.phone, createdByUid: request.auth.uid, createdAt: now, updatedByUid: request.auth.uid, updatedAt: now };
  await database.runTransaction(async (transaction) => {
    await revalidateActor(transaction, input.organizationId, request.auth!.uid, actor);
    const currentCompany = await transaction.get(companyReference);
    if (!currentCompany.exists || JSON.stringify(recordAccess(currentCompany.data()!)) !== JSON.stringify(recordAccess(company))) throw new HttpsError("failed-precondition", "Company assignment changed; reload before retrying");
    transaction.create(reference, data); transaction.create(audit.reference, audit.data);
    transaction.create(reference.collection("history").doc(audit.reference.id), audit.data);
  });
  return { contact: serializeContact({ id: reference.id, data }) };
});


async function linkedCompany(transaction: Transaction, organizationId: string, uid: string, actor: Awaited<ReturnType<typeof commercialActor>>, input: { companyId?: string; companyName: string }) {
  const base = database.collection(`organizations/${organizationId}/companies`);
  const matches = input.companyId ? [await transaction.get(base.doc(input.companyId))] : (await transaction.get(base.where("name", "==", input.companyName).limit(2))).docs;
  if (matches.length !== 1 || !matches[0]?.exists) throw new HttpsError("failed-precondition", "Select one existing company by ID");
  const company = matches[0]!;
  requireRecordAccess(actor, uid, company.data()!);
  if (company.data()!.archived === true) throw new HttpsError("failed-precondition", "Restore the company first");
  return { companyId: company.id, companyName: String(company.data()!.name) };
}

export const createCommercialActivity = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  let input;
  try { input = parseCreateActivityInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "activity.create");
  const reference = database.collection(`organizations/${input.organizationId}/activities`).doc();
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "commercial.activity_created", "activity", reference.id, "Activity created");
  const now = Timestamp.now();
  const data = { organizationId: input.organizationId, ownerUid: request.auth.uid, ownerName: actor.displayName, teamId: defaultTeamId(actor, input.teamId), kind: input.kind, subject: input.subject, companyName: input.companyName, dueAt: Timestamp.fromDate(new Date(input.dueAt)), completed: false, createdByUid: request.auth.uid, createdAt: now, updatedByUid: request.auth.uid, updatedAt: now };
  await database.runTransaction(async (transaction) => {
    await revalidateActor(transaction, input.organizationId, request.auth!.uid, actor);
    if (data.teamId && !(await transaction.get(database.doc(`organizations/${input.organizationId}/teams/${data.teamId}`))).exists) throw new HttpsError("failed-precondition", "Selected team does not exist");
    Object.assign(data, await linkedCompany(transaction, input.organizationId, request.auth!.uid, actor, input));
    transaction.create(reference, data); transaction.create(audit.reference, audit.data);
    transaction.create(reference.collection("history").doc(audit.reference.id), audit.data);
  });
  return { activity: serializeActivity({ id: reference.id, data }) };
});

export const createCommercialOpportunity = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  let input;
  try { input = parseCreateOpportunityInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "opportunity.update");
  const reference = database.collection(`organizations/${input.organizationId}/opportunities`).doc();
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "commercial.opportunity_created", "opportunity", reference.id, "Opportunity created");
  const now = Timestamp.now();
  const data = { organizationId: input.organizationId, ownerUid: request.auth.uid, ownerName: actor.displayName, teamId: defaultTeamId(actor, input.teamId), title: input.title, companyName: input.companyName, stage: "discovery", amountCents: input.amountCents, currency: "USD", nextAction: input.nextAction, expectedCloseAt: input.expectedCloseAt, createdByUid: request.auth.uid, createdAt: now, updatedByUid: request.auth.uid, updatedAt: now };
  await database.runTransaction(async (transaction) => {
    await revalidateActor(transaction, input.organizationId, request.auth!.uid, actor);
    if (data.teamId && !(await transaction.get(database.doc(`organizations/${input.organizationId}/teams/${data.teamId}`))).exists) throw new HttpsError("failed-precondition", "Selected team does not exist");
    Object.assign(data, await linkedCompany(transaction, input.organizationId, request.auth!.uid, actor, input));
    transaction.create(reference, data); transaction.create(audit.reference, audit.data);
    transaction.create(reference.collection("history").doc(audit.reference.id), audit.data);
  });
  return { opportunity: serializeOpportunity({ id: reference.id, data }) };
});

export const transitionCommercialOpportunity = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  let input;
  try { input = parseTransitionOpportunityInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, input.stage === "won" || input.stage === "lost" ? "opportunity.close" : "opportunity.update");
  const reference = database.doc(`organizations/${input.organizationId}/opportunities/${input.recordId}`);
  let result: ReturnType<typeof serializeOpportunity> | undefined;
  await database.runTransaction(async (transaction) => {
    await revalidateActor(transaction, input.organizationId, request.auth!.uid, actor);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new HttpsError("not-found", "Opportunity was not found");
    const data = snapshot.data()!; requireRecordAccess(actor, request.auth!.uid, data);
    if (data.archived === true) throw new HttpsError("failed-precondition", "Restore the record first");
    if (["won", "lost"].includes(String(data.stage))) { requireCommercialPermission(actor, "opportunity.reopen"); throw new HttpsError("failed-precondition", "Use the audited reopen operation with a reason"); }
    const currentStage = String(data.stage) as keyof typeof opportunityTransitions;
    if (!opportunityTransitions[currentStage]?.includes(input.stage)) throw new HttpsError("failed-precondition", "The opportunity transition is not allowed");
    if (["proposal", "negotiation", "won"].includes(input.stage) && (!(typeof data.amountCents === "number") || data.amountCents <= 0)) throw new HttpsError("failed-precondition", "An amount is required for this stage");
    transaction.update(reference, { stage: input.stage, updatedByUid: request.auth!.uid, updatedAt: FieldValue.serverTimestamp() });
    const audit = auditDocument(input.organizationId, request.auth!.uid, actor.email, "commercial.opportunity_stage_changed", "opportunity", input.recordId, `${currentStage} -> ${input.stage}`);
    transaction.create(audit.reference, audit.data);
    transaction.create(reference.collection("history").doc(audit.reference.id), audit.data);
    result = serializeOpportunity({ id: snapshot.id, data: { ...data, stage: input.stage } });
  });
  return { opportunity: result };
});

export const completeCommercialActivity = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  let input;
  try { input = parseRecordCommandInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "activity.create");
  const reference = database.doc(`organizations/${input.organizationId}/activities/${input.recordId}`);
  let result: ReturnType<typeof serializeActivity> | undefined;
  await database.runTransaction(async (transaction) => {
    await revalidateActor(transaction, input.organizationId, request.auth!.uid, actor);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new HttpsError("not-found", "Activity was not found");
    const data = snapshot.data()!; requireRecordAccess(actor, request.auth!.uid, data);
    if (data.archived === true) throw new HttpsError("failed-precondition", "Restore the record first");
    if (data.completed === true) { result = serializeActivity({ id: snapshot.id, data }); return; }
    transaction.update(reference, { completed: true, completedAt: FieldValue.serverTimestamp(), completedByUid: request.auth!.uid, completedByName: actor.displayName, updatedByUid: request.auth!.uid, updatedAt: FieldValue.serverTimestamp() });
    const audit = auditDocument(input.organizationId, request.auth!.uid, actor.email, "commercial.activity_completed", "activity", input.recordId, "Activity completed");
    transaction.create(audit.reference, audit.data);
    transaction.create(reference.collection("history").doc(audit.reference.id), audit.data);
    result = serializeActivity({ id: snapshot.id, data: { ...data, completed: true } });
  });
  return { activity: result };
});

export { loadCommercialPage, changeCommercialRecord, listAssignmentOptions, commercialRecordHistory, userPreferences } from "./commercialLifecycle.js";

export { saveProspectingVisit } from "./prospectingVisits.js";

export { companyAccess } from "./companyWorkspaces.js";
