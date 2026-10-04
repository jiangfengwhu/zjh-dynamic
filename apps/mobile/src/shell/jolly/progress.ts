import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouteContentReady } from "../useRouteContentReady";
import { applicationContext } from "../../../../../packages/app-sdk/src/runtime";
const getAppContext = () => applicationContext("jolly");
import { type WorkshopDetail } from "../../../../../packages/app-sdk/src/creation";
import { creationService as getCreationService } from "../cloudEvolve";
import { noteJollyRun, readJollyRun, type WorkshopStage } from "./run";

export type ProgressState =
  | "queued"
  | "making"
  | "packing"
  | "ready"
  | "reply"
  | "paused"
  | "failed"
  | "blocked";
export type ProgressSnapshot = {
  session: string;
  submissionId?: string;
  startedAt?: number;
  detail: WorkshopDetail;
  at: number;
};

export function progressState(detail: WorkshopDetail): ProgressState {
  const { status } = detail;
  if (status.state === "FAILED") return "failed";
  if (status.state === "PAUSED") return "paused";
  if (status.state === "AWAITING_USER_FEEDBACK") return "reply";
  if (
    status.completed &&
    status.application &&
    ["update", "loaded"].includes(status.delivery || "")
  )
    return "ready";
  if (status.delivery === "blocked") return "blocked";
  if (status.completed) return "packing";
  if (status.state === "QUEUED") return "queued";
  return "making";
}

export const progressLabels: Record<ProgressState, string> = {
  queued: "等待开始",
  making: "正在制作",
  packing: "正在交付",
  ready: "制作完成",
  reply: "等待你的回复",
  paused: "制作已暂停",
  failed: "制作未完成",
  blocked: "交付需要处理",
};

export function useProgress(
  appId: string | undefined,
  originalAppId: string | undefined,
  scope: string
) {
  const context = getAppContext();
  const focused = useIsFocused();
  const routeReady = useRouteContentReady();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );
  const active = focused && foreground && routeReady;
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>();
  const [checking, setChecking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [service] = useState(() =>
    appId ? getCreationService(appId, originalAppId) : undefined
  );
  const alive = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  const flight = useRef<Promise<void>>();
  const wish = useRef("");
  const valid = () =>
    alive.current &&
    activeRef.current &&
    (context.storage.get("__accountScope") || "guest") === scope;
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => {
      alive.current = false;
      subscription.remove();
    };
  }, []);

  const refresh = useCallback(() => {
    if (flight.current) return flight.current;
    if (!valid() || !service || !appId) return Promise.resolve();
    setChecking(true);
    const operation = (async () => {
      try {
        let run = await service.loadJulesRun();
        const currentSession =
          run?.session || (await service.loadJulesSession());
        if (!run) run = await service.loadJulesRun();
        if (!valid()) return;
        wish.current = run?.prompt || readJollyRun(appId).wish;
        setSnapshot((previous) =>
          previous &&
          (previous.submissionId !== run?.submissionId ||
            previous.startedAt !== run?.startedAt)
            ? undefined
            : previous
        );
        if (!currentSession) {
          setSnapshot(undefined);
          setLoaded(true);
          setError("");
          return;
        }
        const detail = await service.readWorkshopDetail(currentSession);
        if (!valid()) return;
        const latest = await service.loadJulesRun();
        if (!valid()) return;
        if (
          latest?.submissionId !== run?.submissionId ||
          latest?.startedAt !== run?.startedAt
        )
          throw new Error("制作轮次已更新，正在同步最新进度");
        if (!detail) throw new Error("暂时无法读取制作进度，请重试");
        setSnapshot({
          session: currentSession,
          submissionId: run?.submissionId,
          startedAt: run?.startedAt,
          detail,
          at: Date.now(),
        });
        setLoaded(true);
        setError("");
      } catch (cause) {
        if (valid()) {
          setError(
            cause instanceof Error ? cause.message : "进度同步失败，请重试"
          );
          setLoaded(true);
        }
      } finally {
        if (alive.current) setChecking(false);
      }
    })();
    flight.current = operation;
    void operation.finally(() => {
      if (flight.current === operation) flight.current = undefined;
    });
    return operation;
  }, [service, appId, scope]);

  useEffect(() => {
    if (!active || !service) return;
    const task = requestIdleCallback(() => {
      void refresh();
    });
    return () => cancelIdleCallback(task);
  }, [active, service, refresh]);
  useEffect(() => {
    if (!active || (!snapshot && !error)) return;
    const state = snapshot ? progressState(snapshot.detail) : "queued";
    if (
      !snapshot?.detail.stale &&
      !error &&
      !["queued", "making", "packing"].includes(state)
    )
      return;
    let pending: ReturnType<typeof requestIdleCallback> | undefined;
    const timer = setInterval(() => {
      if (!activeRef.current) return;
      if (pending !== undefined) return;
      pending = requestIdleCallback(() => {
        pending = undefined;
        void refresh();
      });
    }, 10000);
    return () => {
      clearInterval(timer);
      if (pending !== undefined) cancelIdleCallback(pending);
    };
  }, [active, snapshot, error, refresh]);
  useEffect(() => {
    if (!active || !appId || !snapshot) return;
    let cancelled = false;
    const task = requestIdleCallback(() => {
      void (async () => {
        const run = await service?.loadJulesRun();
        if (
          cancelled ||
          !alive.current ||
          !activeRef.current ||
          run?.session !== snapshot.session ||
          run?.submissionId !== snapshot.submissionId ||
          run?.startedAt !== snapshot.startedAt ||
          (context.storage.get("__accountScope") || "guest") !== scope
        )
          return;
        const state = progressState(snapshot.detail);
        const stage: WorkshopStage =
          state === "queued" || state === "making"
            ? "making"
            : state === "packing"
            ? "making"
            : state === "ready"
            ? snapshot.detail.status.delivery === "loaded"
              ? "ready"
              : "load"
            : state;
        noteJollyRun({
          appId,
          phase:
            state === "ready"
              ? "ready"
              : state === "failed"
              ? "failed"
              : state === "paused"
              ? "stopped"
              : "making",
          stage,
          wish: wish.current || readJollyRun(appId).wish,
          status: snapshot.detail.status.message || progressLabels[state],
          steps: [],
        });
      })().catch(() => {});
    });
    return () => {
      cancelled = true;
      cancelIdleCallback(task);
    };
  }, [active, appId, snapshot, scope, service]);
  return {
    snapshot,
    checking,
    error,
    loaded,
    active,
    refresh,
  };
}
