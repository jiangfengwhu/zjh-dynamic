import { afterInteractions } from "./interactionWork";
import { createElement, useEffect, useState, type ComponentType } from "react";
import { View } from "react-native";
import { useIsFocused, useRoute } from "@react-navigation/native";

/** A stable component boundary; the module is evaluated on the first visit. */
export function lazyScreen<P extends object>(load: () => ComponentType<P>, afterPaint = false, deferCached = false): ComponentType<P> {
  let screen: ComponentType<P> | undefined;
  if (afterPaint) return function DeferredScreen(props: P) {
    const focused = useIsFocused();
    const route = useRoute();
    const [loaded, setLoaded] = useState<{ component?: ComponentType<P>; error?: unknown }>(() => ({ component: deferCached ? undefined : screen }));
    useEffect(() => {
      if (loaded.component || loaded.error || !focused) return;
      return afterInteractions(() => {
        try {
          const started = performance.now();
          screen ??= load();
          console.log("route module loaded", route.name, "elapsedMs", Math.round(performance.now() - started));
          setLoaded({ component: screen });
        } catch (error) { setLoaded({ error }); }
      });
    }, [focused, loaded, route.name]);
    if (loaded.error) throw loaded.error;
    return loaded.component ? createElement(loaded.component, props) : <View style={{ flex: 1 }} />;
  };
  return function LazyScreen(props: P) {
    return createElement(screen ??= load(), props);
  };
}
