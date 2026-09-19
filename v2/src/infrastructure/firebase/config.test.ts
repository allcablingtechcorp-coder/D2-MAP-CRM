import { FirebaseConfigurationError, resolveBackendRuntimeConfig } from "./config";

const configuredEnvironment = {
  VITE_CRM_BACKEND: "firebase",
  VITE_FIREBASE_API_KEY: "api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "d2-map-crm.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "d2-map-crm",
  VITE_FIREBASE_APP_ID: "app-id",
  VITE_CRM_ORGANIZATION_ID: "d2-group",
};

describe("Firebase runtime configuration", () => {
  it("keeps the published application in demo mode by default", () => {
    expect(resolveBackendRuntimeConfig({})).toEqual({ mode: "demo" });
  });

  it("rejects activation when required Firebase values are missing", () => {
    expect(() => resolveBackendRuntimeConfig({ VITE_CRM_BACKEND: "firebase" })).toThrow(FirebaseConfigurationError);
  });

  it("normalizes a complete Firebase configuration", () => {
    expect(resolveBackendRuntimeConfig({ ...configuredEnvironment, VITE_FIREBASE_FUNCTIONS_REGION: " us-east1 " })).toEqual({
      mode: "firebase",
      client: {
        apiKey: "api-key",
        authDomain: "d2-map-crm.firebaseapp.com",
        projectId: "d2-map-crm",
        appId: "app-id",
      },
      organizationId: "d2-group",
      functionsRegion: "us-east1",
    });
  });
});
