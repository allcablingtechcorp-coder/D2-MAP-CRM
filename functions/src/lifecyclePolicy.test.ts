import { describe, expect, it } from "vitest";
import { parseEditPatch } from "./lifecyclePolicy.js";
describe("commercial maintenance validation", () => {
  it("rejects ownership, audit fields and unexpected fields in an edit", () => {
    for(const patch of [{ownerUid:"other"},{updatedByUid:"owner"},{archived:true},{stage:"won"}]) expect(() => parseEditPatch("opportunities",patch)).toThrow();
  });
  it("rejects impossible dates, unsafe amounts and invalid enum values", () => {
    expect(() => parseEditPatch("opportunities",{expectedCloseAt:"2026-02-30"})).toThrow();
    expect(() => parseEditPatch("activities",{dueAt:"2026-02-30T12:00:00Z"})).toThrow();
    for(const amount of [-1,0,12.5,Infinity,Number.MAX_SAFE_INTEGER]) expect(() => parseEditPatch("opportunities",{amountCents:amount})).toThrow();
    expect(() => parseEditPatch("leads",{qualification:"won"})).toThrow();
  });
  it("accepts clearing optional fields and normalizes contact and date values", () => {
    expect(parseEditPatch("contacts",{title:"",phone:"",email:" PERSON@EXAMPLE.COM "})).toEqual({title:"",phone:"",email:"person@example.com"});
    expect(parseEditPatch("opportunities",{amountCents:null,expectedCloseAt:"2028-02-29"})).toEqual({amountCents:null,expectedCloseAt:"2028-02-29"});
    expect(parseEditPatch("activities",{dueAt:"2026-10-01T10:00:00-04:00"})).toEqual({dueAt:"2026-10-01T14:00:00.000Z"});
  });
  it("rejects executable links, invalid references and oversized content", () => {
    for(const website of ["javascript:alert(1)","data:text/html,hello","https://"]) expect(() => parseEditPatch("companies",{website})).toThrow();
    expect(() => parseEditPatch("contacts",{companyId:"other-org/company"})).toThrow();
    expect(() => parseEditPatch("activities",{subject:"x".repeat(501)})).toThrow();
    expect(parseEditPatch("companies",{website:"https://example.com"})).toEqual({website:"https://example.com"});
  });
});
