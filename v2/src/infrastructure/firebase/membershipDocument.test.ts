import type { Membership } from "../../domain/access";
import { membershipFromDocument, membershipToDocument } from "./membershipDocument";

const membership: Membership = {
  uid: "user-1",
  email: "OWNER@EXAMPLE.COM",
  displayName: "Owner",
  role: "owner",
  status: "active",
  scope: "organization",
  modules: ["dashboard", "admin"],
  permissionOverrides: { "report.export": false },
  ownerProtected: true,
};

describe("Firestore membership document", () => {
  it("derives uid from the document id and normalizes the email", () => {
    expect(membershipFromDocument(membership.uid, membershipToDocument(membership))).toEqual({ ...membership, email: "owner@example.com" });
  });

  it("rejects unknown roles from persisted data", () => {
    expect(() => membershipFromDocument("user-1", { ...membershipToDocument(membership), role: "administrator" })).toThrow("Invalid membership field: role");
  });

  it("rejects malformed permission overrides", () => {
    expect(() => membershipFromDocument("user-1", { ...membershipToDocument(membership), permissionOverrides: { "lead.read": "yes" } })).toThrow("Invalid membership field: permissionOverrides");
  });
});
