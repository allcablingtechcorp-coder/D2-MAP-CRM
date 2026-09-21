import type { RecordChange, RecordCollection, RecordEvent, AssignmentOptions } from "../../application/commercial";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
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
import { collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, startAfter, type QueryDocumentSnapshot, type Firestore, type Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import type { AuthGateway, AuthIdentity, MembershipRepository } from "../../application/session";
import type { Membership } from "../../domain/access";
import type { AuditAction, AuditEvent, Invitation, InvitationInput, Team } from "../../domain/governance";
import type { Activity, Company, Contact, Lead, Opportunity, OpportunityStage } from "../../domain/crm";
import type { LeadInput } from "../../domain/workflows";
import type { CommercialRepository, CommercialWorkspaceSnapshot } from "../../application/commercial";
import type { FirebaseRuntimeConfig } from "./config";
import { membershipFromDocument } from "./membershipDocument";

const firebaseAppName = "d2-crm-v2";
const appCheckInitialized = new Set<string>();

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

  observeByUid(uid: string, listener: (membership: Membership | null) => void, onError: () => void): () => void {
    return onSnapshot(doc(this.database, "organizations", this.organizationId, "memberships", uid), { includeMetadataChanges: true }, (snapshot) => {
      // A cached active membership must not authorize an offline session.
      if (snapshot.metadata.fromCache) { onError(); return; }
      try { listener(snapshot.exists() ? membershipFromDocument(snapshot.id, snapshot.data()) : null); }
      catch { onError(); }
    }, onError);
  }

  async findByUid(uid: string): Promise<Membership | null> {
    const snapshot = await getDoc(doc(this.database, "organizations", this.organizationId, "memberships", uid));
    return snapshot.exists() ? membershipFromDocument(snapshot.id, snapshot.data()) : null;
  }

  async list(): Promise<Membership[]> {
    const snapshot = await getDocs(collection(this.database, "organizations", this.organizationId, "memberships"));
    return snapshot.docs.map((membership) => membershipFromDocument(membership.id, membership.data()));
  }

  async listAudit(): Promise<AuditEvent[]> {
    const entries: QueryDocumentSnapshot[] = [];
    let cursor: QueryDocumentSnapshot | undefined;
    do {
      const batch = await getDocs(query(collection(this.database, "organizations", this.organizationId, "auditEvents"), orderBy("occurredAt", "desc"), ...(cursor ? [startAfter(cursor)] : []), limit(100)));
      entries.push(...batch.docs); cursor = batch.size === 100 ? batch.docs.at(-1) : undefined;
    } while(cursor);
    const summaries: Partial<Record<AuditAction, string>> = {
      "membership.updated": "admin.auditAccessUpdated", "membership.suspended": "admin.auditAccessUpdated", "membership.revoked": "admin.auditAccessUpdated",
      "commercial.lead_created": "admin.auditLeadCreated", "commercial.activity_created": "admin.auditActivityCreated", "commercial.activity_completed": "admin.auditActivityCompleted",
      "commercial.opportunity_created": "admin.auditOpportunityCreated", "commercial.opportunity_stage_changed": "admin.auditOpportunityStageChanged",
      "commercial.company_created": "admin.auditCompanyCreated", "commercial.contact_created": "admin.auditContactCreated",
      "team.created": "admin.auditTeamCreated", "membership.invitation_accepted": "admin.auditInvitationAccepted",
      "membership.invited": "admin.auditInvitationCreated", "auth.signed_in": "admin.auditSignedIn", "auth.access_denied": "admin.auditAccessDenied",
    };
    return entries.map((entry) => {
      const data = entry.data();
      const occurredAt = data.occurredAt as Timestamp | undefined;
      const action = data.action as AuditAction;
      return {
        id: entry.id,
        organizationId: this.organizationId,
        action,
        actorUid: String(data.actorUid ?? ""),
        actorEmail: String(data.actorEmail ?? ""),
        targetType: String(data.targetType ?? "membership") as AuditEvent["targetType"],
        targetId: String(data.targetId ?? ""),
        summary: summaries[action] ?? (String(action).startsWith("commercial.") ? "admin.auditCommercialChanged" : "admin.auditAccessUpdated"),
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
        patch: Pick<Membership, "role" | "status" | "scope" | "modules" | "teamIds">;
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
        teamIds: membership.teamIds ?? [],
      },
      reason,
    });
  }

  async listGovernanceDirectory(): Promise<{ invitations: Invitation[]; teams: Team[] }> {
    const result: { invitations: Invitation[]; teams: Team[] } = { invitations: [], teams: [] };
    for (const collection of ["invitations", "teams"] as const) {
      let cursor: string | null = null;
      do {
        const data: { invitations: Invitation[]; teams: Team[]; nextCursor: string | null } = (await httpsCallable<unknown, { invitations: Invitation[]; teams: Team[]; nextCursor: string | null }>(this.functions, "listGovernanceDirectory")({ organizationId: this.organizationId, collection, cursor })).data;
        result.invitations.push(...data.invitations); result.teams.push(...data.teams); cursor = data.nextCursor;
      } while (cursor);
    }
    result.invitations.sort((a,b) => b.createdAt.localeCompare(a.createdAt)); result.teams.sort((a,b) => a.name.localeCompare(b.name));
    return result;
  }

  async createInvitation(input: InvitationInput & { teamIds: string[] }): Promise<Invitation> {
    const callable = httpsCallable<{ organizationId: string; email: string; role: InvitationInput["role"]; scope: InvitationInput["scope"]; modules: InvitationInput["modules"]; teamIds: string[] }, { invitation: Invitation }>(this.functions, "createGovernanceInvitation");
    return (await callable({ organizationId: this.organizationId, ...input })).data.invitation;
  }

  async createTeam(name: string): Promise<Team> {
    const callable = httpsCallable<{ organizationId: string; name: string }, { team: Team }>(this.functions, "createGovernanceTeam");
    return (await callable({ organizationId: this.organizationId, name })).data.team;
  }

  async acceptInvitation(): Promise<boolean> {
    const callable = httpsCallable<{ organizationId: string }, { accepted: boolean }>(this.functions, "acceptGovernanceInvitation");
    return (await callable({ organizationId: this.organizationId })).data.accepted;
  }

  async recordSessionEvent(event: "signed_in" | "access_denied"): Promise<void> {
    const callable = httpsCallable<{ organizationId: string; event: "signed_in" | "access_denied" }, { recorded: true }>(this.functions, "recordSessionEvent");
    await callable({ organizationId: this.organizationId, event });
  }
}

type CallableWorkspace = { leads: Lead[]; opportunities: Opportunity[]; activities: Activity[]; companies: Company[]; contacts: Contact[] };

export class FirebaseCommercialRepository implements CommercialRepository {
  constructor(private readonly functions: Functions, private readonly organizationId: string) {}

  async load(): Promise<CommercialWorkspaceSnapshot> {
    const snapshot: CommercialWorkspaceSnapshot = { leads: [], opportunities: [], activities: [], companies: [], contacts: [] };
    await Promise.all((Object.keys(snapshot) as RecordCollection[]).map(async (collection) => {
      const callable = httpsCallable<{ organizationId: string; collection: string; cursor: string | null }, { records: never[]; nextCursor: string | null }>(this.functions, "loadCommercialPage");
      let cursor: string | null = null;
      do {
        const page: { records: never[]; nextCursor: string | null } = (await callable({ organizationId: this.organizationId, collection, cursor })).data;
        snapshot[collection].push(...page.records); cursor = page.nextCursor;
      } while (cursor);
    }));
    const companyNames = new Map(snapshot.companies.map((company) => [company.id, company.name]));
    for (const record of [...snapshot.leads, ...snapshot.contacts, ...snapshot.activities, ...snapshot.opportunities]) if (record.companyId && companyNames.has(record.companyId)) record.companyName = companyNames.get(record.companyId)!;
    return snapshot;
  }
  async changeRecord(input: RecordChange) {
    await httpsCallable(this.functions, "changeCommercialRecord")({ organizationId: this.organizationId, ...input });
  }
  async assignmentOptions(): Promise<AssignmentOptions> {
    const result: AssignmentOptions = { members: [], teams: [], canAssign: false };
    let cursor: string | null = null;
    do {
      const data: AssignmentOptions & { nextCursor: string | null } = (await httpsCallable<unknown, AssignmentOptions & { nextCursor: string | null }>(this.functions, "listAssignmentOptions")({ organizationId: this.organizationId, cursor })).data;
      result.members.push(...data.members); result.teams = data.teams; result.canAssign = data.canAssign; cursor = data.nextCursor;
    } while (cursor);
    return result;
  }
  async history(collection: RecordCollection, recordId: string): Promise<RecordEvent[]> {
    const events: RecordEvent[] = []; let cursor: string | null = null;
    do {
      const data: { events: RecordEvent[]; nextCursor: string | null } = (await httpsCallable<unknown, { events: RecordEvent[]; nextCursor: string | null }>(this.functions, "commercialRecordHistory")({ organizationId: this.organizationId, collection, recordId, cursor })).data;
      events.push(...data.events); cursor = data.nextCursor;
    } while (cursor);
    return events.sort((a,b) => b.at.localeCompare(a.at));
  }
  async preferences(locale?: string) {
    return (await httpsCallable<unknown, { locale: string | null }>(this.functions, "userPreferences")({ organizationId: this.organizationId, ...(locale ? { locale } : {}) })).data;
  }

  async createLead(input: LeadInput) {
    const callable = httpsCallable<
      { organizationId: string; teamId?: string | null; companyName: string; location: string; source: Lead["source"]; priority: Lead["priority"]; nextAction: string; nextActionAt: string },
      { lead: Lead }
    >(this.functions, "createCommercialLead");
    try {
      const result = await callable({ organizationId: this.organizationId, ...(input.teamId !== undefined ? { teamId: input.teamId } : {}), companyName: input.companyName, location: input.location, source: input.source, priority: input.priority, nextAction: input.nextAction, nextActionAt: input.nextActionAt });
      return { ok: true as const, lead: result.data.lead };
    } catch (error) {
      if ((error as { code?: string }).code === "functions/already-exists") return { ok: false as const, reason: "duplicate" as const };
      throw error;
    }
  }

  async createActivity(input: Omit<Activity, "id" | "completed">): Promise<Activity> {
    const callable = httpsCallable<{ organizationId: string; teamId?: string | null; kind: Activity["kind"]; subject: string; companyName: string; companyId?: string; dueAt: string }, { activity: Activity }>(this.functions, "createCommercialActivity");
    return (await callable({ organizationId: this.organizationId, ...(input.teamId !== undefined ? { teamId: input.teamId } : {}), kind: input.kind, subject: input.subject, companyName: input.companyName, ...(input.companyId ? { companyId: input.companyId } : {}), dueAt: input.dueAt })).data.activity;
  }

  async createOpportunity(input: Omit<Opportunity, "id" | "stage" | "currency">): Promise<Opportunity> {
    const callable = httpsCallable<{ organizationId: string; teamId?: string | null; title: string; companyName: string; companyId?: string; amountCents: number | null; nextAction: string; expectedCloseAt: string }, { opportunity: Opportunity }>(this.functions, "createCommercialOpportunity");
    return (await callable({ organizationId: this.organizationId, ...(input.teamId !== undefined ? { teamId: input.teamId } : {}), title: input.title, companyName: input.companyName, ...(input.companyId ? { companyId: input.companyId } : {}), amountCents: input.amountCents, nextAction: input.nextAction, expectedCloseAt: input.expectedCloseAt })).data.opportunity;
  }

  async transitionOpportunity(id: string, stage: OpportunityStage): Promise<Opportunity> {
    const callable = httpsCallable<{ organizationId: string; recordId: string; stage: OpportunityStage }, { opportunity: Opportunity }>(this.functions, "transitionCommercialOpportunity");
    return (await callable({ organizationId: this.organizationId, recordId: id, stage })).data.opportunity;
  }

  async completeActivity(id: string): Promise<Activity> {
    const callable = httpsCallable<{ organizationId: string; recordId: string }, { activity: Activity }>(this.functions, "completeCommercialActivity");
    return (await callable({ organizationId: this.organizationId, recordId: id })).data.activity;
  }

  async createCompany(input: Omit<Company, "id" | "ownerName" | "createdAt">): Promise<Company> {
    const callable = httpsCallable<{ organizationId: string; name: string; location: string; industry: string; website: string; phone: string }, { company: Company }>(this.functions, "createCommercialCompany");
    return (await callable({ organizationId: this.organizationId, ...input })).data.company;
  }

  async createContact(input: Omit<Contact, "id" | "ownerName" | "createdAt" | "companyName">): Promise<Contact> {
    const callable = httpsCallable<{ organizationId: string; companyId: string; name: string; title: string; email: string; phone: string }, { contact: Contact }>(this.functions, "createCommercialContact");
    return (await callable({ organizationId: this.organizationId, ...input })).data.contact;
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
  commercial: CommercialRepository;
} {
  const app = initializeFirebaseApp(config);
  if (config.appCheckSiteKey && !appCheckInitialized.has(app.name)) {
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(config.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
    appCheckInitialized.add(app.name);
  }
  const functions = getFunctions(app, config.functionsRegion);
  return {
    auth: new FirebaseAuthGateway(getAuth(app)),
    memberships: new FirestoreMembershipRepository(
      getFirestore(app),
      functions,
      config.organizationId,
    ),
    commercial: new FirebaseCommercialRepository(functions, config.organizationId),
  };
}
