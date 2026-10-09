import { useSyncExternalStore, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let owner = "guest";
const clients = new Map<string, QueryClient>();
const listeners = new Set<() => void>();
export function clearApplicationQueries(appId: string) {
  for (const [key, client] of clients) if (key.startsWith(`${appId}:`)) { void client.cancelQueries(); client.clear(); clients.delete(key); }
}
export function changeQueryAccount(next: string) {
  if (owner === next) return;
  owner = next;
  for (const client of clients.values()) { void client.cancelQueries(); client.clear(); }
  clients.clear();
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function applicationQueryClient(appId: string, account = owner) {
  const key = `${appId}:${account}`;
  let client = clients.get(key);
  if (!client) {
    client = new QueryClient({ defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 20 * 60_000, retry: false,
        refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { retry: false },
    } });
    clients.set(key, client);
  }
  return client;
}
export function ApplicationQueries({ appId, children }: { appId: string; children: ReactNode }) {
  const account = useSyncExternalStore(subscribe, () => owner);
  return <QueryClientProvider client={applicationQueryClient(appId, account)}>{children}</QueryClientProvider>;
}
