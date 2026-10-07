import { useCallback, useEffect, useRef, useState } from "react";
import { installedMarket, type MarketApplication } from "../market";
import { subscribeCatalog } from "../catalog";
import { useAccount, currentAccountId } from "../account";

/** Local launch targets; opening this page never downloads public app metadata. */
export function useInstalledShortcuts(active: boolean) {
  const { user } = useAccount();
  const [state, setState] = useState<{
    owner: string | undefined;
    items: MarketApplication[];
    loaded: boolean;
    error: string;
  }>({ owner: undefined, items: [], loaded: false, error: "" });
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const token = ++revision.current;
    const owner = await currentAccountId();
    try {
      const items = await installedMarket();
      if (revision.current !== token || (await currentAccountId()) !== owner)
        return false;
      setState({ owner, items, loaded: true, error: "" });
      return true;
    } catch {
      if (revision.current === token)
        setState((previous) => ({
          owner,
          items: previous.owner === owner ? previous.items : [],
          loaded: true,
          error: "应用暂时无法读取，下拉重试",
        }));
      return false;
    }
  }, []);
  useEffect(() => {
    if (!active) return;
    let pending: ReturnType<typeof requestIdleCallback> | undefined;
    const schedule = () => {
      if (pending !== undefined) cancelIdleCallback(pending);
      pending = requestIdleCallback(() => {
        pending = undefined;
        void refresh();
      });
    };
    schedule();
    const off = subscribeCatalog(schedule);
    return () => {
      off();
      revision.current++;
      if (pending !== undefined) cancelIdleCallback(pending);
    };
  }, [active, refresh, user?.id]);
  return {
    items: state.owner === user?.id ? state.items : [],
    loaded: state.loaded && state.owner === user?.id,
    error: state.error,
    refresh,
  };
}
