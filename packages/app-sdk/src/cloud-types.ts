export type AppUser = { id: string; name: string; avatarUrl: string | null };
export interface AppAuth {
  /** Cached host profile; does not make a network request. */
  getUser(): AppUser | null;
  subscribe(listener: (user: AppUser | null) => void): () => void;
  /** Call from a user action. Returns null when login is cancelled. */
  requireLogin(): Promise<AppUser | null>;
}
export type CloudErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID_ARGUMENT" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "NETWORK" | "CANCELLED" | "ACCOUNT_CHANGED" | "UNAVAILABLE";
export class CloudError extends Error {
  constructor(public readonly code: CloudErrorCode, message: string) { super(message); this.name = "CloudError"; }
}
export type CloudRecord<T> = { id: string; data: T; createdBy: string; createdAt: number; updatedAt: number; version: number };
export type CloudPage<T> = { items: CloudRecord<T>[]; nextCursor: string | null };
export type CloudRequestOptions = { signal?: AbortSignal };
export type CloudWriteOptions = CloudRequestOptions & {
  /** Reuse for retries of the same write; retained by the server for one hour. */
  requestId?: string;
};
export type CloudQuery<T> = {
  /** AND conditions, maximum 8. Top-level scalar fields only. */
  where?: { field: Extract<keyof T, string>; op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; value: string | number | boolean | null }[];
  /** Defaults to createdAt descending, with id as a stable tie breaker. */
  orderBy?: { field: Extract<keyof T, string> | "createdAt" | "updatedAt"; direction: "asc" | "desc" };
  /** Defaults to 20; maximum 100. */
  limit?: number;
  cursor?: string;
};
export interface CloudCollection<T extends object> {
  create(data: T, options?: CloudWriteOptions): Promise<CloudRecord<T>>;
  get(id: string, options?: CloudRequestOptions): Promise<CloudRecord<T> | null>;
  list(query?: CloudQuery<T>, options?: CloudRequestOptions): Promise<CloudPage<T>>;
  /** Shallow merge of top-level fields. Nested objects are replaced. */
  update(id: string, patch: Partial<T>, options?: CloudWriteOptions & { expectedVersion?: number }): Promise<CloudRecord<T>>;
  /** Atomically adds to top-level numeric fields; absent fields start at zero. */
  increment(id: string, amounts: Partial<Record<Extract<keyof T, string>, number>>, options?: CloudWriteOptions & { expectedVersion?: number }): Promise<CloudRecord<T>>;
  remove(id: string, options?: CloudWriteOptions & { expectedVersion?: number }): Promise<void>;
}
export interface CloudDatabase { collection<T extends object>(name: string): CloudCollection<T> }
export type CloudFile = { id: string; mime: string; bytes: number; createdAt: number; visibility: "private" | "public"; url?: string };
export interface CloudFiles {
  /** Uploads an existing relative application file. Defaults to private. */
  upload(path: string, options: CloudRequestOptions & { mime: string; visibility?: "private" | "public"; localScope?: "device" | "account"; requestId?: string }): Promise<CloudFile>;
  get(id: string, options?: CloudRequestOptions): Promise<CloudFile | null>;
  /** Downloads into an application-relative path; private files remain authenticated. */
  download(id: string, path: string, options?: CloudRequestOptions & { localScope?: "device" | "account" }): Promise<void>;
  remove(id: string, options?: CloudRequestOptions): Promise<void>;
}
export type CloudRoomStatus = "connecting" | "connected" | "reconnecting" | "paused" | "closed";
export type CloudRoomEvent = { data: Record<string, unknown>; senderId: string; sequence: number };
export type CloudRoomMember = { id: string; name: string; avatarUrl: string | null };
export interface CloudRoom extends CloudDatabase {
  readonly id: string;
  readonly status: CloudRoomStatus;
  readonly members: readonly CloudRoomMember[];
  /** Live events are transient. Persist recoverable state in room collections. */
  send(event: string, data: Record<string, unknown>): Promise<void>;
  on(event: string, listener: (event: CloudRoomEvent) => void): () => void;
  /** Observes status, members and collection changes; reread persisted state after reconnect. */
  subscribe(listener: () => void): () => void;
  /** Closes this connection; persisted room records remain. */
  leave(): void;
}
export interface CloudRooms {
  /** Room IDs are shareable: signed-in users with this app and ID can participate. */
  join(id: string, options?: CloudRequestOptions): Promise<CloudRoom>;
}
export interface AppCloud {
  /** Current user's data within this app. */
  private: CloudDatabase;
  /** Signed-in users may read; only the creator may update or remove. */
  public: CloudDatabase;
  files: CloudFiles;
  rooms: CloudRooms;
}
