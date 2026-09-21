import { HttpsError } from "firebase-functions/v2/https";

export const recordCollections = ["leads", "companies", "contacts", "activities", "opportunities"] as const;
export type RecordCollection = typeof recordCollections[number];
export const editFields: Record<RecordCollection, Record<string, number | readonly string[]>> = {
  leads: { location: 300, qualification: ["new", "contacting", "qualified", "nurturing", "disqualified"], priority: ["high", "medium", "low"], nextAction: 500, nextActionAt: 64, companyId: 128 },
  companies: { name: 200, location: 300, industry: 120, website: 300, phone: 50 },
  contacts: { name: 200, title: 120, email: 254, phone: 50, companyId: 128 },
  activities: { kind: ["call", "email", "meeting", "visit", "note"], subject: 500, dueAt: 64, companyId: 128 },
  opportunities: { title: 200, nextAction: 500, expectedCloseAt: 10, amountCents: 999_999_999_999, companyId: 128 },
};
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpsError("invalid-argument", "An object is required");
  return value as Record<string, unknown>;
}
export function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new HttpsError("invalid-argument", "Unsupported fields");
}
export function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", "Invalid identifier");
  return value;
}
export function collection(value: unknown): RecordCollection {
  if (!recordCollections.includes(value as RecordCollection)) throw new HttpsError("invalid-argument", "Invalid collection");
  return value as RecordCollection;
}
export function parseEditPatch(kind: RecordCollection, value: unknown): Record<string, unknown> {
  const patch = object(value); exact(patch, Object.keys(editFields[kind]));
  if (!Object.keys(patch).length) throw new HttpsError("invalid-argument", "No changes provided");
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(patch)) {
    const rule = editFields[kind][key];
    if (key === "amountCents") {
      if (raw !== null && (!Number.isSafeInteger(raw) || Number(raw) <= 0 || Number(raw) > Number(rule))) throw new HttpsError("invalid-argument", "Invalid amount");
      result[key] = raw; continue;
    }
    if (typeof raw !== "string") throw new HttpsError("invalid-argument", `Invalid ${key}`);
    const text = raw.trim();
    if (Array.isArray(rule) ? !rule.includes(text) : text.length > Number(rule)) throw new HttpsError("invalid-argument", `Invalid ${key}`);
    if (!["industry", "website", "phone", "title", "email"].includes(key) && !text) throw new HttpsError("invalid-argument", `Required ${key}`);
    if (key === "title" && kind === "opportunities" && !text) throw new HttpsError("invalid-argument", "Required title");
    if (key === "companyId") id(text);
    if (key === "email" && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new HttpsError("invalid-argument", "Invalid email");
    if (key === "website" && text) { try { if (!["https:", "http:"].includes(new URL(text).protocol)) throw new Error(); } catch { throw new HttpsError("invalid-argument", "Invalid website"); } }
    if (["nextActionAt", "dueAt", "expectedCloseAt"].includes(key)) {
      const date = new Date(key === "expectedCloseAt" ? `${text}T12:00:00Z` : text);
      if (!/^\d{4}-\d{2}-\d{2}/.test(text) || !Number.isFinite(date.getTime()) || new Date(`${text.slice(0, 10)}T12:00:00Z`).toISOString().slice(0, 10) !== text.slice(0, 10)) throw new HttpsError("invalid-argument", "Invalid date");
      result[key] = key === "expectedCloseAt" ? text : date.toISOString();
    } else result[key] = key === "email" ? text.toLowerCase() : text;
  }
  return result;
}
