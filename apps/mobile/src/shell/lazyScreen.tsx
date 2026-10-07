import { createElement, type ComponentType } from "react";

/** A stable component boundary; the module is evaluated on the first visit. */
export function lazyScreen<P extends object>(load: () => ComponentType<P>): ComponentType<P> {
  let screen: ComponentType<P> | undefined;
  return function LazyScreen(props: P) {
    return createElement(screen ??= load(), props);
  };
}
