import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, type Firestore, type Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import type { AuthGateway, AuthIdentity, MembershipRepository } from "../../application/session";
import type { Membership } from "../../domain/access";
import type { AuditAction, AuditEvent } from "../../domain/governance";
import type { FirebaseRuntimeConfig } from "./config";
import { membershipFromDocument } from "./membershipDocument";

const firebaseAppName = "d2-crm-v2";

export function identityFromFirebaseUser(user: Pick<User, "uid" | "email" | "displayName" | "photoURL">): AuthIdentity {
  if (!user.email) throw new Error("The authenticated identity has no email address");
  return {
    uid: user.uid,
    email: user.email.trim().toLowerCase(),
    displayName: user.displayName?.trim() || user.email,
    ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
  };
}

export class FirebaseAuthGateway implements AuthGateway {
  constructor(private readonly auth: Auth) {}

  observeIdentity(listener: (identity: AuthIdentity | null) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => listener(user ? identityFromFirebaseUser(user) : null));
  }

  async signInWithGoogle(): Promise<AuthIdentity> {
    await setPersistence(this.auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(this.auth, provider);
    return identityFromFirebaseUser(result.user);
  }

  signOut(): Promise<void> {
    return firebaseSignOut(this.auth);
  }
}

export class FirestoreMembershipRepository implements MembershipRepository {
  constructor(
    private readonly database: Firestore,
    private readonly functions: Functions,
    private readonly organizationId: string,
  ) {}

  async findByUid(uid: string): Promise<Membership | null> {
    const snapshot = await getDoc(doc(this.database, "organizations", this.organizationId, "memberships", uid));
    return snapshot.exists() ? membershipFromDocument(snapshot.id, snapshot.data()) : null;
  }

  async list(): Promise<Membership[]> {
    const snapshot = await getDocs(collection(this.database, "organizations", this.organizationId, "memberships"));
    return snapshot.docs.map((membership) => membershipFromDocument(membership.id, membership.data()));
  }

  async listAudit(): Promise<AuditEvent[]> {
    const auditQuery = query(
      collection(this.database, "organizations", this.organizationId, "auditEvents"),
      orderBy("occurredAt", "desc"),
      limit(100),
    );
    const snapshot = await getDocs(auditQuery);
    return snapshot.docs.map((entry) => {
      const data = entry.data();
      const occurredAt = data.occurredAt as Timestamp | undefined;
      return {
        id: entry.id,
        organizationId: this.organizationId,
        action: data.action as AuditAction,
        actorUid: String(data.actorUid ?? ""),
        actorEmail: String(data.actorEmail ?? ""),
        targetType: "membership",
        targetId: String(data.targetId ?? ""),
        summary: "admin.auditAccessUpdated",
        ...(typeof data.reason === "string" ? { reason: data.reason } : {}),
        occurredAt: occurredAt?.toDate().toISOString() ?? new Date(0).toISOString(),
      };
    });
  }

  async save(membership: Membership, reason: string): Promise<void> {
    const saveMembership = httpsCallable<
      {
        organizationId: string;
        targetUid: string;
        patch: Pick<Membership, "role" | "status" | "scope" | "modules">;
        reason: string;
      },
      { saved: true; auditEventId: string }
    >(this.functions, "saveMembership");
    await saveMembership({
      organizationId: this.organizationId,
      targetUid: membership.uid,
      patch: {
        role: membership.role,
        status: membership.status,
        scope: membership.scope,
        modules: membership.modules,
      },
      reason,
    });
  }
}

function initializeFirebaseApp(config: FirebaseRuntimeConfig): FirebaseApp {
  return getApps().some((app) => app.name === firebaseAppName)
    ? getApp(firebaseAppName)
    : initializeApp(config.client, firebaseAppName);
}

export function createFirebaseGateways(config: FirebaseRuntimeConfig): {
  auth: AuthGateway;
  memberships: MembershipRepository;
} {
  const app = initializeFirebaseApp(config);
  return {
    auth: new FirebaseAuthGateway(getAuth(app)),
    memberships: new FirestoreMembershipRepository(
      getFirestore(app),
      getFunctions(app, config.functionsRegion),
      config.organizationId,
    ),
  };
}
