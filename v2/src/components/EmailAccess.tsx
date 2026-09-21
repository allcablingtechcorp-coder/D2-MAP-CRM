import {useState} from "react";
import type {AuthGateway} from "../application/session";
import {Brand} from "./Brand";
import {LanguageFlag} from "./LanguageFlag";
import {useI18n,type Locale} from "../i18n/i18n";
import {useInvitationText} from "../i18n/invitations";

export function EmailAccess({auth,completing,onComplete,onGoogle}:{auth:AuthGateway;completing:boolean;onComplete:()=>void;onGoogle:()=>Promise<void>}) {
 const l=useInvitationText(),{locale,setLocale,t}=useI18n();
 const [email,setEmail]=useState(()=>{try{return completing?localStorage.getItem("d2-email-link")??"":"";}catch{return "";}}),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(false);
 return <main className="session-page"><header><Brand inverse subtitle={t("brand.subtitle")}/><div className="language-switcher" role="group" aria-label={t("language.label")}>{(["en","pt","es"] as Locale[]).map(code=><button key={code} className={locale===code?"active":""} onClick={()=>setLocale(code)} aria-pressed={locale===code}><LanguageFlag locale={code}/>{code.toUpperCase()}</button>)}</div></header><section className="session-card"><h1>{completing?l.completeTitle:l.emailTitle}</h1><p>{completing?l.completeHelp:l.emailHelp}</p><form className="email-access-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError(false);try{if(completing){await auth.completeEmailLink!(email);onComplete();}else{await auth.requestEmailLink!(email,locale);setSent(true);}}catch{setError(true);}finally{setBusy(false);}}}><label>{l.email}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setSent(false);}}/></label><button className="action-button" disabled={busy}>{busy?l.working:completing?l.complete:l.send}</button></form>{sent&&<p role="status">{l.sent}</p>}{error&&<p role="alert" className="session-error">{l.failure}</p>}{completing?<button className="action-button secondary" disabled={busy} onClick={()=>{window.history.replaceState({},"",window.location.pathname);onComplete();}}>{l.back}</button>:<><p>{l.or}</p><button className="action-button secondary" disabled={busy} onClick={async()=>{setBusy(true);setError(false);try{await onGoogle();}catch{setError(true);}finally{setBusy(false);}}}>{l.google}</button></>}</section></main>;
}
