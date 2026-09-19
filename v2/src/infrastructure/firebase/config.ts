export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface FirebaseRuntimeConfig {
  mode: "firebase";
  client: FirebaseClientConfig;
  organizationId: string;
  functionsRegion: string;
}

export type BackendRuntimeConfig = { mode: "demo" } | FirebaseRuntimeConfig;

type Environment = Record<string, string | undefined>;

const requiredFirebaseVariables = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_CRM_ORGANIZATION_ID",
] as const;

export class FirebaseConfigurationError extends Error {
  constructor(public readonly missingVariables: string[]) {
    super(`Firebase configuration is incomplete: ${missingVariables.join(", ")}`);
    this.name = "FirebaseConfigurationError";
  }
}

function optionalValue(environment: Environment, key: string): string | undefined {
  const value = environment[key]?.trim();
  return value || undefined;
}

export function resolveBackendRuntimeConfig(environment: Environment): BackendRuntimeConfig {
  const requestedMode = optionalValue(environment, "VITE_CRM_BACKEND")?.toLowerCase() ?? "demo";
  if (requestedMode === "demo") return { mode: "demo" };
  if (requestedMode !== "firebase") throw new Error(`Unsupported CRM backend: ${requestedMode}`);

  const missingVariables = requiredFirebaseVariables.filter((key) => !optionalValue(environment, key));
  if (missingVariables.length) throw new FirebaseConfigurationError([...missingVariables]);

  const storageBucket = optionalValue(environment, "VITE_FIREBASE_STORAGE_BUCKET");
  const messagingSenderId = optionalValue(environment, "VITE_FIREBASE_MESSAGING_SENDER_ID");

  return {
    mode: "firebase",
    client: {
      apiKey: optionalValue(environment, "VITE_FIREBASE_API_KEY")!,
      authDomain: optionalValue(environment, "VITE_FIREBASE_AUTH_DOMAIN")!,
      projectId: optionalValue(environment, "VITE_FIREBASE_PROJECT_ID")!,
      appId: optionalValue(environment, "VITE_FIREBASE_APP_ID")!,
      ...(storageBucket ? { storageBucket } : {}),
      ...(messagingSenderId ? { messagingSenderId } : {}),
    },
    organizationId: optionalValue(environment, "VITE_CRM_ORGANIZATION_ID")!,
    functionsRegion: optionalValue(environment, "VITE_FIREBASE_FUNCTIONS_REGION") ?? "us-central1",
  };
}

export function currentBackendRuntimeConfig(): BackendRuntimeConfig {
  return resolveBackendRuntimeConfig(import.meta.env);
}
