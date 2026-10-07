import { cachedPage, rememberPage, pageCacheKey } from "./pageCache";
import { useRoute } from "@react-navigation/native";
import { PageSkeleton } from "./LoadingSkeleton";
import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useTheme } from "../../../../packages/ui/theme";
import { markStartup } from "../runtime/startupTiming";

// Prepare one hidden scene at a time, waiting for its React commit before
// advancing. Clicking a tab always gets priority over this optional work.
const warmups = new Map<symbol, () => void>();
let preparing: symbol | undefined;
let pendingIdle: ReturnType<typeof requestIdleCallback> | undefined;
let cooldown: ReturnType<typeof setTimeout> | undefined;
let resumeAt = Date.now() + 1000;
let tabsActive = true;
let foregroundSubscription: ReturnType<typeof AppState.addEventListener> | undefined;

function cancelPendingWarmup() {
  if (pendingIdle !== undefined) cancelIdleCallback(pendingIdle);
  if (cooldown !== undefined) clearTimeout(cooldown);
  pendingIdle = undefined;
  cooldown = undefined;
}

function scheduleWarmup() {
  if (
    !tabsActive || !warmups.size || preparing ||
    pendingIdle !== undefined || cooldown !== undefined ||
    AppState.currentState !== "active"
  ) return;
  const remaining = resumeAt - Date.now();
  if (remaining > 0) {
    cooldown = setTimeout(() => {
      cooldown = undefined;
      scheduleWarmup();
    }, remaining);
    return;
  }
  pendingIdle = requestIdleCallback(() => {
    pendingIdle = undefined;
    if (!tabsActive || AppState.currentState !== "active") return;
    const next = warmups.entries().next().value;
    if (!next) return;
    preparing = next[0];
    next[1]();
  });
}

export function prioritizeShellTab() {
  cancelPendingWarmup();
  // Let the selected tab and its short indicator feedback paint first.
  resumeAt = Math.max(resumeAt, Date.now() + 200);
  scheduleWarmup();
}

export function setShellTabWarmupActive(active: boolean) {
  tabsActive = active;
  cancelPendingWarmup();
  if (active) prioritizeShellTab();
}

function registerWarmup(key: symbol, prepare: () => void) {
  warmups.set(key, prepare);
  if (!foregroundSubscription) foregroundSubscription = AppState.addEventListener("change", state => {
    if (state === "active") scheduleWarmup();
    else cancelPendingWarmup();
  });
  scheduleWarmup();
  return () => {
    warmups.delete(key);
    if (preparing === key) preparing = undefined;
    if (!warmups.size) {
      cancelPendingWarmup();
      foregroundSubscription?.remove();
      foregroundSubscription = undefined;
    } else scheduleWarmup();
  };
}

/** Retain each scene after its first foreground or idle preparation. */
export function ShellTabScene({ children, immediate = false }: { children: ReactNode; immediate?: boolean }) {
  const focused = useIsFocused();
  const route = useRoute();
  const cacheKey = pageCacheKey(`scene:${route.name}`);
  const previouslyPrepared = !!cachedPage(cacheKey);
  const [ready, setReady] = useState(focused && (immediate || previouslyPrepared));
  useEffect(() => {
    if (ready) {
      rememberPage(cacheKey, true);
      markStartup(`tab-${route.name}-ready`);
    }
  }, [ready, cacheKey, route.name]);
  const key = useRef(Symbol("shell-tab")).current;
  const { colors } = useTheme();
  useEffect(() => {
    if (ready) return;
    if (!focused) return registerWarmup(key, () => startTransition(() => setReady(true)));
    prioritizeShellTab();
    if (immediate) { setReady(true); return; }
    let idle: ReturnType<typeof requestIdleCallback> | undefined;
    const frame = requestAnimationFrame(() => {
      idle = requestIdleCallback(() => startTransition(() => setReady(true)));
    });
    return () => {
      cancelAnimationFrame(frame);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [focused, ready, key, immediate]);
  return ready || (immediate && focused) ? children : (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.canvas }}>
      {focused && !previouslyPrepared ? <PageSkeleton rows={4} /> : null}
    </View>
  );
}
