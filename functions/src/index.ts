import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore, type DocumentData, type Query } from "firebase-admin/firestore";
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
  parseCreateLeadInput,
  parseCreateOpportunityInput,
  parseOrganizationInput,
  parseRecordCommandInput,
  parseTransitionOpportunityInput,
  type CommercialPermission,
} from "./commercialPolicy.js";

initializeApp();

const database = getFirestore();
const callableOptions = { region: "us-central1", memory: "256MiB" as const, timeoutSeconds: 30, maxInstances: 3 };

export const saveMembership = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
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
    const [actorSnapshot, targetSnapshot] = await Promise.all([
      transaction.get(actorReference),
      transaction.get(targetReference),
    ]);
    if (!actorSnapshot.exists) throw new HttpsError("permission-denied", "Active owner membership is required");
    if (!targetSnapshot.exists) throw new HttpsError("not-found", "Target membership was not found");

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

async function commercialActor(organizationId: string, uid: string) {
  const snapshot = await database.doc(`organizations/${organizationId}/memberships/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError("permission-denied", "Active membership is required");
  try { return parseMembershipDocument(snapshot.data()); }
  catch { throw new HttpsError("failed-precondition", "Membership data is invalid"); }
}

function requireCommercialPermission(actor: Awaited<ReturnType<typeof commercialActor>>, permission: CommercialPermission): void {
  if (!canUseCommercialPermission(actor, permission)) throw new HttpsError("permission-denied", "The requested commercial operation is not allowed");
}

function recordAccess(data: DocumentData): { ownerUid: string; teamId: string | null } {
  return { ownerUid: typeof data.ownerUid === "string" ? data.ownerUid : "", teamId: typeof data.teamId === "string" ? data.teamId : null };
}

function requireRecordAccess(actor: Awaited<ReturnType<typeof commercialActor>>, uid: string, data: DocumentData): void {
  if (!canAccessCommercialRecord(actor, uid, recordAccess(data))) throw new HttpsError("permission-denied", "This record is outside the assigned scope");
}

function auditDocument(organizationId: string, actorUid: string, actorEmail: string, action: string, targetType: string, targetId: string, summary: string) {
  return {
    reference: database.collection(`organizations/${organizationId}/auditEvents`).doc(),
    data: { organizationId, actorUid, actorEmail, action, targetType, targetId, summary, occurredAt: FieldValue.serverTimestamp() },
  };
}

function queryForScope(base: Query, actor: Awaited<ReturnType<typeof commercialActor>>, uid: string): Query[] {
  if (actor.scope === "organization") return [base.limit(500)];
  if (actor.scope === "assigned_records") return [base.where("ownerUid", "==", uid).limit(500)];
  if (actor.scope === "assigned_teams") {
    const teams = actor.teamIds ?? [];
    if (!teams.length) return [];
    const queries: Query[] = [];
    for (let offset = 0; offset < teams.length; offset += 10) queries.push(base.where("teamId", "in", teams.slice(offset, offset + 10)).limit(500));
    return queries;
  }
  return [];
}

async function scopedDocuments(organizationId: string, collectionName: string, actor: Awaited<ReturnType<typeof commercialActor>>, uid: string): Promise<Array<{ id: string; data: DocumentData }>> {
  const queries = queryForScope(database.collection(`organizations/${organizationId}/${collectionName}`), actor, uid);
  const snapshots = await Promise.all(queries.map((query) => query.get()));
  const documents = new Map<string, { id: string; data: DocumentData }>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => documents.set(document.id, { id: document.id, data: document.data() })));
  return [...documents.values()];
}

function dateIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return new Date(0).toISOString();
}

function serializeLead(document: { id: string; data: DocumentData }) {
  const data = document.data;
  return { id: document.id, companyName: String(data.companyName ?? ""), location: String(data.location ?? ""), ownerName: String(data.ownerName ?? ""), qualification: String(data.qualification ?? "new"), source: String(data.source ?? "manual"), priority: String(data.priority ?? "medium"), nextAction: String(data.nextAction ?? ""), nextActionAt: dateIso(data.nextActionAt), lastActivityAt: dateIso(data.lastActivityAt) };
}

function serializeOpportunity(document: { id: string; data: DocumentData }) {
  const data = document.data;
  return { id: document.id, title: String(data.title ?? ""), companyName: String(data.companyName ?? ""), ownerName: String(data.ownerName ?? ""), stage: String(data.stage ?? "discovery"), amountCents: typeof data.amountCents === "number" ? data.amountCents : null, currency: "USD", nextAction: String(data.nextAction ?? ""), expectedCloseAt: String(data.expectedCloseAt ?? "") };
}

function serializeActivity(document: { id: string; data: DocumentData }) {
  const data = document.data;
  return { id: document.id, kind: String(data.kind ?? "note"), subject: String(data.subject ?? ""), companyName: String(data.companyName ?? ""), ownerName: String(data.ownerName ?? ""), dueAt: dateIso(data.dueAt), completed: data.completed === true };
}

export const loadCommercialWorkspace = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  let input;
  try { input = parseOrganizationInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  const [leads, opportunities, activities] = await Promise.all([
    canUseCommercialPermission(actor, "lead.read") ? scopedDocuments(input.organizationId, "leads", actor, request.auth.uid) : [],
    canUseCommercialPermission(actor, "opportunity.read") ? scopedDocuments(input.organizationId, "opportunities", actor, request.auth.uid) : [],
    canUseCommercialPermission(actor, "activity.read") ? scopedDocuments(input.organizationId, "activities", actor, request.auth.uid) : [],
  ]);
  return {
    leads: leads.map(serializeLead).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    opportunities: opportunities.map(serializeOpportunity),
    activities: activities.map(serializeActivity).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
  };
});

export const createCommercialLead = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  let input;
  try { input = parseCreateLeadInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "lead.create");
  const normalized = `${input.companyName.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ")}\n${input.location.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ")}`;
  const id = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  const reference = database.doc(`organizations/${input.organizationId}/leads/${id}`);
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "commercial.lead_created", "lead", id, "Lead created");
  const now = Timestamp.now();
  const data = { organizationId: input.organizationId, ownerUid: request.auth.uid, ownerName: actor.displayName, teamId: null, companyName: input.companyName, companyNameNormalized: input.companyName.toLocaleLowerCase("en-US"), location: input.location, locationNormalized: input.location.toLocaleLowerCase("en-US"), qualification: "new", source: input.source, priority: input.priority, nextAction: input.nextAction, nextActionAt: Timestamp.fromDate(new Date(input.nextActionAt)), lastActivityAt: now, createdByUid: request.auth.uid, createdAt: now, updatedByUid: request.auth.uid, updatedAt: now };
  await database.runTransaction(async (transaction) => {
    if ((await transaction.get(reference)).exists) throw new HttpsError("already-exists", "A lead already exists for this company and location");
    transaction.create(reference, data);
    transaction.create(audit.reference, audit.data);
  });
  return { lead: serializeLead({ id, data }) };
});

export const createCommercialActivity = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  let input;
  try { input = parseCreateActivityInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "activity.create");
  const reference = database.collection(`organizations/${input.organizationId}/activities`).doc();
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "commercial.activity_created", "activity", reference.id, "Activity created");
  const now = Timestamp.now();
  const data = { organizationId: input.organizationId, ownerUid: request.auth.uid, ownerName: actor.displayName, teamId: null, kind: input.kind, subject: input.subject, companyName: input.companyName, dueAt: Timestamp.fromDate(new Date(input.dueAt)), completed: false, createdByUid: request.auth.uid, createdAt: now, updatedByUid: request.auth.uid, updatedAt: now };
  const batch = database.batch(); batch.create(reference, data); batch.create(audit.reference, audit.data); await batch.commit();
  return { activity: serializeActivity({ id: reference.id, data }) };
});

export const createCommercialOpportunity = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  let input;
  try { input = parseCreateOpportunityInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "opportunity.update");
  const reference = database.collection(`organizations/${input.organizationId}/opportunities`).doc();
  const audit = auditDocument(input.organizationId, request.auth.uid, actor.email, "commercial.opportunity_created", "opportunity", reference.id, "Opportunity created");
  const now = Timestamp.now();
  const data = { organizationId: input.organizationId, ownerUid: request.auth.uid, ownerName: actor.displayName, teamId: null, title: input.title, companyName: input.companyName, stage: "discovery", amountCents: input.amountCents, currency: "USD", nextAction: input.nextAction, expectedCloseAt: input.expectedCloseAt, createdByUid: request.auth.uid, createdAt: now, updatedByUid: request.auth.uid, updatedAt: now };
  const batch = database.batch(); batch.create(reference, data); batch.create(audit.reference, audit.data); await batch.commit();
  return { opportunity: serializeOpportunity({ id: reference.id, data }) };
});

export const transitionCommercialOpportunity = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  let input;
  try { input = parseTransitionOpportunityInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, input.stage === "won" || input.stage === "lost" ? "opportunity.close" : "opportunity.update");
  const reference = database.doc(`organizations/${input.organizationId}/opportunities/${input.recordId}`);
  let result: ReturnType<typeof serializeOpportunity> | undefined;
  await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new HttpsError("not-found", "Opportunity was not found");
    const data = snapshot.data()!; requireRecordAccess(actor, request.auth!.uid, data);
    const currentStage = String(data.stage) as keyof typeof opportunityTransitions;
    if (!opportunityTransitions[currentStage]?.includes(input.stage)) throw new HttpsError("failed-precondition", "The opportunity transition is not allowed");
    if (["proposal", "negotiation", "won"].includes(input.stage) && (!(typeof data.amountCents === "number") || data.amountCents <= 0)) throw new HttpsError("failed-precondition", "An amount is required for this stage");
    transaction.update(reference, { stage: input.stage, updatedByUid: request.auth!.uid, updatedAt: FieldValue.serverTimestamp() });
    const audit = auditDocument(input.organizationId, request.auth!.uid, actor.email, "commercial.opportunity_stage_changed", "opportunity", input.recordId, `${currentStage} -> ${input.stage}`);
    transaction.create(audit.reference, audit.data);
    result = serializeOpportunity({ id: snapshot.id, data: { ...data, stage: input.stage } });
  });
  return { opportunity: result };
});

export const completeCommercialActivity = onCall(callableOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication is required");
  let input;
  try { input = parseRecordCommandInput(request.data); }
  catch (error) { if (error instanceof InputValidationError) throw new HttpsError("invalid-argument", error.message); throw error; }
  const actor = await commercialActor(input.organizationId, request.auth.uid);
  requireCommercialPermission(actor, "activity.create");
  const reference = database.doc(`organizations/${input.organizationId}/activities/${input.recordId}`);
  let result: ReturnType<typeof serializeActivity> | undefined;
  await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new HttpsError("not-found", "Activity was not found");
    const data = snapshot.data()!; requireRecordAccess(actor, request.auth!.uid, data);
    transaction.update(reference, { completed: true, completedAt: FieldValue.serverTimestamp(), updatedByUid: request.auth!.uid, updatedAt: FieldValue.serverTimestamp() });
    const audit = auditDocument(input.organizationId, request.auth!.uid, actor.email, "commercial.activity_completed", "activity", input.recordId, "Activity completed");
    transaction.create(audit.reference, audit.data);
    result = serializeActivity({ id: snapshot.id, data: { ...data, completed: true } });
  });
  return { activity: result };
});
