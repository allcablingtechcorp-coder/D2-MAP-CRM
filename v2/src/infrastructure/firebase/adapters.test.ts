import { identityFromFirebaseUser } from "./adapters";

describe("Firebase identity mapping", () => {
  it("normalizes an authenticated Google identity", () => {
    expect(identityFromFirebaseUser({ uid: "user-1", email: " USER@EXAMPLE.COM ", displayName: " User Name ", photoURL: "photo.jpg" })).toEqual({
      uid: "user-1",
      email: "user@example.com",
      displayName: "User Name",
      photoUrl: "photo.jpg",
    });
  });

  it("rejects identities without an email address", () => {
    expect(() => identityFromFirebaseUser({ uid: "user-1", email: null, displayName: null, photoURL: null })).toThrow("The authenticated identity has no email address");
  });
});
