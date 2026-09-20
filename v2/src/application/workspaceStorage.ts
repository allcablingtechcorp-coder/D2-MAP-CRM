export function workspaceStorageKey(account?: { organizationId: string; uid: string }): string {
  return account ? `d2-crm-demo-workspace-v2:${encodeURIComponent(account.organizationId)}:${encodeURIComponent(account.uid)}` : "d2-crm-demo-workspace-v1";
}
