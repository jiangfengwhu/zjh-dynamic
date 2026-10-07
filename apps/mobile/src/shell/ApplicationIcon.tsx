import { useEffect, useState, useSyncExternalStore } from "react";
import { SvgXml } from "react-native-svg";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import type { ApplicationManifest } from "../../../../packages/app-sdk/src";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { edgeUrl } from "./evolveHost";
import { readShellValue, readShellValueSync, writeShellValue, removeShellValue } from "./shellStorage";

const overrides = new Map<string, string>();
const listeners = new Set<() => void>();
export function rememberApplicationIcon(appId: string, url: string) {
  if (overrides.get(appId) === url) return;
  overrides.set(appId, url);
  writeShellValue(`shell.application.icon.${appId}`, url);
  listeners.forEach(listener => listener());
}
const xmlCache = new Map<string, string>();
const flights = new Map<string, Promise<string>>();
let indexUpdate: Promise<void> = Promise.resolve();
function loadSvg(hash: string) {
  const memory = xmlCache.get(hash);
  if (memory) return Promise.resolve(memory);
  const existing = flights.get(hash);
  if (existing) return existing;
  const promise = (async () => {
    const key = `shell.application.svg.${hash}`;
    const cached = await readShellValue(key);
    if (cached) { xmlCache.set(hash, cached); return cached; }
    const response = await fetch(`${edgeUrl}/v1/app/${hash}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("图标加载失败");
    const xml = await response.text();
    if (xml.length > 65536 || !/^\s*<svg\b/.test(xml)) throw new Error("图标格式无效");
    xmlCache.set(hash, xml); writeShellValue(key, xml);
    indexUpdate = indexUpdate.catch(() => {}).then(async () => {
      let index: string[] = [];
      try { const stored = JSON.parse(await readShellValue("shell.application.svg-index") || "[]"); if (Array.isArray(stored)) index = stored.filter(value => typeof value === "string"); } catch {}
      const next = [...index.filter(value => value !== hash), hash];
      for (const old of next.splice(0, Math.max(0, next.length - 64))) { xmlCache.delete(old); removeShellValue(`shell.application.svg.${old}`); }
      writeShellValue("shell.application.svg-index", JSON.stringify(next));
    });
    await indexUpdate;
    return xml;
  })().finally(() => flights.delete(hash));
  flights.set(hash, promise);
  return promise;
}

/** The same independently cached icon everywhere, without loading an application bundle. */
export function ApplicationIcon({ application, size }: {
  application: { manifest: Pick<ApplicationManifest, "appId" | "accent" | "icon">; iconUrl?: string };
  size: number;
  animated?: boolean;
}) {
  const app = application.manifest;
  const override = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => overrides.get(app.appId) ?? readShellValueSync(`shell.application.icon.${app.appId}`) ?? "");
  const url = application.iconUrl || override;
  const hash = app.icon?.sha256;
  const [svg, setSvg] = useState<{ hash: string; xml: string }>();
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let live = true;
    if ((!url || failed === url) && hash && /^[a-f0-9]{64}$/.test(hash)) void loadSvg(hash).then(xml => { if (live) setSvg({ hash, xml }); }).catch(() => {});
    return () => { live = false; };
  }, [hash, url, failed]);
  if (url && failed !== url) return <AppImage source={{ uri: url }} resizeMode="cover" resizeMethod="resize" resizeMultiplier={1.5} fadeDuration={0} style={{ width: size, height: size, borderRadius: size / 5 }} onError={() => setFailed(url)} />;
  const xml = hash ? xmlCache.get(hash) ?? (svg?.hash === hash ? svg.xml : undefined) : undefined;
  if (xml && failed !== hash) return <SvgXml xml={xml} width={size} height={size} onError={() => setFailed(hash!)} />;
  return <SymbolIcon name="box" size={Math.min(size * 0.7, 40)} color={app.accent} />;
}
