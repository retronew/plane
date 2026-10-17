import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { TCollaborationUser } from "@/types/collaboration";
import type { TUserDetails } from "@/types/config";

export type CollaborationPresenceProvider = Pick<
  HocuspocusProvider,
  "awareness" | "status" | "isConnected" | "on" | "off"
>;
const destroyedProviders = new WeakSet<CollaborationPresenceProvider>();
const closedProviders = new WeakSet<CollaborationPresenceProvider>();

export function clearCollaborationUser(provider: CollaborationPresenceProvider) {
  if (provider.awareness?.getLocalState()?.user != null) provider.awareness.setLocalStateField("user", null);
}

/** Publish only public profile fields. Never forward authentication data to awareness. */
export function publishCollaborationUser(
  provider: CollaborationPresenceProvider,
  user: TUserDetails | undefined,
  editable: boolean
) {
  if (editable && user?.id.trim()) {
    provider.awareness?.setLocalStateField("user", { id: user.id, name: user.name, avatar: user.avatar ?? null });
  } else clearCollaborationUser(provider);
  return () => clearCollaborationUser(provider);
}

export function getCollaborationUsers(provider?: CollaborationPresenceProvider): TCollaborationUser[] {
  if (
    !provider ||
    destroyedProviders.has(provider) ||
    closedProviders.has(provider) ||
    !provider.isConnected ||
    provider.status !== "connected"
  )
    return [];
  const users = new Map<string, TCollaborationUser>();
  // Stable client order makes duplicate tab selection deterministic.
  const states = [...(provider.awareness?.getStates() ?? [])].toSorted(([a], [b]) => a - b);
  for (const [, state] of states) {
    const user: unknown = state.user;
    if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string" || !user.id.trim())
      continue;
    if (users.has(user.id)) continue;
    users.set(user.id, {
      id: user.id,
      name: "name" in user && typeof user.name === "string" ? user.name : "",
      avatar: "avatar" in user && typeof user.avatar === "string" ? user.avatar : null,
    });
  }
  return [...users.values()].toSorted((a, b) => a.id.localeCompare(b.id));
}

export function subscribeCollaborationUsers(
  provider: CollaborationPresenceProvider | undefined,
  callback: (users: TCollaborationUser[]) => void
): () => void {
  if (!provider) return () => {};
  let closed = false;
  let previous = JSON.stringify(getCollaborationUsers(provider));
  const update = () => {
    const users = closed ? [] : getCollaborationUsers(provider);
    const serialized = JSON.stringify(users);
    if (serialized === previous) return;
    previous = serialized;
    callback(users);
  };
  const status = ({ status: connectionStatus }: { status: string }) => {
    closed = connectionStatus !== "connected";
    if (closed) closedProviders.add(provider);
    else closedProviders.delete(provider);
    update();
  };
  const close = () => {
    closed = true;
    closedProviders.add(provider);
    update();
  };
  const destroy = () => {
    destroyedProviders.add(provider);
    close();
  };
  provider.awareness?.on("change", update);
  provider.on("status", status);
  provider.on("close", close);
  provider.on("disconnect", close);
  provider.on("destroy", destroy);
  return () => {
    provider.awareness?.off("change", update);
    provider.off("status", status);
    provider.off("close", close);
    provider.off("disconnect", close);
    provider.off("destroy", destroy);
  };
}
