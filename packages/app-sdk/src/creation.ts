import type * as cloud from "../../../apps/mobile/src/shell/cloudEvolve";
import type * as updates from "../../../apps/mobile/src/shell/packageUpdates";
export type CreationService = typeof cloud & Pick<typeof updates, "checkPackageUpdates" | "applyPackageUpdates"> & {
  readPreference: (key: string) => Promise<string | undefined>;
  writePreference: (key: string, value: string) => void;
};
export function getCreationService(): CreationService { throw new Error("当前应用未获得制作能力"); }
