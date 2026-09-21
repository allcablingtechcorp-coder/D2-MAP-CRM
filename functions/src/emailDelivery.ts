import { applicationDefault } from "firebase-admin/app";

export const CRM_URL = "https://allcablingtechcorp-coder.github.io/D2-MAP-CRM/";

// Firebase sends the one-time sign-in email. No SMTP password or OOB link is stored.
export async function sendAccessEmail(email: string, locale = "en"): Promise<void> {
  const project = process.env.GCLOUD_PROJECT;
  if (project !== "d2-map-crm") throw new Error("EMAIL_PROJECT_NOT_CONFIGURED");
  const credential = await applicationDefault().getAccessToken();
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:sendOobCode`, {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.access_token}`, "Content-Type": "application/json", "X-Firebase-Locale": ["en","pt","es"].includes(locale) ? locale : "en" },
    body: JSON.stringify({requestType:"EMAIL_SIGNIN", email, continueUrl:CRM_URL, canHandleCodeInApp:true}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "EMAIL_QUOTA" : "EMAIL_PROVIDER_FAILURE");
}
