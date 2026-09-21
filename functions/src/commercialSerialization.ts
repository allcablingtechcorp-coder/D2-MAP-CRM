import { Timestamp, type DocumentData } from "firebase-admin/firestore";
export function recordMetadata(data: DocumentData) { return { ownerUid: String(data.ownerUid ?? ""), teamId: typeof data.teamId === "string" ? data.teamId : null, companyId: String(data.companyId ?? ""), archived: data.archived === true, revision: data.updatedAt instanceof Timestamp ? `${data.updatedAt.seconds}:${data.updatedAt.nanoseconds}` : "" }; }
export function dateIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return new Date(0).toISOString();
}

export function serializeLead(document: { id: string; data: DocumentData }) {
  const data = document.data;
  return { ...recordMetadata(data), id: document.id, companyName: String(data.companyName ?? ""), location: String(data.location ?? ""), ownerName: String(data.ownerName ?? ""), qualification: String(data.qualification ?? "new"), source: String(data.source ?? "manual"), priority: String(data.priority ?? "medium"), nextAction: String(data.nextAction ?? ""), nextActionAt: dateIso(data.nextActionAt), lastActivityAt: dateIso(data.lastActivityAt) };
}

export function serializeOpportunity(document: { id: string; data: DocumentData }) {
  const data = document.data;
  return { ...recordMetadata(data), id: document.id, title: String(data.title ?? ""), companyName: String(data.companyName ?? ""), ownerName: String(data.ownerName ?? ""), stage: String(data.stage ?? "discovery"), amountCents: typeof data.amountCents === "number" ? data.amountCents : null, currency: "USD", nextAction: String(data.nextAction ?? ""), expectedCloseAt: String(data.expectedCloseAt ?? "") };
}

export function serializeActivity(document: { id: string; data: DocumentData }) {
  const data = document.data;
  return { ...recordMetadata(data), id: document.id, kind: String(data.kind ?? "note"), subject: String(data.subject ?? ""), companyName: String(data.companyName ?? ""), ownerName: String(data.ownerName ?? ""), dueAt: dateIso(data.dueAt), completedAt: data.completedAt ? dateIso(data.completedAt) : "", completed: data.completed === true };
}

export function serializeCompany(document: { id: string; data: DocumentData }) {
  const data = document.data;
  return { ...recordMetadata(data), id: document.id, name: String(data.name ?? ""), location: String(data.location ?? ""), ownerName: String(data.ownerName ?? ""), industry: String(data.industry ?? ""), website: String(data.website ?? ""), phone: String(data.phone ?? ""), createdAt: dateIso(data.createdAt) };
}

export function serializeContact(document: { id: string; data: DocumentData }) {
  const data = document.data;
  return { ...recordMetadata(data), id: document.id, companyId: String(data.companyId ?? ""), companyName: String(data.companyName ?? ""), name: String(data.name ?? ""), title: String(data.title ?? ""), email: String(data.email ?? ""), phone: String(data.phone ?? ""), ownerName: String(data.ownerName ?? ""), createdAt: dateIso(data.createdAt) };
}

