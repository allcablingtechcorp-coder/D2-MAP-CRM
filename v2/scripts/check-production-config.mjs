const required = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID", "VITE_CRM_ORGANIZATION_ID", "VITE_GOOGLE_MAPS_API_KEY"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (process.env.VITE_CRM_BACKEND !== "firebase" || missing.length) {
  console.error("Production requires Firebase authentication and a complete configuration. Missing variable names:", missing.join(", "));
  process.exit(1);
}
console.log("Authenticated production configuration verified.");
