import {CompanySelector} from "../components/CompanySelector";
import {CompanyContext, type CompanyAccessRepository, type CompanyScopeRepositories} from "./CompanyContext";
import {businesses,authorizedBusinesses,type BusinessId} from "../domain/businesses";
import {useBusinessText} from "../i18n/businesses";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LogIn, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Membership } from "../domain/access";
import { Brand } from "../components/Brand";
import { useI18n, type Locale } from "../i18n/i18n";
import { currentBackendRuntimeConfig, type FirebaseRuntimeConfig } from "../infrastructure/firebase/config";
import { type AuthGateway, type AuthIdentity, type MembershipRepository, type SessionState } from "./session";
import { observeSession } from "./observeSession";
import { LanguageFlag } from "../components/LanguageFlag";
import type { CommercialRepository } from "./commercial";

type RuntimeSession =
  | { mode: "demo"; identity: null; membership: null }
  | { mode: "firebase"; identity: AuthIdentity; membership: Membership; memberships: MembershipRepository; commercial: CommercialRepository; organizationId: string; signOut: () => Promise<void>; actionError: boolean };

const RuntimeSessionContext = createContext<RuntimeSession>({ mode: "demo", identity: null, membership: null });

export function useRuntimeSession(): RuntimeSession {
  return useContext(RuntimeSessionContext);
}

export function SessionRuntimeProvider({ children }: { children: ReactNode }) {
  const runtimeConfig = useMemo(() => {
    try {
      return currentBackendRuntimeConfig();
    } catch {
      return null;
    }
  }, []);
  if (!runtimeConfig) return <SessionScreen state="configuration_error" />;
  if (runtimeConfig.mode === "demo") {
    return <DemoCompanyBoundary>{children}</DemoCompanyBoundary>;
  }
  return <FirebaseRuntimeBoundary config={runtimeConfig}>{children}</FirebaseRuntimeBoundary>;
}

function FirebaseRuntimeBoundary({ config, children }: { config: FirebaseRuntimeConfig; children: ReactNode }) {
  const [gateways, setGateways] = useState<ReturnType<typeof import("../infrastructure/firebase/adapters").createFirebaseGateways> | null>(null);
  const [initializationError, setInitializationError] = useState(false);

  useEffect(() => {
    let active = true;
    import("../infrastructure/firebase/adapters")
      .then(({ createFirebaseGateways }) => {
        if (active) setGateways(createFirebaseGateways(config));
      })
      .catch(() => {
        if (active) setInitializationError(true);
      });
    return () => { active = false; };
  }, [config]);

  if (initializationError) return <SessionScreen state="configuration_error" />;
  if (!gateways) return <SessionScreen state="loading" />;
  return <FirebaseSessionBoundary {...gateways} organizationId={config.organizationId}>{children}</FirebaseSessionBoundary>;
}

function FirebaseSessionBoundary({ auth, memberships, commercial, forCompany, companyAccess, organizationId, children }: { auth: AuthGateway; memberships: MembershipRepository; commercial: CommercialRepository; forCompany:(id:string)=>CompanyScopeRepositories;companyAccess:CompanyAccessRepository; organizationId: string; children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [actionError, setActionError] = useState(false);
  const [lookupErrorIdentity, setLookupErrorIdentity] = useState<AuthIdentity | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [sessionLogError, setSessionLogError] = useState(false);
  const [acceptingInvitation, setAcceptingInvitation] = useState(false);

  useEffect(() => observeSession(auth, memberships, (state) => {
    setActionError(false);
    setSession(state);
  }, setLookupErrorIdentity), [auth, memberships]);

  useEffect(() => {
    if (session.status === "authenticated") void memberships.recordSessionEvent("signed_in").then(() => setSessionLogError(false)).catch(() => setSessionLogError(true));
    if (session.status === "membership_required" || session.status === "access_blocked") void memberships.recordSessionEvent("access_denied").catch(() => undefined);
  }, [memberships, session.status, "identity" in session ? session.identity.uid : null]);

  const signIn = async () => {
    setSigningIn(true);
    setActionError(false);
    try {
      await auth.signInWithGoogle();
    } catch {
      setActionError(true);
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    setActionError(false);
    try {
      await auth.signOut();
    } catch {
      setActionError(true);
    }
  };

  const acceptInvitation = async () => {
    setAcceptingInvitation(true); setActionError(false);
    try { if (!await memberships.acceptInvitation()) setActionError(true); }
    catch { setActionError(true); }
    finally { setAcceptingInvitation(false); }
  };

  if (lookupErrorIdentity) return <SessionScreen state="lookup_error" identity={lookupErrorIdentity} onPrimaryAction={signOut} error={actionError} />;
  if (session.status === "loading") return <SessionScreen state="loading" error={actionError} />;
  if (session.status === "signed_out") return <SessionScreen state="signed_out" onPrimaryAction={signIn} busy={signingIn} error={actionError} />;
  if (session.status === "membership_required") return <SessionScreen state="membership_required" identity={session.identity} onPrimaryAction={signOut} onSecondaryAction={acceptInvitation} busy={acceptingInvitation} error={actionError} />;
  if (session.status === "access_blocked") return <SessionScreen state="access_blocked" identity={session.identity} onPrimaryAction={signOut} error={actionError} />;

  return (
    <CompanyBoundary key={session.identity.uid} forCompany={forCompany} companyAccess={companyAccess} group={{ mode: "firebase", identity: session.identity, membership: session.membership, memberships, commercial, organizationId, signOut, actionError }}>
      {sessionLogError && <SessionLogError />}
      {children}
    </CompanyBoundary>
  );
}

function SessionLogError() { const { t } = useI18n(); return <div className="governance-feedback error" role="alert">{t("audit.sessionLogError")}</div>; }

function DemoCompanyBoundary({children}:{children:ReactNode}) {
  const [id,setId]=useState<BusinessId>("d2-smart-home");
  return <CompanyContext.Provider value={{active:businesses.find(b=>b.id===id)!,available:[...businesses],select:setId,superAdmin:true}}><RuntimeSessionContext.Provider value={{mode:"demo",identity:null,membership:null}}>{children}</RuntimeSessionContext.Provider></CompanyContext.Provider>;
}
type FirebaseSession=Extract<RuntimeSession,{mode:"firebase"}>;
function CompanyBoundary({group,forCompany,companyAccess,children}:{group:FirebaseSession;forCompany:(id:string)=>CompanyScopeRepositories;companyAccess:CompanyAccessRepository;children:ReactNode}) {
  const l=useBusinessText(),{t}=useI18n(),available=authorizedBusinesses(group.membership.companyIds);
  const storageKey=`d2-company:${group.identity.uid}`;
  const [selected,setSelected]=useState<string>(()=>{try{return localStorage.getItem(storageKey)??"";}catch{return "";}});
  const active=available.find(b=>b.id===selected)??available[0];
  const select=(id:BusinessId)=>{if(!available.some(b=>b.id===id))return;setSelected(id);try{localStorage.setItem(storageKey,id);}catch{/* Selection still works without storage. */}};
  const scopes=useMemo(()=>Object.fromEntries(businesses.map(b=>[b.id,forCompany(b.id)])),[forCompany]);
  if(!active)return <div className="session-page"><section className="session-card"><Brand/><p>{l.none}</p><button className="action-button" onClick={group.signOut}>{t("auth.signOut")}</button></section></div>;
  return <CompanyContext.Provider value={{active,available,select,superAdmin:group.membership.role==="owner",groupMemberships:group.memberships,access:companyAccess,repositories:id=>scopes[id]}}><CompanySession key={active.id} group={group} scope={scopes[active.id]} organizationId={active.id}>{children}</CompanySession></CompanyContext.Provider>;
}
function CompanySession({group,scope,organizationId,children}:{group:FirebaseSession;scope:CompanyScopeRepositories;organizationId:string;children:ReactNode}) {
  const l=useBusinessText(),{t}=useI18n(); const [membership,setMembership]=useState<Membership|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{setFailed(false);setMembership(null);return scope.memberships.observeByUid(group.identity.uid,member=>{setMembership(member);setFailed(!member||member.status!=="active");},()=>setFailed(true));},[scope,group.identity.uid,attempt]);
  if(failed)return <><CompanySelector/><div className="session-page"><section className="session-card"><Brand/><p>{l.none}</p><button className="action-button" onClick={()=>setAttempt(a=>a+1)}>{l.reload}</button><button className="action-button secondary" onClick={group.signOut}>{t("auth.signOut")}</button></section></div></>;
  if(!membership)return <div className="workflow-feedback" role="status">{l.loading}</div>;
  return <RuntimeSessionContext.Provider value={{...group,...scope,membership,organizationId}}>{children}</RuntimeSessionContext.Provider>;
}

type SessionScreenState = "loading" | "signed_out" | "membership_required" | "access_blocked" | "configuration_error" | "lookup_error";

function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <div className="language-switcher" role="group" aria-label={t("language.label")}>{(["en", "pt", "es"] as Locale[]).map((language) => <button key={language} className={locale === language ? "active" : ""} onClick={() => setLocale(language)} aria-pressed={locale === language}><LanguageFlag locale={language} /><span>{language.toUpperCase()}</span></button>)}</div>;
}

function SessionScreen({ state, identity, onPrimaryAction, onSecondaryAction, busy = false, error = false }: { state: SessionScreenState; identity?: AuthIdentity; onPrimaryAction?: () => void; onSecondaryAction?: () => void; busy?: boolean; error?: boolean }) {
  const { t } = useI18n();
  const blocked = state === "membership_required" || state === "access_blocked" || state === "configuration_error" || state === "lookup_error";
  const title = state === "signed_out" ? t("auth.signInTitle") : state === "membership_required" ? t("auth.membershipRequiredTitle") : state === "access_blocked" ? t("auth.accessBlockedTitle") : state === "configuration_error" ? t("auth.configurationErrorTitle") : state === "lookup_error" ? t("auth.lookupErrorTitle") : t("auth.loadingTitle");
  const description = state === "signed_out" ? t("auth.signInDescription") : state === "membership_required" ? t("auth.membershipRequiredDescription") : state === "access_blocked" ? t("auth.accessBlockedDescription") : state === "configuration_error" ? t("auth.configurationErrorDescription") : state === "lookup_error" ? t("auth.lookupErrorDescription") : t("auth.loadingDescription");

  return <main className="session-page"><header><Brand inverse subtitle={t("brand.subtitle")} /><LanguageSwitcher /></header><section className="session-card">{blocked ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}<span className="eyebrow">{t("auth.eyebrow")}</span><h1>{title}</h1><p>{description}</p>{identity && <div className="session-identity"><strong>{identity.displayName}</strong><span>{identity.email}</span></div>}{error && <div className="session-error" role="alert">{t("auth.operationError")}</div>}{state === "signed_out" && <button className="action-button" onClick={onPrimaryAction} disabled={busy}><LogIn size={17} />{busy ? t("auth.signingIn") : t("auth.signInGoogle")}</button>}{state === "membership_required" && <button className="action-button" onClick={onSecondaryAction} disabled={busy}><ShieldCheck size={17} />{busy ? t("auth.acceptingInvitation") : t("auth.acceptInvitation")}</button>}{(state === "membership_required" || state === "access_blocked" || state === "lookup_error") && <button className="action-button secondary" onClick={onPrimaryAction}><LogOut size={17} />{t("auth.signOut")}</button>}</section></main>;
}
