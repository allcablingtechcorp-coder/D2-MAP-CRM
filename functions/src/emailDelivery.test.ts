import {afterEach,describe,expect,it,vi} from "vitest";
import {sendAccessEmail} from "./emailDelivery.js";
import {sendBrandedAccessEmail} from "./smtpDelivery.js";
vi.mock("firebase-admin/app",()=>({applicationDefault:()=>({getAccessToken:async()=>({access_token:"TEST_ONLY"})})}));
vi.mock("./smtpDelivery.js",()=>({sendBrandedAccessEmail:vi.fn().mockResolvedValue(undefined)}));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
describe("email delivery provider selection",()=>{
 it("preserves native Firebase sending until SMTP is explicitly enabled",async()=>{
  vi.stubEnv("GCLOUD_PROJECT","d2-map-crm");vi.stubEnv("CRM_EMAIL_PROVIDER","");
  const fetcher=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal("fetch",fetcher);
  await sendAccessEmail("a@example.com");
  expect(JSON.parse(fetcher.mock.calls[0]![1].body).returnOobLink).toBeUndefined();expect(sendBrandedAccessEmail).not.toHaveBeenCalled();
 });
 it("generates the secure link without a second Firebase email and sends the branded context",async()=>{
  vi.stubEnv("GCLOUD_PROJECT","d2-map-crm");vi.stubEnv("CRM_EMAIL_PROVIDER","hostinger");vi.stubEnv("CRM_SMTP_PASSWORD","TEST_ONLY");
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({oobLink:"https://d2-map-crm.firebaseapp.com/__/auth/action?oobCode=TEST_ONLY"})});vi.stubGlobal("fetch",fetcher);
  await sendAccessEmail("a@example.com","en",{kind:"invitation",companyIds:["d2-smart-home"]});
  expect(JSON.parse(fetcher.mock.calls[0]![1].body).returnOobLink).toBe(true);
  expect(sendBrandedAccessEmail).toHaveBeenCalledWith(expect.objectContaining({recipient:"a@example.com",kind:"invitation",companyIds:["d2-smart-home"]}));
 });
 it("fails without the configured password rather than silently sending a different email",async()=>{
  vi.stubEnv("GCLOUD_PROJECT","d2-map-crm");vi.stubEnv("CRM_EMAIL_PROVIDER","hostinger");vi.stubEnv("CRM_SMTP_PASSWORD","");
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  await expect(sendAccessEmail("a@example.com","en",{kind:"signin",companyIds:["d2-smart-home"]})).rejects.toThrow("EMAIL_SMTP_NOT_CONFIGURED");expect(fetcher).not.toHaveBeenCalled();
 });
});
