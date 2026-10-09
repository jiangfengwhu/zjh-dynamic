import { AppState } from "react-native";
import { cloudDatabase } from "../../../../packages/app-sdk/src/cloud";
import { CloudError, type CloudRoom, type CloudRooms, type CloudRoomStatus, type CloudRoomEvent, type CloudRoomMember, type CloudCollection } from "../../../../packages/app-sdk/src/cloud-types";
import { accountSocket, cachedAccountId, requireAccount, subscribeAccountIdentity } from "../shell/account";

const activeApps = new Set<string>();
const clients = new Set<{ appId: string; refresh: () => void; leave: () => void }>();
let installed = false;
export function setCloudActivity(appId: string, active: boolean) {
  if (active) activeApps.add(appId); else activeApps.delete(appId);
  for (const client of clients) if (client.appId === appId) client.refresh();
}
export function applicationRooms(appId: string): CloudRooms {
  if (!installed) {
    installed = true;
    AppState.addEventListener("change", () => { for (const client of clients) client.refresh(); });
    subscribeAccountIdentity(() => { for (const client of [...clients]) client.leave(); });
  }
  return { join: async (id, options) => {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(id)) throw new CloudError("INVALID_ARGUMENT", "房间编号无效");
    if (options?.signal?.aborted) throw new CloudError("CANCELLED", "连接已取消");
    if (!await requireAccount(false)) throw new CloudError("UNAUTHENTICATED", "请先登录");
    if (clients.size >= 16 || [...clients].filter(client => client.appId === appId).length >= 4) throw new CloudError("QUOTA_EXCEEDED", "实时房间数量已达上限");
    const owner = cachedAccountId();
    if (!owner) throw new CloudError("UNAUTHENTICATED", "请先登录");
    let status: CloudRoomStatus = "connecting", members: CloudRoomMember[] = [], socket: WebSocket | undefined;
    let opening = false, closed = false, attempt = 0, revision = 0, sequence = -1;
    let retry: ReturnType<typeof setTimeout> | undefined, expiration: ReturnType<typeof setTimeout> | undefined;
    const listeners = new Set<() => void>(), events = new Map<string, Set<(event: CloudRoomEvent) => void>>();
    const pending = new Map<string, { resolve: () => void; reject: (error: CloudError) => void; timer: ReturnType<typeof setTimeout> }>();
    let resolveReady: (room: CloudRoom) => void, rejectReady: (error: CloudError) => void;
    const ready = new Promise<CloudRoom>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const notify = () => { for (const listener of listeners) { try { listener(); } catch { console.warn("房间订阅回调失败"); } } };
    const state = (value: CloudRoomStatus) => { status = value; notify(); };
    const rejectPending = () => { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new CloudError("NETWORK", "连接已中断，事件可能已送达；不会自动重发")); } pending.clear(); };
    const enabled = () => !closed && owner === cachedAccountId() && activeApps.has(appId) && AppState.currentState === "active";
    const stop = () => {
      revision++; opening = false;
      if (retry) clearTimeout(retry); retry = undefined;
      if (expiration) clearTimeout(expiration); expiration = undefined;
      const previous = socket; socket = undefined; previous?.close(); rejectPending();
    };
    const schedule = () => {
      if (!enabled() || retry) return;
      state("reconnecting");
      retry = setTimeout(() => { retry = undefined; void connect(); }, Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) + Math.random() * 500);
    };
    const connect = async () => {
      if (!enabled() || opening || socket) return;
      opening = true; const epoch = revision;
      try {
        const next = await accountSocket(`/v1/app-rooms/${appId}/${id}/live`);
        if (!enabled() || revision !== epoch) { next.close(); return; }
        socket = next;
        const valid = () => socket === next && enabled();
        next.onmessage = message => {
          if (!valid()) return;
          try {
            const data = JSON.parse(String(message.data));
            if (data.type === "ready") {
              attempt = 0; sequence = data.sequence; members = data.members; state("connected"); resolveReady!(room);
              // Reauthenticate before the server's five-minute session expires.
              expiration = setTimeout(() => { stop(); if (enabled()) void connect(); }, 270000);
            } else if (data.type === "members") { members = data.members; notify(); }
            else if (data.type === "changed") { notify(); }
            else if (data.type === "event" && data.sequence > sequence) {
              sequence = data.sequence;
              for (const callback of events.get(data.event) ?? []) { try { callback({ data: data.data, senderId: data.senderId, sequence }); } catch { console.warn("房间事件回调失败"); } }
            } else if (data.type === "ack" || data.type === "error") {
              const task = pending.get(data.requestId); if (!task) return;
              pending.delete(data.requestId); clearTimeout(task.timer);
              if (data.type === "ack") task.resolve(); else task.reject(new CloudError(data.code === "RATE_LIMITED" ? "RATE_LIMITED" : "INVALID_ARGUMENT", data.message || "事件发送失败"));
            }
          } catch { /* Ignore malformed frames without exposing payloads. */ }
        };
        next.onclose = () => { if (socket !== next) return; socket = undefined; if (expiration) clearTimeout(expiration); expiration = undefined; rejectPending(); schedule(); };
        next.onerror = () => { if (socket === next) next.close(); };
      } catch { schedule(); }
      finally { if (epoch === revision) opening = false; }
    };
    const client = { appId, refresh: () => {
      if (closed) return;
      if (!enabled()) { stop(); members = []; state("paused"); resolveReady!(room); }
      else { if (status === "paused") state("connecting"); void connect(); }
    }, leave: () => room.leave() };
    const room: CloudRoom = {
      id, get status() { return status; }, get members() { return members.map(member => ({ ...member })); },
      collection<T extends object>(name: string): CloudCollection<T> {
        if (closed || owner !== cachedAccountId()) throw new CloudError("ACCOUNT_CHANGED", "房间已关闭，请重新加入");
        const collection = cloudDatabase(appId, "room", id).collection<T>(name);
        const check = () => { if (closed || owner !== cachedAccountId()) throw new CloudError("ACCOUNT_CHANGED", "房间已关闭，请重新加入"); };
        return {
          create: (data, options) => { check(); return collection.create(data, options); },
          get: (recordId, options) => { check(); return collection.get(recordId, options); },
          list: (query, options) => { check(); return collection.list(query, options); },
          update: (recordId, patch, options) => { check(); return collection.update(recordId, patch, options); },
          increment: (recordId, amounts, options) => { check(); return collection.increment(recordId, amounts, options); },
          remove: (recordId, options) => { check(); return collection.remove(recordId, options); },
        };
      },
      subscribe: listener => { if (closed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
      on: (event, listener) => {
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(event)) throw new CloudError("INVALID_ARGUMENT", "事件名称无效");
        if (closed) return () => {};
        let group = events.get(event); if (!group) { group = new Set(); events.set(event, group); }
        group.add(listener); return () => { group!.delete(listener); if (!group!.size) events.delete(event); };
      },
      send: async (event, data) => {
        if (!enabled() || status !== "connected" || socket?.readyState !== WebSocket.OPEN) throw new CloudError("UNAVAILABLE", "房间尚未连接");
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(event) || !data || typeof data !== "object" || Array.isArray(data)) throw new CloudError("INVALID_ARGUMENT", "事件参数无效");
        if (pending.size >= 16) throw new CloudError("RATE_LIMITED", "待发送事件过多");
        const requestId = `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        let payload: string; try { payload = JSON.stringify({ requestId, event, data }); } catch { throw new CloudError("INVALID_ARGUMENT", "事件必须是 JSON 数据"); }
        const bytes = Array.from(payload).reduce((n, char) => n + (char.codePointAt(0)! < 128 ? 1 : char.codePointAt(0)! < 2048 ? 2 : char.codePointAt(0)! < 65536 ? 3 : 4), 0);
        if (bytes > 16384) throw new CloudError("INVALID_ARGUMENT", "事件不能超过 16 KB");
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => { pending.delete(requestId); reject(new CloudError("UNAVAILABLE", "事件确认超时，可能已送达；不会自动重发")); }, 15000);
          pending.set(requestId, { resolve, reject, timer });
          try { socket!.send(payload); } catch { clearTimeout(timer); pending.delete(requestId); reject(new CloudError("NETWORK", "事件发送失败")); }
        });
      },
      leave: () => {
        if (closed) return; closed = true; stop(); members = []; state("closed"); clients.delete(client);
        clearTimeout(deadline); options?.signal?.removeEventListener("abort", cancel); listeners.clear(); events.clear();
        rejectReady!(new CloudError(owner !== cachedAccountId() ? "ACCOUNT_CHANGED" : "CANCELLED", "房间已关闭"));
      },
    };
    const cancel = () => room.leave();
    const deadline = setTimeout(() => { rejectReady!(new CloudError("UNAVAILABLE", "房间连接超时")); room.leave(); }, 20000);
    ready.then(() => clearTimeout(deadline), () => clearTimeout(deadline));
    clients.add(client); options?.signal?.addEventListener("abort", cancel);
    if (options?.signal?.aborted) cancel(); else client.refresh();
    return ready;
  } };
}
