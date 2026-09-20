import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoActivities, demoLeads, demoOpportunities } from "../data/demo";
import type { Activity, Lead, Opportunity, OpportunityStage } from "../domain/crm";
import { useRuntimeSession } from "./SessionRuntime";
import { workspaceStorageKey } from "./workspaceStorage";
import { useI18n } from "../i18n/i18n";
import { canPerformCommercialAction, type Permission } from "../domain/access";
import { completeActivity, createLead, transitionOpportunity, type LeadCreationResult, type LeadInput, type OpportunityTransitionResult } from "../domain/workflows";

interface WorkspaceSnapshot {
  leads: Lead[];
  opportunities: Opportunity[];
  activities: Activity[];
}

interface CrmWorkspaceValue extends WorkspaceSnapshot {
  can: (permission: Permission) => boolean;
  createLead: (input: LeadInput) => LeadCreationResult;
  advanceOpportunity: (id: string, to: OpportunityStage) => OpportunityTransitionResult | null;
  completeActivity: (id: string) => void;
  addActivity: (activity: Omit<Activity, "id" | "completed">) => Activity | null;
  addOpportunity: (opportunity: Omit<Opportunity, "id" | "stage" | "currency">) => Opportunity | null;
  resetDemo: () => void;
}

const initialSnapshot = (): WorkspaceSnapshot => ({ leads: demoLeads, opportunities: demoOpportunities, activities: demoActivities });

function loadSnapshot(storageKey: string): WorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialSnapshot();
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    if (!Array.isArray(parsed.leads) || !Array.isArray(parsed.opportunities) || !Array.isArray(parsed.activities)) return initialSnapshot();
    return { leads: parsed.leads, opportunities: parsed.opportunities, activities: parsed.activities };
  } catch {
    return initialSnapshot();
  }
}

const CrmWorkspaceContext = createContext<CrmWorkspaceValue | null>(null);

export function CrmWorkspaceProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntimeSession();
  const storageKey = workspaceStorageKey(runtime.mode === "firebase" ? { organizationId: runtime.organizationId, uid: runtime.identity.uid } : undefined);
  return <AccountWorkspace key={storageKey} storageKey={storageKey}>{children}</AccountWorkspace>;
}

function AccountWorkspace({ children, storageKey }: { children: ReactNode; storageKey: string }) {
  const { membership } = useRuntimeSession();
  const { t } = useI18n();
  const [permissionError, setPermissionError] = useState(false);
  const requirePermission = (permission: Permission): boolean => {
    const allowed = canPerformCommercialAction(membership, permission);
    setPermissionError(!allowed);
    return allowed;
  };
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(() => loadSnapshot(storageKey));
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [snapshot, storageKey]);

  const value = useMemo<CrmWorkspaceValue>(() => ({
    ...snapshot,
    can: (permission) => canPerformCommercialAction(membership, permission),
    createLead: (input) => {
      if (!requirePermission("lead.create")) return { ok: false, reason: "permission_denied" };
      const result = createLead(input, snapshot.leads, new Date(), crypto.randomUUID());
      if (result.ok) setSnapshot((current) => ({ ...current, leads: [result.lead, ...current.leads] }));
      return result;
    },
    advanceOpportunity: (id, to) => {
      if (!requirePermission(to === "won" || to === "lost" ? "opportunity.close" : "opportunity.update")) return null;
      const current = snapshot.opportunities.find((item) => item.id === id);
      if (!current) return null;
      const result = transitionOpportunity(current, to);
      if (result.ok) setSnapshot((state) => ({ ...state, opportunities: state.opportunities.map((item) => item.id === id ? result.opportunity : item) }));
      return result;
    },
    completeActivity: (id) => {
      if (!requirePermission("activity.create")) return;
      setSnapshot((state) => ({ ...state, activities: state.activities.map((item) => item.id === id ? completeActivity(item) : item) }));
    },
    addActivity: (input) => {
      if (!requirePermission("activity.create")) return null;
      const activity: Activity = { ...input, id: crypto.randomUUID(), completed: false };
      const occurredAt = new Date().toISOString();
      setSnapshot((state) => ({
        ...state,
        activities: [activity, ...state.activities],
        leads: state.leads.map((lead) => lead.companyName === activity.companyName ? { ...lead, lastActivityAt: occurredAt } : lead),
      }));
      return activity;
    },
    addOpportunity: (input) => {
      if (!requirePermission("opportunity.update")) return null;
      const opportunity: Opportunity = { ...input, id: crypto.randomUUID(), stage: "discovery", currency: "USD" };
      setSnapshot((state) => ({ ...state, opportunities: [opportunity, ...state.opportunities] }));
      return opportunity;
    },
    resetDemo: () => setSnapshot(initialSnapshot()),
  }), [snapshot, membership]);

  return <CrmWorkspaceContext.Provider value={value}>{storageError && <WorkspaceStorageError />}{permissionError && <div className="governance-feedback error" role="alert">{t("workspace.denied")}</div>}{children}</CrmWorkspaceContext.Provider>;
}

export function useCrmWorkspace() {
  const context = useContext(CrmWorkspaceContext);
  if (!context) throw new Error("useCrmWorkspace must be used inside CrmWorkspaceProvider");
  return context;
}

function WorkspaceStorageError() {
  const { t } = useI18n();
  return <div className="governance-feedback error" role="alert">{t("workspace.storageError")}</div>;
}
