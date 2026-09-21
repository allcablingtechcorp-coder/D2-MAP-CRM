import { applicationDefault } from "firebase-admin/app";
import type {AccessEmailContext} from "./accessEmailTemplate.js";
import {crmCallableOptions} from "./requestProtection.js";

// Only bind the password when deploying the explicitly enabled SMTP provider.
export const emailCallableOptions={...crmCallableOptions,secrets:process.env.CRM_EMAIL_PROVIDER==="hostinger"?["CRM_SMTP_PASSWORD"]:[]};

export const CRM_URL = "https://allcablingtechcorp-coder.github.io/D2-MAP-CRM/";

// Firebase generates the one-time link. The selected provider delivers the email.
// Neither the SMTP password nor the link is stored in Firestore or logged.
export async function sendAccessEmail(email: string, locale = "en", context?:AccessEmailContext): Promise<void> {
  const project = process.env.GCLOUD_PROJECT;
  if (project !== "d2-map-crm") throw new Error("EMAIL_PROJECT_NOT_CONFIGURED");
  const credential = await applicationDefault().getAccessToken();
  const branded=process.env.CRM_EMAIL_PROVIDER==="hostinger";
  if(branded&&(!context||!process.env.CRM_SMTP_PASSWORD))throw new Error("EMAIL_SMTP_NOT_CONFIGURED");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:sendOobCode`, {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.access_token}`, "Content-Type": "application/json", "X-Firebase-Locale": ["en","pt","es"].includes(locale) ? locale : "en" },
    body: JSON.stringify({requestType:"EMAIL_SIGNIN", email, continueUrl:CRM_URL, canHandleCodeInApp:true,...(branded?{returnOobLink:true}:{})}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "EMAIL_QUOTA" : "EMAIL_PROVIDER_FAILURE");
  if(branded){
    const payload=await response.json() as {oobLink?:string};
    if(!payload.oobLink)throw new Error("EMAIL_LINK_MISSING");
    const {sendBrandedAccessEmail}=await import("./smtpDelivery.js");
    await sendBrandedAccessEmail({...context!,recipient:email,locale,link:payload.oobLink});
  }
}
