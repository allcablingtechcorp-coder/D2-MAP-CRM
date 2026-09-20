import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoActivities, demoLeads, demoOpportunities } from "../data/demo";
import type { Activity, Lead, Opportunity, OpportunityStage } from "../domain/crm";
import { useRuntimeSession } from "./SessionRuntime";
import { workspaceStorageKey } from "./workspaceStorage";
import { useI18n } from "../i18n/i18n";
import { canPerformCommercialAction, type Membership, type Permission } from "../domain/access";
import { completeActivity as completeLocalActivity, createLead as createLocalLead, transitionOpportunity, type LeadCreationResult, type LeadInput, type OpportunityTransitionResult } from "../domain/workflows";
import type { CommercialRepository, CommercialWorkspaceSnapshot } from "./commercial";

interface CrmWorkspaceValue extends CommercialWorkspaceSnapshot {
  loading: boolean;
  can: (permission: Permission) => boolean;
  createLead: (input: LeadInput) => Promise<LeadCreationResult>;
  advanceOpportunity: (id: string, to: OpportunityStage) => Promise<OpportunityTransitionResult | null>;
  completeActivity: (id: string) => Promise<void>;
  addActivity: (activity: Omit<Activity, "id" | "completed">) => Promise<Activity | null>;
  addOpportunity: (opportunity: Omit<Opportunity, "id" | "stage" | "currency">) => Promise<Opportunity | null>;
  resetDemo: () => void;
}

const emptySnapshot = (): CommercialWorkspaceSnapshot => ({ leads: [], opportunities: [], activities: [] });
const initialDemoSnapshot = (): CommercialWorkspaceSnapshot => ({ leads: demoLeads, opportunities: demoOpportunities, activities: demoActivities });

function loadDemoSnapshot(storageKey: string): CommercialWorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialDemoSnapshot();
    const parsed = JSON.parse(raw) as Partial<CommercialWorkspaceSnapshot>;
    if (!Array.isArray(parsed.leads) || !Array.isArray(parsed.opportunities) || !Array.isArray(parsed.activities)) return initialDemoSnapshot();
    return { leads: parsed.leads, opportunities: parsed.opportunities, activities: parsed.activities };
  } catch { return initialDemoSnapshot(); }
}

const CrmWorkspaceContext = createContext<CrmWorkspaceValue | null>(null);

export function CrmWorkspaceProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntimeSession();
  return runtime.mode === "firebase"
    ? <FirebaseWorkspace repository={runtime.commercial} membership={runtime.membership}>{children}</FirebaseWorkspace>
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
    ...snapshot, loading: false, can: () => true,
    createLead: async (input) => {
      const result = createLocalLead(input, snapshot.leads, new Date(), crypto.randomUUID());
      if (result.ok) setSnapshot((current) => ({ ...current, leads: [result.lead, ...current.leads] }));
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
    resetDemo: () => setSnapshot(initialDemoSnapshot()),
  }), [snapshot]);

  return <CrmWorkspaceContext.Provider value={value}>{storageError && <div className="governance-feedback error" role="alert">{t("workspace.storageError")}</div>}{children}</CrmWorkspaceContext.Provider>;
}

function FirebaseWorkspace({ children, repository, membership }: { children: ReactNode; repository: CommercialRepository; membership: Membership }) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<CommercialWorkspaceSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [remoteError, setRemoteError] = useState(false);
  const allowed = (permission: Permission) => canPerformCommercialAction(membership, permission);

  useEffect(() => {
    let active = true;
    setLoading(true); setRemoteError(false);
    repository.load().then((loaded) => { if (active) setSnapshot(loaded); }).catch(() => { if (active) setRemoteError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository]);

  const value = useMemo<CrmWorkspaceValue>(() => ({
    ...snapshot, loading, can: allowed,
    createLead: async (input) => {
      if (!allowed("lead.create")) return { ok: false, reason: "permission_denied" };
      setRemoteError(false);
      try {
        const result = await repository.createLead(input);
        if (result.ok) setSnapshot((state) => ({ ...state, leads: [result.lead, ...state.leads] }));
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
        setSnapshot((state) => ({ ...state, opportunities: state.opportunities.map((item) => item.id === id ? opportunity : item) }));
        return { ...validation, opportunity };
      } catch { setRemoteError(true); return null; }
    },
    completeActivity: async (id) => {
      if (!allowed("activity.create")) return;
      setRemoteError(false);
      try {
        const activity = await repository.completeActivity(id);
        setSnapshot((state) => ({ ...state, activities: state.activities.map((item) => item.id === id ? activity : item) }));
      } catch { setRemoteError(true); }
    },
    addActivity: async (input) => {
      if (!allowed("activity.create")) return null;
      setRemoteError(false);
      try {
        const activity = await repository.createActivity(input);
        setSnapshot((state) => ({ ...state, activities: [activity, ...state.activities], leads: state.leads.map((lead) => lead.companyName === activity.companyName ? { ...lead, lastActivityAt: new Date().toISOString() } : lead) }));
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
    resetDemo: () => undefined,
  }), [snapshot, loading, membership, repository]);

  return <CrmWorkspaceContext.Provider value={value}>{loading && <div className="workflow-feedback" role="status">{t("workspace.loading")}</div>}{remoteError && <div className="governance-feedback error" role="alert">{t("workspace.remoteError")}</div>}{children}</CrmWorkspaceContext.Provider>;
}

export function useCrmWorkspace() {
  const context = useContext(CrmWorkspaceContext);
  if (!context) throw new Error("useCrmWorkspace must be used inside CrmWorkspaceProvider");
  return context;
}
