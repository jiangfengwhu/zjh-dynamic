import { Activity, useEffect, useRef, useState, type ReactNode } from "react";
import { Image, View } from "react-native";
import { captureRef, releaseCapture } from "react-native-view-shot";
import { afterInteractions } from "./interactionWork";
import { useTheme } from "../../../../packages/ui/theme";

/** Preserve pixels while Activity suspends covered or distant cached apps. */
export function RetainedApplicationPresentation({ active, foreground, retain, preview = false, children }: {
  active: boolean; foreground: boolean; retain: boolean; preview?: boolean; children: ReactNode;
}) {
  const { colors } = useTheme();
  const view = useRef<View>(null);
  const [snapshot, setSnapshot] = useState<{ uri: string; colors: typeof colors }>();
  const savedPixels = snapshot?.colors === colors ? snapshot.uri : undefined;
  const [suspended, setSuspended] = useState(false);
  const current = useRef({ active, foreground, retain, savedPixels }); current.current = { active, foreground, retain, savedPixels };
  useEffect(() => () => { if (snapshot) releaseCapture(snapshot.uri); }, [snapshot]);
  useEffect(() => {
    if (active || !retain) {
      setSuspended(false);
      // Restore the native tree before removing its saved presentation.
      let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setSnapshot(undefined)); });
      return () => cancelAnimationFrame(frame);
    }
    // A new neighbour may initialise while idle. A previously suspended one
    // keeps its saved pixels and effects asleep until it is actually selected.
    if (preview && !savedPixels) return;
    if (!foreground || savedPixels) return;
    let cancelled = false;
    const cancel = afterInteractions(() => {
      if (!view.current || cancelled) return;
      void captureRef(view, { format: "jpg", quality: 0.85, result: "tmpfile", handleGLSurfaceViewOnAndroid: true }).then(uri => {
        if (cancelled) { releaseCapture(uri); return; }
        setSnapshot({ uri, colors });
      }).catch(() => { /* Keep the real view if a native surface cannot be captured. */ });
    });
    return () => { cancelled = true; cancel(); };
  }, [active, foreground, retain, preview, suspended, colors]);
  return <View style={{ flex: 1 }}>
    <Activity mode={!foreground || (!active && (!retain || suspended && !!savedPixels)) ? "hidden" : "visible"}>
      <View ref={view} collapsable={false} style={{ flex: 1 }}>{children}</View>
    </Activity>
    {savedPixels && retain ? <Image pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      source={{ uri: savedPixels }} resizeMode="stretch" style={{ position: "absolute", inset: 0 }}
      key={savedPixels}
      onLoad={() => { const state = current.current; if (state.savedPixels === savedPixels && !state.active && state.foreground && state.retain) setSuspended(true); }}
      onError={() => { if (current.current.savedPixels === savedPixels) { setSuspended(false); setSnapshot(undefined); } }} /> : null}
  </View>;
}
