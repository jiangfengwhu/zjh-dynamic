import { shellNavigationRef } from "./navigationRef";
import { cachedAccountId, requireAccount } from "./account";

export type CreationIntent = {
  appId: string;
  title: string;
  releaseId?: string;
  originalAppId?: string;
  fork?: boolean;
  ownerId?: string;
  prompt?: string;
};
export type CreationInput = { prompt: string; images: string[] };

/** Enter immediately; ownership and source checks happen during submission. */
export function openCreationComposer(intent?: CreationIntent) {
  const open = () => {
    if (shellNavigationRef.isReady())
      shellNavigationRef.dispatch({
        type: "PUSH",
        payload: {
          name: "composePost",
          params: { mode: "create", creation: intent },
        },
      });
  };
  if (cachedAccountId()) open();
  else
    void requireAccount().then((allowed) => {
      if (allowed) open();
    });
}
