import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoActivities, demoLeads, demoOpportunities } from "../data/demo";
import type { Activity, Lead, Opportunity, OpportunityStage } from "../domain/crm";
import { completeActivity, createLead, transitionOpportunity, type LeadCreationResult, type LeadInput, type OpportunityTransitionResult } from "../domain/workflows";

interface WorkspaceSnapshot {
  leads: Lead[];
  opportunities: Opportunity[];
  activities: Activity[];
}

interface CrmWorkspaceValue extends WorkspaceSnapshot {
  createLead: (input: LeadInput) => LeadCreationResult;
  advanceOpportunity: (id: string, to: OpportunityStage) => OpportunityTransitionResult | null;
  completeActivity: (id: string) => void;
  addActivity: (activity: Omit<Activity, "id" | "completed">) => Activity;
  addOpportunity: (opportunity: Omit<Opportunity, "id" | "stage" | "currency">) => Opportunity;
  resetDemo: () => void;
}

const STORAGE_KEY = "d2-crm-demo-workspace-v1";
const initialSnapshot = (): WorkspaceSnapshot => ({ leads: demoLeads, opportunities: demoOpportunities, activities: demoActivities });

function loadSnapshot(): WorkspaceSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(loadSnapshot);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [snapshot]);

  const value = useMemo<CrmWorkspaceValue>(() => ({
    ...snapshot,
    createLead: (input) => {
      const result = createLead(input, snapshot.leads, new Date(), crypto.randomUUID());
      if (result.ok) setSnapshot((current) => ({ ...current, leads: [result.lead, ...current.leads] }));
      return result;
    },
    advanceOpportunity: (id, to) => {
      const current = snapshot.opportunities.find((item) => item.id === id);
      if (!current) return null;
      const result = transitionOpportunity(current, to);
      if (result.ok) setSnapshot((state) => ({ ...state, opportunities: state.opportunities.map((item) => item.id === id ? result.opportunity : item) }));
      return result;
    },
    completeActivity: (id) => setSnapshot((state) => ({ ...state, activities: state.activities.map((item) => item.id === id ? completeActivity(item) : item) })),
    addActivity: (input) => {
      const activity: Activity = { ...input, id: crypto.randomUUID(), completed: false };
      setSnapshot((state) => ({ ...state, activities: [activity, ...state.activities] }));
      return activity;
    },
    addOpportunity: (input) => {
      const opportunity: Opportunity = { ...input, id: crypto.randomUUID(), stage: "discovery", currency: "USD" };
      setSnapshot((state) => ({ ...state, opportunities: [opportunity, ...state.opportunities] }));
      return opportunity;
    },
    resetDemo: () => setSnapshot(initialSnapshot()),
  }), [snapshot]);

  return <CrmWorkspaceContext.Provider value={value}>{children}</CrmWorkspaceContext.Provider>;
}

export function useCrmWorkspace() {
  const context = useContext(CrmWorkspaceContext);
  if (!context) throw new Error("useCrmWorkspace must be used inside CrmWorkspaceProvider");
  return context;
}
