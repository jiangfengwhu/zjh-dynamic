import { AnimatedFlashList } from "./AnimatedFlashList";
import { waitForInteractions, afterInteractions } from "./interactionWork";
import { ApplicationIcon } from "./ApplicationIcon";
import { EmptyState } from "./EmptyState";
import { cachedPage, rememberPage, pageCacheKey } from "./pageCache";
import { ActivityIndicator } from "react-native";
import { PageSkeleton } from "./LoadingSkeleton";
import { useEffect, useRef, useState } from "react";
import { HostAlert } from "./HostAlert";
import NativePluginHost from "../NativePluginHost";
import { AppState, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { usePullToRefresh } from "./feed/pullToRefresh";
import { PullRefreshSurface } from "./feed/PullRefreshSurface";
import { useProfileScroll } from "./ProfileScroll";
import { Gesture } from "react-native-gesture-handler";
import { useIsFocused } from "@react-navigation/native";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { FormField } from "./FormField";
import { useAccount, currentAccountId } from "./account";
import { writeShellValue, removeShellValue } from "./shellStorage";
import { subscribeCatalog } from "./catalog";
import {
  installedMarket,
  fetchPublicMarketApplication,
  installMarketApplication,
  type MarketApplication,
} from "./market";
import {
  publicApplicationUpdates,
  applicationNeedsReload,
  validateApplication,
  checkApplicationUpdates,
  stageApplicationUpdates,
  loadApplication,
  type PublicApplicationUpdate,
} from "../runtime/applications";
import { openApplicationWorkshop } from "./workshopNavigation";
import { openCreationComposer } from "./creationComposer";
import { restoreWorks } from "./workRecovery";
import { readMyWorks, workLabels, type MyWork } from "./works";
import { WorkCard } from "./WorkCard";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { HostText as Text } from "./feed/HostText";
import { useTheme } from "../../../../packages/ui/theme";

/** One collection per surface: creations on profiles, installs in the market. */
export function MyApplicationsScreen({
  onBack,
  onCreate,
  onDetail,
  onManagePublication,
  onOpen,
  onSharePost,
  embedded = false,
  active = true,
  drawerGesture,
  scope = "works",
  searchQuery,
}: {
  onBack?: () => void;
  onCreate: () => void;
  onDetail: (item: MarketApplication) => void;
  onManagePublication?: (item: MarketApplication) => void;
  onOpen: (id: string) => void;
  onSharePost?: (item: MarketApplication) => void;
  embedded?: boolean;
  active?: boolean;
  drawerGesture?: ReturnType<typeof Gesture.Pan>;
  scope?: "works" | "installed";
  searchQuery?: string;
}) {
  const scrollY = useSharedValue(0);
  const profileScroll = useProfileScroll<Row>("works", scrollY);
  const refreshPull = usePullToRefresh({
    scrollY,
    onRefresh: () => refresh(true),
  });
  const { user } = useAccount();
  const { colors } = useTheme();
  const focused = useIsFocused() && active;
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const cacheKey = pageCacheKey(`applications:${scope}`);
  type Snapshot = { works: MyWork[]; installed: MarketApplication[] };
  const cached = cachedPage<Snapshot>(cacheKey);
  const [loaded, setLoaded] = useState(!!cached);
  const [works, setWorks] = useState<MyWork[]>(cached?.works ?? []);
  const [installed, setInstalled] = useState<MarketApplication[]>(cached?.installed ?? []);
  const [owner, setOwner] = useState<string | undefined>(cached ? user?.id : undefined);
  const [updates, setUpdates] = useState<
    Record<string, PublicApplicationUpdate>
  >({});
  const [updating, setUpdating] = useState("");
  const writing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState("");
  const [localQuery, setQuery] = useState("");
  const query = searchQuery ?? localQuery;
  const generation = useRef(0);
  const reading = useRef(false);
  const catalogChangedWhileReading = useRef(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  async function refresh(manual = false) {
    if (
      !focusedRef.current ||
      reading.current ||
      AppState.currentState !== "active"
    )
      return false;
    let succeeded = true;
    const before = ++generation.current;
    reading.current = true;
    catalogChangedWhileReading.current = false;
    setBusy(true);
    setPulling(manual);
    setError("");
    try {
      const apps = await installedMarket();
      if (scope === "works") {
        await restoreWorks(manual, true);
        const next = await readMyWorks(apps);
        await waitForInteractions();
        if (before !== generation.current) return;
        const snapshot = rememberPage(cacheKey, { works: next, installed: apps });
        setWorks(snapshot.works); setInstalled(snapshot.installed); setLoaded(true); setOwner(user?.id);
      } else {
        await waitForInteractions();
        if (before !== generation.current) return;
        const snapshot = rememberPage(cacheKey, { works: [], installed: apps });
        setInstalled(snapshot.installed); setLoaded(true); setOwner(user?.id);
        const [publicResult, ownResult] = await Promise.allSettled([
          publicApplicationUpdates(true),
          apps.some((app) => app.owned)
            ? restoreWorks(manual, true).then(() => readMyWorks(apps))
            : Promise.resolve([] as MyWork[]),
        ]);
        if (
          before !== generation.current ||
          (await currentAccountId()) !== user?.id
        )
          return;
        const result: Record<string, PublicApplicationUpdate> =
          publicResult.status === "fulfilled" ? publicResult.value : {};
        if (ownResult.status === "fulfilled")
          for (const app of apps.filter((app) => app.owned)) {
            const candidate = ownResult.value.find(
              (work) => work.appId === app.manifest.appId
            )?.manifest;
            if (!candidate) continue;
            try {
              validateApplication(candidate);
              result[app.manifest.appId] = {
                status:
                  candidate.releaseId === app.manifest.releaseId
                    ? "current"
                    : "update",
                manifest: candidate,
              };
            } catch {
              result[app.manifest.appId] = {
                status: "blocked",
                message: "新版需要更新平台后使用",
              };
            }
          }
        await waitForInteractions();
        if (before !== generation.current) return;
        setUpdates(result);
        if (
          publicResult.status === "rejected" ||
          ownResult.status === "rejected"
        ) {
          succeeded = false;
          setError("部分更新未能检查，下拉可重试。本机应用仍可直接打开。");
        }
      }
    } catch {
      if (scope === "works" && before === generation.current) {
        const apps = await installedMarket();
        const works = await readMyWorks(apps);
        await waitForInteractions();
        if (before === generation.current) { const snapshot = rememberPage(cacheKey, { works, installed: apps }); setWorks(snapshot.works); setInstalled(snapshot.installed); setLoaded(true); setOwner(user?.id); }
      }
      succeeded = false;
      if (before === generation.current)
        setError("暂时无法读取内容，下拉可重试。");
    } finally {
      if (before === generation.current) {
        reading.current = false;
        setBusy(false);
        setPulling(false);
        if (catalogChangedWhileReading.current) {
          catalogChangedWhileReading.current = false;
          setCatalogRevision(revision => revision + 1);
        }
      }
    }
    return succeeded;
  }
  useEffect(() => {
    if (focused) {
      const cancel = afterInteractions(() => { void refresh(); });
      return () => {
        cancel();
        generation.current++;
        reading.current = false;
      };
    }
  }, [focused, user?.id, scope, catalogRevision]);
  useEffect(() => {
    if (!focused) return;
    let cancelReload: (() => void) | undefined;
    const reload = () => {
      cancelReload?.();
      cancelReload = afterInteractions(() => {
        cancelReload = undefined;
        void refresh(false);
      });
    };
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    const offCatalog = subscribeCatalog(entries => {
      const ids = new Set(entries.filter(entry => !entry.trashedAt && !entry.purged).map(entry => entry.id));
      setInstalled(previous => previous.filter(app => ids.has(app.manifest.appId)));
      if (reading.current) catalogChangedWhileReading.current = true;
      else reload();
    });
    const offSharing = subscribePackageValue("shell.market.changed", reload);
    const offSnapshot = subscribePackageValue("shell.works.changed", reload);
    const offWorks = applicationContext("jolly").storage.subscribe(
      "workspaces",
      reload
    );
    return () => {
      cancelReload?.();
      appState.remove();
      offCatalog();
      offSharing();
      offSnapshot();
      offWorks();
    };
  }, [focused, user?.id, scope, works]);
  async function workshop(work: MyWork) {
    if (work.stage !== "making") {
      openCreationComposer({
        appId: work.appId,
        title: work.title,
        ownerId: user?.id,
        fork: false,
      });
      return;
    }
    await openApplicationWorkshop(work.appId, work.title, false, false);
  }
  function detail(work: MyWork, publication = false) {
    if (work.manifest)
      (publication && onManagePublication ? onManagePublication : onDetail)({
        manifest: work.manifest,
        title: work.title,
        summary: work.sharing?.shared?.summary ?? work.manifest.description,
        screenshots: work.sharing?.shared?.screenshots,
        authorId: user?.id ?? null,
        authorName: user?.name ?? "创作者",
        authorAvatarUrl: user?.avatarUrl,
        originalAppId: null,
        owned: true,
        sharing: work.sharing,
      });
  }
  async function update(item: MarketApplication) {
    if (writing.current) return;
    writing.current = true;
    setUpdating(item.manifest.appId);
    try {
      let manifest = item.manifest;
      let status: "pending" | "ready";
      if (applicationNeedsReload(item.manifest)) status = "pending";
      else if (item.owned) {
        await checkApplicationUpdates(item.manifest.appId);
        await stageApplicationUpdates(item.manifest.appId);
        const staged = (await installedMarket()).find(
          (app) => app.manifest.appId === item.manifest.appId
        );
        manifest = staged?.manifest || item.manifest;
        if (applicationNeedsReload(manifest)) status = "pending";
        else {
          await loadApplication(manifest.appId);
          status = "ready";
        }
      } else {
        const published = await fetchPublicMarketApplication(
          item.manifest.appId
        );
        manifest = published.manifest;
        validateApplication(manifest);
        status =
          (await installMarketApplication(published, {
            reloadLoaded: false,
          })) || "ready";
      }
      Toast.show({
        type: "success",
        text1:
          status === "pending"
            ? "新版已下载，下次启动生效"
            : "应用已更新，本机数据保留",
      });
      if (status === "pending")
        HostAlert.alert(
          "应用已更新，重新加载？",
          "新版已下载，本机数据保留。当前加载器需要重新加载整个 App 才能替换已运行的版本，其他页面会退出。",
          [
            { text: "稍后", style: "cancel" },
            {
              text: "重新加载",
              onPress: async () => {
                try {
                  writeShellValue(
                    "application.openAfterReload",
                    JSON.stringify({
                      appId: manifest.appId,
                      ownerId: await currentAccountId(),
                    })
                  );
                  const result = JSON.parse(
                    await NativePluginHost.call(
                      "shell",
                      "reloadApplications",
                      "{}"
                    )
                  ) as { ok?: boolean };
                  if (result.ok !== true) throw new Error("重新加载未完成");
                } catch {
                  removeShellValue("application.openAfterReload");
                  Toast.show({
                    type: "error",
                    text1: "重新加载失败，新版已保留",
                  });
                }
              },
            },
          ],
          { cancelable: true }
        );
      requestIdleCallback(() => void refresh(false));
    } catch (cause) {
      Toast.show({
        type: "error",
        text1: "更新未完成",
        text2: cause instanceof Error ? cause.message : "请重试",
      });
    } finally {
      writing.current = false;
      setUpdating("");
    }
  }
  async function installedDetail(item: MarketApplication) {
    if (writing.current) return;
    if (item.owned || updates[item.manifest.appId]?.status === "private") {
      onDetail(item);
      return;
    }
    onDetail(item);
  }
  const term = query.trim().toLowerCase();
  const visibleWorks =
    owner === user?.id
      ? works.filter((work) =>
          `${work.title} ${work.wish}`.toLowerCase().includes(term)
        )
      : [];
  const visibleApps =
    owner === user?.id
      ? installed.filter((item) =>
          `${item.manifest.appName} ${item.manifest.description}`
            .toLowerCase()
            .includes(term)
        )
      : [];
  const installedIds = new Set(installed.map((item) => item.manifest.appId));
  type Row =
    | { type: "work"; work: MyWork }
    | { type: "app"; app: MarketApplication };
  useEffect(() => { const next = cachedPage<Snapshot>(cacheKey); setWorks(next?.works ?? []); setInstalled(next?.installed ?? []); setOwner(next ? user?.id : undefined); setLoaded(!!next); }, [cacheKey]);
  const Root = embedded ? View : Screen;
  const actionStyle = {
    minHeight: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  };
  return (
    <Root style={{ flex: 1, backgroundColor: embedded ? "transparent" : colors.canvas }}>
      {!embedded ? (
        <PageHeader
          title={scope === "works" ? "我的作品" : "我安装的"}
          onBack={onBack}
        />
      ) : null}
      <PullRefreshSurface
        refresh={refreshPull}
        drawerGesture={drawerGesture}
        top={profileScroll.refreshOffset}
      >
        <AnimatedFlashList<Row> maintainVisibleContentPosition={{ disabled: true }}
          ref={profileScroll.ref}
          onScroll={profileScroll.onScroll}
          onLayout={profileScroll.onLayout}
          onContentSizeChange={profileScroll.onContentSizeChange}
          scrollEventThrottle={16}
          data={
            scope === "works"
              ? visibleWorks.map((work) => ({ type: "work" as const, work }))
              : visibleApps.map((app) => ({ type: "app" as const, app }))
          }
          getItemType={row => row.type}
          keyExtractor={(row) =>
            row.type === "work" ? row.work.appId : row.app.manifest.appId
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            {
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: 20,
            },
            profileScroll.contentStyle,
            !(scope === "works" ? visibleWorks.length : visibleApps.length) && profileScroll.emptyContentStyle,
          ]}
          bounces={false}
          overScrollMode="never"
          scrollEnabled={
            refreshPull.phase !== "refreshing" && refreshPull.phase !== "done"
          }
          ListHeaderComponent={
            <View style={{ gap: 8, paddingBottom: 8 }}>
              {scope === "installed" ? (
                <Text style={{ ...colors.type.overline, color: colors.ink3, paddingHorizontal: 4 }}>
                  {visibleApps.length} 个已安装应用
                </Text>
              ) : null}
              {searchQuery === undefined &&
              ((scope === "installed" ? installed.length : works.length) > 4 ||
                query) ? (
                <FormField
                  accessibilityLabel={
                    scope === "works" ? "搜索我的作品" : "搜索已安装应用"
                  }
                  placeholder={
                    scope === "works" ? "搜索作品" : "搜索已安装应用"
                  }
                  placeholderTextColor={colors.ink3}
                  value={query}
                  onChangeText={setQuery}
                  style={{
                    minHeight: 38,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: colors.surfaceRaised,
                    color: colors.ink1,
                    borderRadius: 19,
                    fontSize: 14,
                  }}
                />
              ) : null}
              {error ? (
                <Pressy onPress={() => void refresh(true)}>
                  <Text style={{ color: colors.redText, fontSize: 12 }}>
                    {error} 点击重试
                  </Text>
                </Pressy>
              ) : null}
              {busy && !loaded &&
              !(scope === "works" ? works.length : installed.length) ? (
                <PageSkeleton rows={3} shape={scope === "works" ? "work" : "installed"} />
              ) : null}
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.type === "work") {
              const work = item.work;
              const published = work.sharing?.shared;
              const visual = published?.manifest ?? work.manifest;
              return (
                <WorkCard
                  appId={work.appId}
                  application={visual ? { manifest: visual, iconUrl: work.sharing?.iconUrl || published?.iconUrl } : undefined}
                  title={published?.title || visual?.appName || work.title}
                  summary={published?.summary || visual?.description || work.wish}
                  visibility={published ? "public" : "private"}
                  status={
                    (published && ["ready", "load"].includes(work.stage) ? "已上架" : workLabels[work.stage] + (published ? " · 已上架" : "")) + (work.stale ? " · 待同步" : "")
                  }
                  authorName={user?.name}
                  authorAvatarUrl={user?.avatarUrl}
                  tone={index}
                  onOpen={() => (work.manifest ? detail(work) : workshop(work))}
                  actions={
                    <>
                      {work.manifest && onManagePublication ? (
                        <Pressy
                          accessibilityLabel="管理市场公开状态"
                          onPress={() => detail(work, true)}
                          style={{
                            width: 44,
                            height: 44,
                            alignItems: "center",
                          }}
                        >
                          <SymbolIcon
                            name="send"
                            size={18}
                            color={colors.ink2}
                          />
                        </Pressy>
                      ) : null}
                      <Pressy
                        accessibilityLabel={
                          work.stage === "making"
                            ? "查看制作进度"
                            : work.stage === "reply"
                            ? "回复并继续制作"
                            : "继续制作"
                        }
                        onPress={() => {
                          void workshop(work).catch((cause) =>
                            Toast.show({
                              type: "error",
                              text1: "工坊未能打开",
                              text2:
                                cause instanceof Error
                                  ? cause.message
                                  : "请重试",
                            })
                          );
                        }}
                        style={{ width: 44, height: 44, alignItems: "center" }}
                      >
                        <SymbolIcon
                          name="edit"
                          size={18}
                          color={colors.ink2}
                        />
                      </Pressy>
                      {published && onSharePost ? (
                        <Pressy
                          accessibilityLabel="分享作品到动态"
                          onPress={() => onSharePost(published)}
                          style={{
                            width: 44,
                            height: 44,
                            alignItems: "center",
                          }}
                        >
                          <SymbolIcon
                            name="share"
                            size={18}
                            color={colors.ink2}
                          />
                        </Pressy>
                      ) : null}
                      {installedIds.has(work.appId) ? (
                        <Pressy
                          accessibilityLabel={`打开${work.title}`}
                          onPress={() => onOpen(work.appId)}
                          style={{
                            width: 44,
                            height: 44,
                            alignItems: "center",
                          }}
                        >
                          <SymbolIcon
                            name="box"
                            size={18}
                            color={colors.ink1}
                          />
                        </Pressy>
                      ) : null}
                    </>
                  }
                />
              );
            }
            const app = item.app;
            const authorName = user && (app.owned || app.authorId === user.id) ? user.name || "我" : app.authorName;
            const updateState = updates[app.manifest.appId];
                      return (
              <View
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: colors.components.surfaceBorder,
                  borderBottomColor: colors.line,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Pressy
                    accessibilityLabel={`打开${app.manifest.appName}`}
                    onPress={() => onOpen(app.manifest.appId)}
                    scale={1}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                      justifyContent: "flex-start",
                    }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        borderWidth: colors.components.surfaceBorder,
                        borderColor: colors.line,
                      }}
                    >
                      <ApplicationIcon application={app} size={52} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, minHeight: 52, justifyContent: "space-between", gap: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.ink1,
                          fontSize: 15,
                          lineHeight: 20,
                          fontWeight: "700",
                          letterSpacing: -0.3,
                        }}
                      >
                        {app.manifest.appName}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.ink3,
                          fontSize: 12,
                          lineHeight: 17,
                        }}
                      >
                        {app.manifest.description || "点击打开应用"}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color:
                            updateState?.status === "update"
                              ? colors.orchidText
                              : colors.ink3,
                          fontSize: 11,
                          lineHeight: 15,
                        }}
                      >
                        {applicationNeedsReload(app.manifest)
                          ? "新版已下载，下次启动生效"
                          : updateState?.status === "update"
                          ? "有新版本"
                          : updateState?.status === "blocked"
                          ? updateState.message || "新版暂时无法使用"
                          : "已安装"}
                        {authorName ? ` · ${authorName}` : ""}
                      </Text>
                    </View>
                  </Pressy>
                  {updateState?.status === "update" ||
                  applicationNeedsReload(app.manifest) ? (
                    <Pressy
                      scale={1}
                      accessibilityLabel={`${
                        applicationNeedsReload(app.manifest)
                          ? "重新加载"
                          : "更新"
                      }${app.manifest.appName}`}
                      accessibilityState={{
                        busy: updating === app.manifest.appId,
                      }}
                      disabled={!!updating}
                      onPress={() => void update(app)}
                      style={{
                        minWidth: 64,
                        minHeight: 30,
                        height: 30,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 5,
                        paddingHorizontal: 12,
                        paddingVertical: 0,
                        borderRadius: 15,
                        backgroundColor: colors.accent,
                      }}
                    >
                      {updating === app.manifest.appId ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.onAccent}
                        />
                      ) : (
                        <>
                          <SymbolIcon
                            name="refresh"
                            size={14}
                            color={colors.onAccent}
                          />
                          <Text
                            style={{ color: colors.onAccent, fontSize: 12, fontWeight: "700" }}
                          >
                            {applicationNeedsReload(app.manifest)
                              ? "重新加载"
                              : "更新"}
                          </Text>
                        </>
                      )}
                    </Pressy>
                  ) : null}
                  <Pressy
                    accessibilityLabel={`${app.manifest.appName}详情与卸载`}
                    onPress={() => void installedDetail(app)}
                    style={{ width: 44, height: 44, alignItems: "center" }}
                  >
                    <SymbolIcon name="more" size={18} color={colors.ink3} />
                  </Pressy>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            loaded || (!busy && !error) ? (
              <EmptyState>
                <View style={{ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentTint }}>
                  <SymbolIcon name="box" size={24} strokeWidth={2} color={colors.accent} />
                </View>
                <Text style={{ color: colors.ink3, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
                  {term
                    ? "没有找到匹配的内容"
                    : scope === "works"
                    ? "从一个想法开始，做出你的第一份作品"
                    : "还没有安装应用，去发现喜欢的作品吧"}
                </Text>
                {scope === "works" && !term ? (
                  <Pressy onPress={onCreate} style={actionStyle}>
                    <Text style={{ color: colors.onAccent, fontWeight: "700" }}>
                      制作第一份作品
                    </Text>
                  </Pressy>
                ) : null}
              </EmptyState>
            ) : null
          }
        />
      </PullRefreshSurface>
    </Root>
  );
}
