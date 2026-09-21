import { requireCommercialNamespace, requireGroupAccess } from "./companyWorkspaces.js";
import { crmCallableOptions, consumeRequestBudget } from "./requestProtection.js";
import { FieldPath, FieldValue, Timestamp, getFirestore, type DocumentData, type Transaction, type Query } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { parseMembershipDocument, type MembershipDocument } from "./membershipPolicy.js";
import { canAccessCommercialRecord, canUseCommercialPermission, type CommercialPermission } from "./commercialPolicy.js";
import { collection, exact, id, object, parseEditPatch, type RecordCollection } from "./lifecyclePolicy.js";
import { recordMetadata, serializeLead, serializeCompany, serializeContact, serializeActivity, serializeOpportunity, dateIso } from "./commercialSerialization.js";

const options = crmCallableOptions;
const serializers = { leads: serializeLead, companies: serializeCompany, contacts: serializeContact, activities: serializeActivity, opportunities: serializeOpportunity };
const readPermissions: Record<RecordCollection, CommercialPermission> = { leads: "lead.read", companies: "lead.read", contacts: "lead.read", activities: "activity.read", opportunities: "opportunity.read" };
const writePermissions: Record<RecordCollection, CommercialPermission> = { leads: "lead.update", companies: "lead.update", contacts: "lead.update", activities: "activity.create", opportunities: "opportunity.update" };
async function member(org: string, uid: string, tx?: Transaction) {
  await requireGroupAccess(org,uid,tx);
  const ref = getFirestore().doc(`organizations/${org}/memberships/${uid}`);
  const snap = await (tx ? tx.get(ref) : ref.get());
  if (!snap.exists) throw new HttpsError("permission-denied", "Active membership required");
  const result = parseMembershipDocument(snap.data());
  if (result.status !== "active" || result.scope === "custom") throw new HttpsError("permission-denied", "Active membership required");
  return result;
}
function allowed(actor: MembershipDocument, kind: RecordCollection, write = false) {
  return canUseCommercialPermission(actor, (write ? writePermissions : readPermissions)[kind])
    && (!["companies", "contacts"].includes(kind) || actor.modules.includes("companies"));
}
function access(actor: MembershipDocument, uid: string, data: DocumentData) {
  if (!canAccessCommercialRecord(actor, uid, { ownerUid: String(data.ownerUid ?? ""), teamId: typeof data.teamId === "string" ? data.teamId : null })) throw new HttpsError("permission-denied", "Record outside scope");
}
function canAssign(actor: MembershipDocument) {
  return ["owner", "operations_admin", "sales_manager"].includes(actor.role) && actor.permissionOverrides?.["lead.assign"] !== false;
}
function readQueries(base: Query, actor: MembershipDocument, uid: string) {
  if (actor.scope === "organization") return [base];
  if (actor.scope === "assigned_records") return [base.where("ownerUid", "==", uid)];
  const result: Query[] = [], teams = actor.teamIds ?? [];
  for (let offset = 0; offset < teams.length; offset += 10) result.push(base.where("teamId", "in", teams.slice(offset, offset + 10)));
  return result;
}

export const loadCommercialPage = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  const input = object(request.data); exact(input, ["organizationId", "collection", "cursor"]);
  const org = id(input.organizationId), kind = collection(input.collection), cursor = input.cursor ? id(input.cursor) : "";
  const actor = await member(org, request.auth.uid);
  if (!allowed(actor, kind)) return { records: [], nextCursor: null };
  const base: Query = getFirestore().collection(`organizations/${org}/${kind}`);
  const snapshots = await Promise.all(readQueries(base, actor, request.auth.uid).map((query) => {
    const ordered = query.orderBy(FieldPath.documentId());
    return (cursor ? ordered.startAfter(cursor) : ordered).limit(201).get();
  }));
  const sorted = [...new Map(snapshots.flatMap((snap) => snap.docs.map((doc) => [doc.id, doc] as const))).values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const page = sorted.slice(0, 200);
  // Recheck revocation after the page read, before returning any data.
  if (JSON.stringify(actor) !== JSON.stringify(await member(org, request.auth.uid))) throw new HttpsError("permission-denied", "Membership changed");
  return { records: page.map((doc) => serializers[kind]({ id: doc.id, data: doc.data() })), nextCursor: sorted.length > 200 ? page.at(-1)!.id : null };
});

export const changeCommercialRecord = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  const input = object(request.data); exact(input, ["organizationId", "collection", "recordId", "revision", "action", "patch", "reason", "ownerUid", "teamId"]);
  const org = id(input.organizationId), kind = collection(input.collection), recordId = id(input.recordId);
  if (typeof input.revision !== "string" || input.revision.length > 80) throw new HttpsError("invalid-argument", "Revision required");
  const action = String(input.action);
  if (!["edit", "archive", "restore", "reassign", "reopen"].includes(action)) throw new HttpsError("invalid-argument", "Invalid action");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) throw new HttpsError("invalid-argument", "Reason required (3–500 characters)");
  const patch = action === "edit" ? parseEditPatch(kind, input.patch) : {};
  if (action !== "edit" && input.patch !== undefined) throw new HttpsError("invalid-argument", "Patch not allowed for this action");
  if (action !== "reassign" && (input.ownerUid !== undefined || input.teamId !== undefined)) throw new HttpsError("invalid-argument", "Assignment not allowed for this action");
  const db = getFirestore(), reference = db.doc(`organizations/${org}/${kind}/${recordId}`);
  await db.runTransaction(async (tx) => {
    const actor = await member(org, request.auth!.uid, tx);
    if (!allowed(actor, kind, true)) throw new HttpsError("permission-denied", "Write permission required");
    const snapshot = await tx.get(reference);
    if (!snapshot.exists) throw new HttpsError("not-found", "Record not found");
    const before = snapshot.data()!; access(actor, request.auth!.uid, before);
    if (recordMetadata(before).revision !== input.revision) throw new HttpsError("aborted", "Record changed. Reload before saving.");
    if (before.archived === true && action !== "restore") throw new HttpsError("failed-precondition", "Restore the record first");
    if (action === "restore" && before.archived !== true) throw new HttpsError("failed-precondition", "Record is not archived");
    const changes: DocumentData = { ...patch };
    if (action === "archive" || action === "restore") {
      changes.archived = action === "archive";
      changes.archivedAt = action === "archive" ? FieldValue.serverTimestamp() : null;
    }
    if (action === "reopen") {
      if (kind !== "opportunities" || !["won", "lost"].includes(before.stage)) throw new HttpsError("failed-precondition", "Only closed opportunities can be reopened");
      if (!canUseCommercialPermission(actor, "opportunity.reopen")) throw new HttpsError("permission-denied", "Reopen permission required");
      changes.stage = "discovery";
    }
    if (action === "reassign") {
      if (!canAssign(actor)) throw new HttpsError("permission-denied", "Assignment permission required");
      const targetUid = id(input.ownerUid), teamId = input.teamId === null ? null : id(input.teamId);
      const target = await member(org, targetUid, tx);
      if (!allowed(target, kind)) throw new HttpsError("failed-precondition", "Recipient cannot read this module");
      if (teamId && !(await tx.get(db.doc(`organizations/${org}/teams/${teamId}`))).exists) throw new HttpsError("failed-precondition", "Team does not exist");
      const assignment = { ownerUid: targetUid, teamId };
      access(actor, request.auth!.uid, assignment); access(target, targetUid, assignment);
      if (teamId && target.scope !== "organization" && !(target.teamIds ?? []).includes(teamId)) throw new HttpsError("failed-precondition", "Recipient is not a team member");
      Object.assign(changes, assignment, { ownerName: target.displayName });
    }
    // Relationship changes must use an existing, accessible company, never a name match.
    const companyId = changes.companyId ?? before.companyId;
    if (kind !== "companies" && companyId && ["edit", "reassign", "restore"].includes(action)) {
      const company = await tx.get(db.doc(`organizations/${org}/companies/${id(companyId)}`));
      if (!company.exists || company.data()!.archived === true) throw new HttpsError("failed-precondition", "An active company is required");
      access(actor, request.auth!.uid, company.data()!);
      if (action === "reassign") {
        const target = await member(org, String(changes.ownerUid), tx);
        access(target, String(changes.ownerUid), company.data()!);
      }
      changes.companyName = String(company.data()!.name);
    }
    if (kind === "opportunities" && ["proposal", "negotiation", "won"].includes(before.stage) && "amountCents" in changes && !(Number(changes.amountCents) > 0)) throw new HttpsError("failed-precondition", "This stage requires an amount");
    if (kind === "activities" && before.completed && action === "edit") throw new HttpsError("failed-precondition", "Completed activities preserve their content; add a new note");
    for (const key of ["nextActionAt", "dueAt"]) if (typeof changes[key] === "string") changes[key] = Timestamp.fromDate(new Date(changes[key]));
    if (typeof changes.name === "string" && kind === "companies") changes.nameNormalized = changes.name.toLocaleLowerCase("en-US");
    const differences = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, { before: before[key] ?? null, after: value }]));
    tx.update(reference, { ...changes, updatedByUid: request.auth!.uid, updatedAt: FieldValue.serverTimestamp() });
    const event = { organizationId: org, action: `commercial.${kind}.${action}`, actorUid: request.auth!.uid, actorEmail: actor.email, targetType: kind, targetId: recordId, reason, changes: differences, occurredAt: FieldValue.serverTimestamp() };
    const audit = db.collection(`organizations/${org}/auditEvents`).doc();
    tx.create(audit, event); tx.create(reference.collection("history").doc(audit.id), event);
  });
  return { saved: true };
});

export const listAssignmentOptions = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  const input = object(request.data); exact(input, ["organizationId", "cursor"]);
  const org = id(input.organizationId), actor = await member(org, request.auth.uid), cursor = input.cursor ? id(input.cursor) : "";
  const db = getFirestore();
  let query: Query = db.collection(`organizations/${org}/memberships`).orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(cursor);
  const memberships = canAssign(actor) ? (await query.limit(201).get()).docs : [];
  const teams = actor.scope === "organization"
    ? (await db.collection(`organizations/${org}/teams`).orderBy(FieldPath.documentId()).get()).docs
    : await Promise.all((actor.teamIds ?? []).map((team) => db.doc(`organizations/${org}/teams/${team}`).get()));
  return {
    members: memberships.slice(0, 200).filter((doc) => { const data = doc.data(); return data.status === "active" && (actor.scope === "organization" || actor.scope === "assigned_records" && doc.id === request.auth!.uid || actor.scope === "assigned_teams" && (data.teamIds ?? []).some((team: string) => actor.teamIds?.includes(team))); }).map((doc) => ({ uid: doc.id, name: String(doc.data().displayName), teamIds: doc.data().teamIds ?? [] })),
    teams: teams.filter((doc) => doc.exists).map((doc) => ({ id: doc.id, name: String(doc.data()!.name) })),
    nextCursor: memberships.length > 200 ? memberships[199]!.id : null,
    canAssign: canAssign(actor),
  };
});

export const commercialRecordHistory = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  await consumeRequestBudget(request.auth.uid);
  requireCommercialNamespace(String(request.data?.organizationId));
  const input = object(request.data); exact(input, ["organizationId", "collection", "recordId", "cursor"]);
  const org = id(input.organizationId), kind = collection(input.collection), actor = await member(org, request.auth.uid);
  if (!allowed(actor, kind)) throw new HttpsError("permission-denied", "Read permission required");
  const ref = getFirestore().doc(`organizations/${org}/${kind}/${id(input.recordId)}`), snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Record not found");
  access(actor, request.auth.uid, snapshot.data()!);
  let query: Query = ref.collection("history").orderBy(FieldPath.documentId());
  if (input.cursor) query = query.startAfter(id(input.cursor));
  const rows = (await query.limit(101).get()).docs;
  return { events: rows.slice(0, 100).map((doc) => { const data = doc.data(); return { id: doc.id, action: data.action, actor: data.actorEmail, reason: data.reason ?? data.summary ?? "", at: dateIso(data.occurredAt) }; }), nextCursor: rows.length > 100 ? rows[99]!.id : null };
});

export const userPreferences = onCall(options, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  await consumeRequestBudget(request.auth.uid);
  console.info(JSON.stringify({ event: "crm_app_check", verified: !!request.app }));
  const input = object(request.data); exact(input, ["organizationId", "locale"]);
  const org = id(input.organizationId); await member(org, request.auth.uid);
  const ref = getFirestore().doc(`organizations/${org}/preferences/${request.auth.uid}`);
  if (input.locale !== undefined) {
    if (!["pt", "en", "es"].includes(String(input.locale))) throw new HttpsError("invalid-argument", "Invalid locale");
    await ref.set({ locale: input.locale, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return { locale: (await ref.get()).data()?.locale ?? null };
});
