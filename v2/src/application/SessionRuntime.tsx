import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LogIn, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Membership } from "../domain/access";
import { Brand } from "../components/Brand";
import { useI18n, type Locale } from "../i18n/i18n";
import { currentBackendRuntimeConfig, type FirebaseRuntimeConfig } from "../infrastructure/firebase/config";
import { type AuthGateway, type AuthIdentity, type MembershipRepository, type SessionState } from "./session";
import { observeSession } from "./observeSession";

type RuntimeSession =
  | { mode: "demo"; identity: null; membership: null }
  | { mode: "firebase"; identity: AuthIdentity; membership: Membership; memberships: MembershipRepository; organizationId: string; signOut: () => Promise<void>; actionError: boolean };

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
    return <RuntimeSessionContext.Provider value={{ mode: "demo", identity: null, membership: null }}>{children}</RuntimeSessionContext.Provider>;
  }
  return <FirebaseRuntimeBoundary config={runtimeConfig}>{children}</FirebaseRuntimeBoundary>;
}

function FirebaseRuntimeBoundary({ config, children }: { config: FirebaseRuntimeConfig; children: ReactNode }) {
  const [gateways, setGateways] = useState<{ auth: AuthGateway; memberships: MembershipRepository } | null>(null);
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

function FirebaseSessionBoundary({ auth, memberships, organizationId, children }: { auth: AuthGateway; memberships: MembershipRepository; organizationId: string; children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [actionError, setActionError] = useState(false);
  const [lookupErrorIdentity, setLookupErrorIdentity] = useState<AuthIdentity | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => observeSession(auth, memberships, (state) => {
    setActionError(false);
    setSession(state);
  }, setLookupErrorIdentity), [auth, memberships]);

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

  if (lookupErrorIdentity) return <SessionScreen state="lookup_error" identity={lookupErrorIdentity} onPrimaryAction={signOut} error={actionError} />;
  if (session.status === "loading") return <SessionScreen state="loading" error={actionError} />;
  if (session.status === "signed_out") return <SessionScreen state="signed_out" onPrimaryAction={signIn} busy={signingIn} error={actionError} />;
  if (session.status === "membership_required") return <SessionScreen state="membership_required" identity={session.identity} onPrimaryAction={signOut} error={actionError} />;
  if (session.status === "access_blocked") return <SessionScreen state="access_blocked" identity={session.identity} onPrimaryAction={signOut} error={actionError} />;

  return (
    <RuntimeSessionContext.Provider key={`${organizationId}:${session.identity.uid}`} value={{ mode: "firebase", identity: session.identity, membership: session.membership, memberships, organizationId, signOut, actionError }}>
      {children}
    </RuntimeSessionContext.Provider>
  );
}

type SessionScreenState = "loading" | "signed_out" | "membership_required" | "access_blocked" | "configuration_error" | "lookup_error";

function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <div className="language-switcher" role="group" aria-label={t("language.label")}>{(["pt", "en", "es"] as Locale[]).map((language) => <button key={language} className={locale === language ? "active" : ""} onClick={() => setLocale(language)} aria-pressed={locale === language}><span aria-hidden="true">{language === "pt" ? "🇧🇷" : language === "en" ? "🇺🇸" : "🇪🇸"}</span><span>{language.toUpperCase()}</span></button>)}</div>;
}

function SessionScreen({ state, identity, onPrimaryAction, busy = false, error = false }: { state: SessionScreenState; identity?: AuthIdentity; onPrimaryAction?: () => void; busy?: boolean; error?: boolean }) {
  const { t } = useI18n();
  const blocked = state === "membership_required" || state === "access_blocked" || state === "configuration_error" || state === "lookup_error";
  const title = state === "signed_out" ? t("auth.signInTitle") : state === "membership_required" ? t("auth.membershipRequiredTitle") : state === "access_blocked" ? t("auth.accessBlockedTitle") : state === "configuration_error" ? t("auth.configurationErrorTitle") : state === "lookup_error" ? t("auth.lookupErrorTitle") : t("auth.loadingTitle");
  const description = state === "signed_out" ? t("auth.signInDescription") : state === "membership_required" ? t("auth.membershipRequiredDescription") : state === "access_blocked" ? t("auth.accessBlockedDescription") : state === "configuration_error" ? t("auth.configurationErrorDescription") : state === "lookup_error" ? t("auth.lookupErrorDescription") : t("auth.loadingDescription");

  return <main className="session-page"><header><Brand inverse subtitle={t("brand.subtitle")} /><LanguageSwitcher /></header><section className="session-card">{blocked ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}<span className="eyebrow">{t("auth.eyebrow")}</span><h1>{title}</h1><p>{description}</p>{identity && <div className="session-identity"><strong>{identity.displayName}</strong><span>{identity.email}</span></div>}{error && <div className="session-error" role="alert">{t("auth.operationError")}</div>}{state === "signed_out" && <button className="action-button" onClick={onPrimaryAction} disabled={busy}><LogIn size={17} />{busy ? t("auth.signingIn") : t("auth.signInGoogle")}</button>}{(state === "membership_required" || state === "access_blocked" || state === "lookup_error") && <button className="action-button secondary" onClick={onPrimaryAction}><LogOut size={17} />{t("auth.signOut")}</button>}</section></main>;
}
