import { cachedAccountId, currentAccountId } from "./account";
import { cachedPage } from "./pageCache";
import { fetchMarketPage, type MarketApplication, type MarketPage } from "./market";
import { resolvePublicApplicationExperience, validateApplication } from "../runtime/applications";
import { downloadApplicationResources } from "../runtime/applicationDownloads";
import { markStartup } from "../runtime/startupTiming";

let firstPage: { owner: string; at: number; request: Promise<MarketPage> } | undefined;

function warmFirst(items: readonly MarketApplication[]) {
  const first = items[0];
  if (!first) return;
  try {
    const { manifest } = resolvePublicApplicationExperience(first);
    validateApplication(manifest);
    // Download only: no application evaluation, installation or UI work here.
    void downloadApplicationResources(manifest, undefined, "visible").catch(() => {});
  } catch { /* The visible page owns compatibility errors and retry. */ }
}

/** Start keychain IO before requiring the UI, then overlap first-page IO with layout. */
export function beginDiscoveryStartup() {
  void currentAccountId().then(id => {
    const owner = id ?? "guest";
    markStartup("account-restored");
    warmFirst(cachedPage<MarketApplication[]>(`discovery-start:${owner}`) ?? []);
    markStartup("discovery-request-start");
    const request = fetchMarketPage("", "", undefined, true).then(page => {
      if (owner === (cachedAccountId() ?? "guest")) warmFirst(page.applications);
      markStartup("discovery-data-ready");
      return page;
    });
    firstPage = { owner, at: Date.now(), request };
    // Navigation may open a deep link instead of consuming this request.
    void request.catch(() => {});
  }).catch(() => {});
}

export function takeDiscoveryFirstPage(): Promise<MarketPage> {
  const cached = firstPage;
  firstPage = undefined;
  return cached && cached.owner === (cachedAccountId() ?? "guest") && Date.now() - cached.at < 15000
    ? cached.request : fetchMarketPage("", "", undefined, true);
}
