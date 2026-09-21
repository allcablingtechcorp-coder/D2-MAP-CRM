export const businesses = [
  { id: "d2-smart-home", name: "D2 Smart Home", logo: "./logo-d2-smart-home.png" },
  { id: "d2-hvac-solutions", name: "D2 HVAC Solutions", logo: "./logo-d2-hvac-solutions.png" },
] as const;
export type BusinessId = typeof businesses[number]["id"];
export type Business = typeof businesses[number];
export function authorizedBusinesses(ids: readonly string[] = []) { return businesses.filter(b => ids.includes(b.id)); }
