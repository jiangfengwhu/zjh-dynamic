import { createElement, useEffect, useState, type ComponentType } from "react";
import { View } from "react-native";
import { useIsFocused, useRoute } from "@react-navigation/native";

/** A stable component boundary; the module is evaluated on the first visit. */
export function lazyScreen<P extends object>(load: () => ComponentType<P>, afterPaint = false): ComponentType<P> {
  let screen: ComponentType<P> | undefined;
  if (afterPaint) return function DeferredScreen(props: P) {
    const focused = useIsFocused();
    const route = useRoute();
    const [loaded, setLoaded] = useState<{ component?: ComponentType<P>; error?: unknown }>(() => ({ component: screen }));
    useEffect(() => {
      if (loaded.component || loaded.error || !focused) return;
      let nextFrame: number | undefined;
      // Let the selected route paint before evaluating its module. Never
      // preload hidden routes; keep the resolved component for future visits.
      const frame = requestAnimationFrame(() => {
        nextFrame = requestAnimationFrame(() => {
          try {
            const started = performance.now();
            screen ??= load();
            console.log("route module loaded", route.name, "elapsedMs", Math.round(performance.now() - started));
            setLoaded({ component: screen });
          }
          catch (error) { setLoaded({ error }); }
        });
      });
      return () => { cancelAnimationFrame(frame); if (nextFrame !== undefined) cancelAnimationFrame(nextFrame); };
    }, [focused, loaded, route.name]);
    if (loaded.error) throw loaded.error;
    return loaded.component ? createElement(loaded.component, props) : <View style={{ flex: 1 }} />;
  };
  return function LazyScreen(props: P) {
    return createElement(screen ??= load(), props);
  };
}
