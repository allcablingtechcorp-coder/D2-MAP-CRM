import {describe,it,expect} from "vitest";
import type {Membership} from "./access";
import {canUseGroupAdministration} from "./companyAdministration";

describe("group administration navigation",()=>{
  const owner:Membership={uid:"owner",email:"owner@example.test",displayName:"Owner",role:"owner",status:"active",scope:"organization",modules:["admin"],ownerProtected:true};
  it("keeps protected-owner administration in native and integrated access",()=>{
    expect(canUseGroupAdministration(owner,false,false)).toBe(true);
    expect(canUseGroupAdministration(owner,true,false)).toBe(true);
  });
  it("never offers group administration to consolidated reports, suspended owners or ordinary users",()=>{
    expect(canUseGroupAdministration(owner,true,true)).toBe(false);
    expect(canUseGroupAdministration({...owner,status:"suspended"},true,false)).toBe(false);
    expect(canUseGroupAdministration({...owner,role:"sales_manager"},true,false)).toBe(false);
    expect(canUseGroupAdministration({...owner,ownerProtected:false},true,false)).toBe(false);
    expect(canUseGroupAdministration({...owner,ownerProtected:false},false,false)).toBe(true);
  });
});
