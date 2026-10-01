import type { ApplicationManifest } from "./index";
export type CloudTrace = { id: string; kind: "text" | "tool" | "status"; title: string; detail?: string; state: "running" | "done" | "error" };
export type JulesRun = { session: string; prompt: string; startedAt: number };
export type CloudOutcome = "finished" | "cancelled" | "waiting";
export type WatchOptions = { onStatus: (status: string) => void; onTrace: (traces: CloudTrace[]) => void; shouldStop: () => boolean };
export type PendingPackage = { id: string; kind: "layer" | "application"; bytes: number; sha256: string };
export type WorkshopStatus = { completed: boolean; collected?: boolean; /** @deprecated Use collected. */ merged: boolean; branch?: string; state: string; delivery?: "unpublished" | "blocked" | "update" | "loaded"; message?: string; application?: ApplicationManifest };
export type CreationService = {
  runCloudEvolve: (options: WatchOptions & { requirement: string; onRunId: (session: string) => void }) => Promise<CloudOutcome>;
  cancelCloudRun: (session: string) => Promise<void>;
  loadJulesRun: () => Promise<JulesRun | undefined>;
  saveJulesRun: (run: JulesRun) => void;
  clearJulesRun: () => void;
  clearJulesSession: () => void;
  loadJulesSession: () => Promise<string>;
  inspectJulesSession: (session: string) => Promise<{ state: string; url: string; title: string; startedAt: number } | undefined>;
  julesSessionLive: (state: string) => boolean;
  watchJulesSession: (session: string, url: string, options: WatchOptions, sinceMs: number) => Promise<CloudOutcome>;
  workshopStatus: (session: string) => Promise<WorkshopStatus>;
  confirmWorkshop: (session: string) => Promise<void>;
  checkPackageUpdates: () => Promise<PendingPackage[]>;
  applyPackageUpdates: () => Promise<number>;
  readPreference: (key: string) => Promise<string | undefined>;
  writePreference: (key: string, value: string) => void;
};
export function getCreationService(appId: string, originalAppId?: string): CreationService { throw new Error("当前应用未获得制作能力"); }
