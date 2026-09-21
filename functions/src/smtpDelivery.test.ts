import {afterEach,describe,expect,it,vi} from "vitest";
import nodemailer from "nodemailer";
import {sendBrandedAccessEmail} from "./smtpDelivery.js";

vi.mock("nodemailer",()=>({default:{createTransport:vi.fn()}}));
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const input={kind:"invitation" as const,companyIds:["d2-hvac-solutions"],recipient:"teammate@example.com",link:"https://d2-map-crm.firebaseapp.com/__/auth/action?mode=signIn&oobCode=TEST_ONLY"};

describe("branded SMTP delivery",()=>{
 it("uses the authorized sender, verified TLS and embedded company images",async()=>{
  vi.stubEnv("CRM_SMTP_PASSWORD","TEST_ONLY");
  const sendMail=vi.fn().mockResolvedValue({accepted:[input.recipient],rejected:[]});
  const close=vi.fn();
  vi.mocked(nodemailer.createTransport).mockReturnValue({sendMail,close} as never);
  await sendBrandedAccessEmail(input);
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({host:"smtp.hostinger.com",port:465,secure:true,tls:{minVersion:"TLSv1.2",rejectUnauthorized:true},logger:false,debug:false}));
  const mail=sendMail.mock.calls[0]![0];
  expect(mail.from).toEqual({name:"D2 Group",address:"support@d2smarthome.com"});
  expect(mail.to.address).toBe(input.recipient);
  expect(mail.text).toContain(input.link);
  expect(mail.disableUrlAccess).toBe(true);
  expect(mail.attachments).toHaveLength(2);
  for(const asset of mail.attachments){
   expect(Buffer.isBuffer(asset.content)).toBe(true);
   expect(asset.content.length).toBeGreaterThan(100);
   expect(mail.html).toContain(`cid:${asset.cid}`);
  }
  expect(close).toHaveBeenCalledOnce();
 });
 it("reports a rejected recipient and closes the connection",async()=>{
  vi.stubEnv("CRM_SMTP_PASSWORD","TEST_ONLY");
  const close=vi.fn();
  vi.mocked(nodemailer.createTransport).mockReturnValue({sendMail:vi.fn().mockResolvedValue({accepted:[],rejected:[input.recipient]}),close} as never);
  await expect(sendBrandedAccessEmail(input)).rejects.toThrow("EMAIL_RECIPIENT_REJECTED");
  expect(close).toHaveBeenCalledOnce();
 });
 it("does not open an SMTP connection without a password",async()=>{
  vi.stubEnv("CRM_SMTP_PASSWORD","");
  await expect(sendBrandedAccessEmail(input)).rejects.toThrow("EMAIL_SMTP_NOT_CONFIGURED");
  expect(nodemailer.createTransport).not.toHaveBeenCalled();
 });
});
