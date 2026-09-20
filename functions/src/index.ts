import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  InputValidationError,
  isProtectedOwner,
  membershipChanges,
  parseMembershipDocument,
  parseSaveMembershipInput,
  removesActiveOwner,
} from "./membershipPolicy.js";

initializeApp();

const database = getFirestore();

export const saveMembership = onCall({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 30,
  maxInstances: 3,
}, async (request) => {
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

    if (actor.role !== "owner" || actor.status !== "active") {
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
