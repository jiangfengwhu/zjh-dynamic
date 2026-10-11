import { Activity, useEffect, useRef, useState, type ReactNode } from "react";
import { Image, View } from "react-native";
import { captureRef, releaseCapture } from "react-native-view-shot";
import { afterInteractions } from "./interactionWork";

/** Preserve pixels while Activity suspends effects in the covered current app. */
export function RetainedApplicationPresentation({ active, foreground, retain, children }: {
  active: boolean; foreground: boolean; retain: boolean; children: ReactNode;
}) {
  const view = useRef<View>(null);
  const [snapshot, setSnapshot] = useState<string>();
  const [suspended, setSuspended] = useState(false);
  const current = useRef({ active, foreground, retain, snapshot }); current.current = { active, foreground, retain, snapshot };
  useEffect(() => () => { if (snapshot) releaseCapture(snapshot); }, [snapshot]);
  useEffect(() => {
    if (active || !retain) {
      setSuspended(false);
      // Restore the native tree before removing its saved presentation.
      let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setSnapshot(undefined)); });
      return () => cancelAnimationFrame(frame);
    }
    if (!foreground || suspended) return;
    let cancelled = false;
    const cancel = afterInteractions(() => {
      if (!view.current || cancelled) return;
      void captureRef(view, { format: "jpg", quality: 0.85, result: "tmpfile", handleGLSurfaceViewOnAndroid: true }).then(uri => {
        if (cancelled) { releaseCapture(uri); return; }
        setSnapshot(uri);
      }).catch(() => { /* Keep the real view if a native surface cannot be captured. */ });
    });
    return () => { cancelled = true; cancel(); };
  }, [active, foreground, retain, suspended]);
  return <View style={{ flex: 1 }}>
    <Activity mode={!foreground || (!active && (!retain || suspended)) ? "hidden" : "visible"}>
      <View ref={view} collapsable={false} style={{ flex: 1 }}>{children}</View>
    </Activity>
    {snapshot && retain ? <Image pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      source={{ uri: snapshot }} resizeMode="stretch" style={{ position: "absolute", inset: 0 }}
      key={snapshot}
      onLoad={() => { const state = current.current; if (state.snapshot === snapshot && !state.active && state.foreground && state.retain) setSuspended(true); }}
      onError={() => { if (current.current.snapshot === snapshot) { setSuspended(false); setSnapshot(undefined); } }} /> : null}
  </View>;
}
