import { cachedAccountId, currentAccountId } from "./account";
import { cachedPage } from "./pageCache";
import { fetchMarketPage, type MarketApplication, type MarketPage } from "./market";
import { resolvePublicApplicationExperience, validateApplication } from "../runtime/applications";
import { downloadApplicationResources } from "../runtime/applicationDownloads";
import { markStartup } from "../runtime/startupTiming";

type FirstPage = { owner?: string; at: number; settled: boolean; request: Promise<MarketPage> };
let firstPage: FirstPage | undefined;
let startupBegun = false;

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
  if (startupBegun) return;
  startupBegun = true;
  firstPage ??= requestFirstPage(true);
}

function requestFirstPage(warm: boolean): FirstPage {
  const entry: FirstPage = { at: Date.now(), settled: false, request: undefined! };
  entry.request = currentAccountId().then(id => {
    const owner = id ?? "guest";
    entry.owner = owner;
    entry.at = Date.now();
    if (warm) {
      markStartup("account-restored");
      warmFirst(cachedPage<MarketApplication[]>(`discovery-start:${owner}`) ?? []);
      markStartup("discovery-request-start");
    }
    return fetchMarketPage("", "", undefined, true).then(page => {
      if (warm && owner === (cachedAccountId() ?? "guest")) warmFirst(page.applications);
      if (warm) markStartup("discovery-data-ready");
      return page;
    });
  }).finally(() => { entry.settled = true; entry.at = Date.now(); });
  // A deep link may bypass discovery; still observe rejected warm requests.
  void entry.request.catch(() => { if (firstPage === entry) firstPage = undefined; });
  return entry;
}

export function takeDiscoveryFirstPage(): Promise<MarketPage> {
  let cached = firstPage;
  if (!cached || (cached.owner !== undefined && cached.owner !== (cachedAccountId() ?? "guest")) || (cached.settled && Date.now() - cached.at >= 15000))
    firstPage = cached = requestFirstPage(false);
  const entry = cached;
  // Retain in-flight work so all consumers join it, including before login restoration.
  return entry.request.finally(() => { if (firstPage === entry) firstPage = undefined; });
}
