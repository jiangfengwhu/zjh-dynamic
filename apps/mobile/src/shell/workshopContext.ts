import { applicationAi } from "../../../../packages/app-sdk/src/ai";
import { readPackageValue, writePackageValue, removePackageValue, subscribePackageValue } from "../../../../packages/ui/packageLink";
import { cachedAccountId, subscribeAccountIdentity } from "./account";
import { shellNavigationRef } from "./navigationRef";

// Preserve persisted drafts and progress keys. This is a storage namespace,
// not an application ID, runtime, module allocation or installation.
const namespace = "application.jolly.accounts.";
const account = () => cachedAccountId() || "guest";
const key = (value: string) => `${namespace}${account()}.${value}`;
const context = {
  storage: {
    get: (value: string) => value === "__accountScope" ? account() : readPackageValue(key(value)),
    set: (value: string, text: string) => writePackageValue(key(value), text),
    remove: (value: string) => removePackageValue(key(value)),
    subscribe: (value: string, listener: (text: string | undefined) => void) => {
      let off = subscribePackageValue(key(value), listener);
      const offAccount = subscribeAccountIdentity(() => {
        off(); off = subscribePackageValue(key(value), listener);
        listener(context.storage.get(value));
      });
      return () => { off(); offAccount(); };
    },
  },
  ai: applicationAi(() => { if (shellNavigationRef.isReady()) shellNavigationRef.navigate("providers"); }),
};
export const workshopContext = () => context;
