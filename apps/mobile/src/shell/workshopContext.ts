import { applicationAi } from "../../../../packages/app-sdk/src/ai";
import { readPackageValue, writePackageValue, removePackageValue, subscribePackageValue } from "../../../../packages/ui/packageLink";
import { cachedAccountId, subscribeAccountIdentity } from "./account";
import { shellNavigationRef } from "./navigationRef";

const namespace = "shell.workshop.accounts.";
const account = () => cachedAccountId() || "guest";
const key = (value: string) => `${namespace}${account()}.${value}`;
const context = {
  account,
  storage: {
    get: (value: string) => readPackageValue(key(value)),
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
