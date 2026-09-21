import { defineBoolean } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
export const crmCallableOptions = { region: "us-central1", memory: "256MiB" as const, timeoutSeconds: 60, maxInstances: 3, serviceAccount: "d2-crm-runtime@d2-map-crm.iam.gserviceaccount.com", enforceAppCheck: defineBoolean("CRM_ENFORCE_APPCHECK", { default: false }) };

// One bounded document per authenticated identity, never a new document per request.
export async function consumeRequestBudget(uid: string) {
  const ref = getFirestore().doc(`systemRateLimits/${createHash("sha256").update(uid).digest("hex")}`);
  const minute = Math.floor(Date.now()/60000);
  await getFirestore().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref), data = snapshot.data();
    const count = data?.minute === minute ? Number(data.count) : 0;
    if (count >= 360) throw new HttpsError("resource-exhausted", "Request limit reached. Retry in one minute.");
    tx.set(ref, { minute, count: count+1 });
  });
}
