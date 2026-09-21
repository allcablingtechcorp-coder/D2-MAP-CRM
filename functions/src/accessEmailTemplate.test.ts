import {describe,expect,it} from "vitest";
import {buildAccessEmail} from "./accessEmailTemplate.js";
const input={kind:"invitation" as const,companyIds:["d2-hvac-solutions"],recipient:"teammate@example.com",link:"https://d2-map-crm.firebaseapp.com/__/auth/action?mode=signIn&oobCode=TEST_ONLY",role:"operations_admin",scope:"organization",expiresAt:1790600400000};
describe("branded access emails",()=>{
 it("includes only authorized company logos and preserves the exact secure link",()=>{
  const mail=buildAccessEmail(input);
  expect(mail.html).toContain("D2 HVAC Solutions");expect(mail.html).not.toContain("D2 Smart Home");
  expect(mail.assets).toHaveLength(2);expect(mail.html).toContain("&amp;oobCode=TEST_ONLY");expect(mail.text).toContain(input.link);
 });
 it("supports three languages and defaults to English",()=>{
  expect(buildAccessEmail(input).subject).toContain("You're invited");
  expect(buildAccessEmail({...input,locale:"pt"}).subject).toContain("Você foi convidado");
  expect(buildAccessEmail({...input,locale:"es"}).subject).toContain("Está invitado");
 });
 it("escapes recipient HTML and rejects external links and missing company scope",()=>{
  expect(buildAccessEmail({...input,recipient:'<img src=x onerror="alert(1)">@test.com'}).html).toContain("&lt;img");
  expect(()=>buildAccessEmail({...input,link:"https://attacker.example/"})).toThrow("EMAIL_LINK_NOT_ALLOWED");
  expect(()=>buildAccessEmail({...input,companyIds:[]})).toThrow("EMAIL_COMPANIES_REQUIRED");
 });
 it("uses separate copy for subsequent sign-ins, without granting a fresh invitation",()=>{
  const mail=buildAccessEmail({...input,kind:"signin"});
  expect(mail.subject).toBe("Your secure access to D2 CRM");expect(mail.html).not.toContain("Accept invitation");expect(mail.html).not.toContain("Invitation valid until");
 });
});
