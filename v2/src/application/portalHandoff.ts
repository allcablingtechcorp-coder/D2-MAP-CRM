export const PORTAL_ORIGIN = "https://d2-group-system.web.app";

export function portalEmbedCompany(search: string): "smart" | "hvac" | null {
  const params = new URLSearchParams(search);
  const company = params.get("company");
  return params.get("source") === "d2-portal" && params.get("embed") === "1" && (company === "smart" || company === "hvac") ? company : null;
}

export function validPortalReply(origin: string, data: unknown, nonce: string, company: string): data is { type: string; nonce: string; company: string; token?: string; error?: string } {
  if (origin !== PORTAL_ORIGIN || !data || typeof data !== "object") return false;
  const reply = data as Record<string, unknown>;
  return reply.type === "d2-crm-handoff-response" && reply.nonce === nonce && reply.company === company;
}

export function requestPortalToken(company: "smart" | "hvac"): Promise<string> {
  if (window.parent === window) return Promise.reject(new Error("Open CRM from the D2 Portal"));
  return new Promise((resolve, reject) => {
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const timer = window.setTimeout(() => { cleanup(); reject(new Error("Portal handoff timed out")); }, 12000);
    const cleanup = () => { window.clearTimeout(timer); window.removeEventListener("message", onMessage); };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !validPortalReply(event.origin, event.data, nonce, company)) return;
      cleanup();
      if (typeof event.data.token !== "string" || event.data.token.length < 100 || event.data.token.length > 8000) {
        reject(new Error(event.data.error || "Portal handoff was denied")); return;
      }
      resolve(event.data.token);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "d2-crm-handoff-request", nonce, company }, PORTAL_ORIGIN);
  });
}
