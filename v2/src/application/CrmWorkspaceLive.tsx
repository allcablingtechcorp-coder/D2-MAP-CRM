import type { RecordChange, RecordCollection, RecordEvent, AssignmentOptions, ProspectVisitInput } from "./commercial";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoActivities, demoCompanies, demoContacts, demoLeads, demoOpportunities } from "../data/demo";
import type { Activity, Company, Contact, Lead, Opportunity, OpportunityStage } from "../domain/crm";
import { useRuntimeSession } from "./SessionRuntime";
import { workspaceStorageKey } from "./workspaceStorage";
import { useI18n } from "../i18n/i18n";
import { canPerformCommercialAction, type Membership, type Permission } from "../domain/access";
import { completeActivity as completeLocalActivity, createLead as createLocalLead, transitionOpportunity, type LeadCreationResult, type LeadInput, type OpportunityTransitionResult } from "../domain/workflows";
import type { CommercialRepository, CommercialWorkspaceSnapshot } from "./commercial";

interface CrmWorkspaceValue extends CommercialWorkspaceSnapshot {
  saveProspectingVisit: (input: ProspectVisitInput) => Promise<void>;
  loading: boolean;
  records: CommercialWorkspaceSnapshot;
  changeRecord: (input: RecordChange) => Promise<void>;
  assignmentOptions: () => Promise<AssignmentOptions>;
  history: (collection: RecordCollection, recordId: string) => Promise<RecordEvent[]>;
  refresh: () => Promise<void>;
  can: (permission: Permission) => boolean;
  createLead: (input: LeadInput) => Promise<LeadCreationResult>;
  advanceOpportunity: (id: string, to: OpportunityStage) => Promise<OpportunityTransitionResult | null>;
  completeActivity: (id: string) => Promise<void>;
  addActivity: (activity: Omit<Activity, "id" | "completed">) => Promise<Activity | null>;
  addOpportunity: (opportunity: Omit<Opportunity, "id" | "stage" | "currency">) => Promise<Opportunity | null>;
  addCompany: (company: Omit<Company, "id" | "ownerName" | "createdAt">) => Promise<Company | null>;
  addContact: (contact: Omit<Contact, "id" | "ownerName" | "createdAt" | "companyName">) => Promise<Contact | null>;
  resetDemo: () => void;
}

function visibleSnapshot(snapshot: CommercialWorkspaceSnapshot): CommercialWorkspaceSnapshot {
  const companies = new Map(snapshot.companies.map((item) => [item.id, item.name]));
  const active = <T extends { archived?: boolean; companyId?: string; companyName?: string }>(items: T[]) => items.filter((item) => !item.archived).map((item) => item.companyId && companies.has(item.companyId) ? { ...item, companyName: companies.get(item.companyId)! } : item);
  const activities = active(snapshot.activities);
  const leads = active(snapshot.leads).map((lead) => ({ ...lead, lastActivityAt: activities.filter((item) => item.companyId && item.companyId === lead.companyId && item.completed).reduce((latest, item) => item.completedAt && item.completedAt > latest ? item.completedAt : latest, lead.lastActivityAt) }));
  return { leads, activities, companies: active(snapshot.companies), contacts: active(snapshot.contacts), opportunities: active(snapshot.opportunities) };
}
const emptySnapshot = (): CommercialWorkspaceSnapshot => ({ leads: [], opportunities: [], activities: [], companies: [], contacts: [] });
const initialDemoSnapshot = (): CommercialWorkspaceSnapshot => ({ leads: demoLeads, opportunities: demoOpportunities, activities: demoActivities, companies: demoCompanies, contacts: demoContacts });

function linkDemo(snapshot: CommercialWorkspaceSnapshot): CommercialWorkspaceSnapshot {
  const link = <T extends { companyId?: string; companyName: string }>(items: T[]) => items.map((item) => { const matches = snapshot.companies.filter((company) => company.name === item.companyName); return item.companyId || matches.length !== 1 ? item : { ...item, companyId: matches[0].id }; });
  return { ...snapshot, leads: link(snapshot.leads), activities: link(snapshot.activities), opportunities: link(snapshot.opportunities) };
}
function loadDemoSnapshot(storageKey: string): CommercialWorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return linkDemo(initialDemoSnapshot());
    const parsed = JSON.parse(raw) as Partial<CommercialWorkspaceSnapshot>;
    if (!Array.isArray(parsed.leads) || !Array.isArray(parsed.opportunities) || !Array.isArray(parsed.activities)) return linkDemo(initialDemoSnapshot());
    return linkDemo({ leads: parsed.leads, opportunities: parsed.opportunities, activities: parsed.activities, companies: Array.isArray(parsed.companies) ? parsed.companies : demoCompanies, contacts: Array.isArray(parsed.contacts) ? parsed.contacts : demoContacts });
  } catch { return linkDemo(initialDemoSnapshot()); }
}

const CrmWorkspaceContext = createContext<CrmWorkspaceValue | null>(null);

export function CrmWorkspaceProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntimeSession();
  return runtime.mode === "firebase"
    ? <FirebaseWorkspace key={JSON.stringify(runtime.membership)} repository={runtime.commercial} membership={runtime.membership}>{children}</FirebaseWorkspace>
    : <DemoWorkspace storageKey={workspaceStorageKey()}>{children}</DemoWorkspace>;
}

function DemoWorkspace({ children, storageKey }: { children: ReactNode; storageKey: string }) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<CommercialWorkspaceSnapshot>(() => loadDemoSnapshot(storageKey));
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [snapshot, storageKey]);

  const value = useMemo<CrmWorkspaceValue>(() => ({
    ...visibleSnapshot(snapshot), records: snapshot, loading: false, can: () => true,
    refresh: async () => {},
    assignmentOptions: async () => ({ members: [{ uid: "demo", name: "Dante Frota", teamIds: [] }], teams: [], canAssign: true }),
    history: async () => [],
    saveProspectingVisit: async (input) => {
      setSnapshot(state => {
        const existing = state.leads.find(lead => lead.placeId === input.placeId || lead.id === input.leadId);
        const leadId = existing?.id ?? `map-${input.placeId}`, companyId = existing?.companyId ?? leadId;
        const now = new Date().toISOString(), at = input.at ?? now;
        const lead: Lead = { id:leadId, companyId, companyName:input.name, location:input.location, ownerName:"Dante Frota", qualification:"new", source:"map", priority:"medium", nextAction:"", nextActionAt:at, lastActivityAt:now, ...existing, placeId:input.placeId, position:input.position };
        const company: Company = {id:companyId,name:input.name,location:input.location,ownerName:lead.ownerName,industry:"",website:"",phone:"",createdAt:now};
        const activityId = input.activityId ?? input.requestId;
        const old = state.activities.find(a=>a.id===activityId);
        const activity: Activity = { id:activityId,companyId,companyName:input.name,ownerName:"Dante Frota",kind:"visit",subject:input.note || input.name,dueAt:at,...old,completed:input.action === "complete",...(input.action === "complete" ? {completedAt:at,completedByName:"Dante Frota"} : {}),visitNote:input.note ?? "" };
        return {...state,leads:[lead,...state.leads.filter(l=>l.id!==leadId)],companies:state.companies.some(c=>c.id===companyId)?state.companies:[company,...state.companies],activities:input.action === "save"?state.activities:[activity,...state.activities.filter(a=>a.id!==activityId)]};
      });
    },
    changeRecord: async (input) => {
      setSnapshot((state) => ({ ...state, [input.collection]: state[input.collection].map((item) => item.id !== input.recordId ? item : { ...item, ...(input.patch ?? {}), ...(input.action === "archive" ? { archived: true } : input.action === "restore" ? { archived: false } : input.action === "reopen" ? { stage: "discovery" } : input.action === "reassign" ? { ownerUid: input.ownerUid, teamId: input.teamId, ownerName: "Dante Frota" } : {}), revision: String(Date.now()) }) }));
    },
    createLead: async (input) => {
      const result = createLocalLead(input, snapshot.leads, new Date(), crypto.randomUUID());
      if (result.ok) {
        const existingCompany = snapshot.companies.find((company) => company.name === result.lead.companyName && company.location === result.lead.location);
        const company: Company = existingCompany ?? { id: "company-"+result.lead.id, name: result.lead.companyName, location: result.lead.location, ownerName: result.lead.ownerName, industry: "", phone: "", website: "", createdAt: new Date().toISOString() };
        result.lead.companyId = company.id;
        setSnapshot((current) => ({ ...current, leads: [result.lead, ...current.leads], companies: existingCompany ? current.companies : [company,...current.companies] }));
      }
      return result;
    },
    advanceOpportunity: async (id, to) => {
      const current = snapshot.opportunities.find((item) => item.id === id);
      if (!current) return null;
      const result = transitionOpportunity(current, to);
      if (result.ok) setSnapshot((state) => ({ ...state, opportunities: state.opportunities.map((item) => item.id === id ? result.opportunity : item) }));
      return result;
    },
    completeActivity: async (id) => setSnapshot((state) => ({ ...state, activities: state.activities.map((item) => item.id === id ? completeLocalActivity(item) : item) })),
    addActivity: async (input) => {
      const activity: Activity = { ...input, id: crypto.randomUUID(), completed: false };
      const occurredAt = new Date().toISOString();
      setSnapshot((state) => ({ ...state, activities: [activity, ...state.activities], leads: state.leads.map((lead) => lead.companyName === activity.companyName ? { ...lead, lastActivityAt: occurredAt } : lead) }));
      return activity;
    },
    addOpportunity: async (input) => {
      const opportunity: Opportunity = { ...input, id: crypto.randomUUID(), stage: "discovery", currency: "USD" };
      setSnapshot((state) => ({ ...state, opportunities: [opportunity, ...state.opportunities] }));
      return opportunity;
    },
    addCompany: async (input) => {
      const company: Company = { ...input, id: crypto.randomUUID(), ownerName: "Dante Frota", createdAt: new Date().toISOString() };
      setSnapshot((state) => ({ ...state, companies: [company, ...state.companies] }));
      return company;
    },
    addContact: async (input) => {
      const company = snapshot.companies.find((item) => item.id === input.companyId);
      if (!company) return null;
      const contact: Contact = { ...input, id: crypto.randomUUID(), companyName: company.name, ownerName: company.ownerName, createdAt: new Date().toISOString() };
      setSnapshot((state) => ({ ...state, contacts: [contact, ...state.contacts] }));
      return contact;
    },
    resetDemo: () => setSnapshot(linkDemo(initialDemoSnapshot())),
  }), [snapshot]);

  return <CrmWorkspaceContext.Provider value={value}>{storageError && <div className="governance-feedback error" role="alert">{t("workspace.storageError")}</div>}{children}</CrmWorkspaceContext.Provider>;
}

function FirebaseWorkspace({ children, repository, membership }: { children: ReactNode; repository: CommercialRepository; membership: Membership }) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<CommercialWorkspaceSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [remoteError, setRemoteError] = useState(false);
  const [loadFailure, setLoadFailure] = useState<"capacity" | "network" | null>(null);
  const [reload, setReload] = useState(0);
  const allowed = (permission: Permission) => canPerformCommercialAction(membership, permission);

  useEffect(() => {
    let active = true;
    setLoading(true); setRemoteError(false); setLoadFailure(null);
    repository.load().then((loaded) => { if (active) setSnapshot(loaded); }).catch((error: { code?: string }) => { if (active) setLoadFailure(error.code === "functions/resource-exhausted" ? "capacity" : "network"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, reload]);

  const value = useMemo<CrmWorkspaceValue>(() => ({
    ...visibleSnapshot(snapshot), records: snapshot, loading, can: allowed,
    saveProspectingVisit: async input => { await repository.saveProspectingVisit(input); setSnapshot(await repository.load()); },
    refresh: async () => { setSnapshot(await repository.load()); },
    assignmentOptions: () => repository.assignmentOptions(),
    history: (collection, recordId) => repository.history(collection, recordId),
    changeRecord: async (input) => { await repository.changeRecord(input); setSnapshot(await repository.load()); },
    createLead: async (input) => {
      if (!allowed("lead.create")) return { ok: false, reason: "permission_denied" };
      setRemoteError(false);
      try {
        const result = await repository.createLead(input);
        if (result.ok) {
          setSnapshot((state) => ({ ...state, leads: [result.lead, ...state.leads] }));
          try { setSnapshot(await repository.load()); } catch { setRemoteError(true); }
        }
        return result;
      } catch { setRemoteError(true); return { ok: false, reason: "server_error" }; }
    },
    advanceOpportunity: async (id, to) => {
      if (!allowed(to === "won" || to === "lost" ? "opportunity.close" : "opportunity.update")) return null;
      const current = snapshot.opportunities.find((item) => item.id === id);
      if (!current) return null;
      const validation = transitionOpportunity(current, to);
      if (!validation.ok) return validation;
      setRemoteError(false);
      try {
        const opportunity = await repository.transitionOpportunity(id, to);
        setSnapshot(await repository.load());
        return { ...validation, opportunity };
      } catch { setRemoteError(true); return null; }
    },
    completeActivity: async (id) => {
      if (!allowed("activity.create")) return;
      setRemoteError(false);
      try {
        await repository.completeActivity(id);
        setSnapshot(await repository.load());
      } catch { setRemoteError(true); }
    },
    addActivity: async (input) => {
      if (!allowed("activity.create")) return null;
      setRemoteError(false);
      try {
        const activity = await repository.createActivity(input);
        setSnapshot((state) => ({ ...state, activities: [activity, ...state.activities] }));
        return activity;
      } catch { setRemoteError(true); return null; }
    },
    addOpportunity: async (input) => {
      if (!allowed("opportunity.update")) return null;
      setRemoteError(false);
      try {
        const opportunity = await repository.createOpportunity(input);
        setSnapshot((state) => ({ ...state, opportunities: [opportunity, ...state.opportunities] }));
        return opportunity;
      } catch { setRemoteError(true); return null; }
    },
    addCompany: async (input) => {
      if (!allowed("lead.create")) return null;
      setRemoteError(false);
      try {
        const company = await repository.createCompany(input);
        setSnapshot((state) => ({ ...state, companies: [company, ...state.companies] }));
        return company;
      } catch { setRemoteError(true); return null; }
    },
    addContact: async (input) => {
      if (!allowed("lead.create")) return null;
      setRemoteError(false);
      try {
        const contact = await repository.createContact(input);
        setSnapshot((state) => ({ ...state, contacts: [contact, ...state.contacts] }));
        return contact;
      } catch { setRemoteError(true); return null; }
    },
    resetDemo: () => undefined,
  }), [snapshot, loading, membership, repository]);

  if (loadFailure) return <div className="governance-feedback error" role="alert"><p>{t(loadFailure === "capacity" ? "audit.capacityError" : "workspace.remoteError")}</p><button className="action-button secondary" onClick={() => setReload((value) => value + 1)}>{t("audit.retry")}</button></div>;
  if (loading) return <div className="workflow-feedback" role="status">{t("workspace.loading")}</div>;
  return <CrmWorkspaceContext.Provider value={value}>{loading && <div className="workflow-feedback" role="status">{t("workspace.loading")}</div>}{remoteError && <div className="governance-feedback error" role="alert">{t("workspace.remoteError")}</div>}{children}</CrmWorkspaceContext.Provider>;
}

export function useCrmWorkspace() {
  const context = useContext(CrmWorkspaceContext);
  if (!context) throw new Error("useCrmWorkspace must be used inside CrmWorkspaceProvider");
  return context;
}
