import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleRelease, parseBundleOptions } from "../tools/release/bundle-js.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const summary = process.env.EVOLVE_SUMMARY?.trim() || "线上定制";
const flags = parseBundleOptions(process.argv.slice(2));
console.log(`cloud publish summary=${summary.slice(0, 80)} vendor=${flags.forceVendor}`);
const result = await bundleRelease(repoRoot, summary, { publish: true, ...flags });
console.log(
  JSON.stringify({
    id: result.release.id,
    published: result.published,
    vendorRebuilt: result.vendorRebuilt,
    vendor: result.release.vendor.sha256,
    app: result.release.app.sha256,
    appBytes: result.release.app.bytes,
    plugins: result.release.plugins.map((plugin) => plugin.id),
  }),
);
