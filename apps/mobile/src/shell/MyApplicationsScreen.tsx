import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import Animated, { useSharedValue } from "react-native-reanimated";
import { usePullToRefresh } from "./feed/pullToRefresh";
import { PullRefreshSurface } from "./feed/PullRefreshSurface";
import { useProfileScroll } from "./ProfileScroll";
import { Gesture } from "react-native-gesture-handler";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { FormField } from "./FormField";
import { useAccount } from "./account";
import { subscribeCatalog } from "./catalog";
import {
  installedMarket,
  fetchPublicMarketApplication,
  installMarketApplication,
  type MarketApplication,
} from "./market";
import {
  publicApplicationUpdates,
  validateApplication,
  type PublicApplicationUpdate,
} from "../runtime/applications";
import { openApplicationWorkshop } from "./workshopNavigation";
import { restoreWorks } from "./workRecovery";
import { readMyWorks, workLabels, type MyWork } from "./works";
import { WorkCard } from "./WorkCard";
import { marketDefinition } from "./market";
import { PixelIcon } from "./feed/PixelKit";
import { PixelText as Text } from "./feed/PixelText";
import { usePixelTheme } from "./feed/pixelTheme";

/** One collection per surface: creations on profiles, installs in the market. */
export function MyApplicationsScreen({
  onBack,
  onCreate,
  onDetail,
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
  const { colors } = usePixelTheme();
  const focused = useIsFocused() && active;
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const [works, setWorks] = useState<MyWork[]>([]);
  const [installed, setInstalled] = useState<MarketApplication[]>([]);
  const [owner, setOwner] = useState<string>();
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
  usePreventRemove(!!updating, () =>
    Toast.show({ type: "info", text1: "正在下载应用更新，请稍候" })
  );
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
    setBusy(true);
    setPulling(manual);
    setError("");
    try {
      const [local, apps] = await Promise.all([
        scope === "works" ? readMyWorks() : Promise.resolve([]),
        installedMarket(),
      ]);
      if (before !== generation.current) return;
      setWorks(local);
      setInstalled(apps);
      setOwner(user?.id);
      if (scope === "works") {
        await restoreWorks(manual, true);
        const next = await readMyWorks();
        if (before !== generation.current) return;
        setWorks(next);
        if (next.some((work) => work.stale)) {
          succeeded = false;
          setError("部分制作状态暂未同步，保留本机记录。下拉可重试。");
        }
      } else {
        try {
          const result = await publicApplicationUpdates(manual);
          if (before === generation.current) setUpdates(result);
        } catch {
          succeeded = false;
          if (before === generation.current)
            setError("更新检查未完成，本机应用仍可使用。下拉可重试。");
        }
      }
    } catch {
      succeeded = false;
      if (before === generation.current)
        setError("暂时无法读取内容，下拉可重试。");
    } finally {
      if (before === generation.current) {
        reading.current = false;
        setBusy(false);
        setPulling(false);
      }
    }
    return succeeded;
  }
  useEffect(() => {
    if (focused) {
      const idle = requestIdleCallback(() => {
        void refresh();
      });
      return () => {
        cancelIdleCallback(idle);
        generation.current++;
        reading.current = false;
      };
    }
  }, [focused, user?.id, scope]);
  useEffect(() => {
    if (!focused) return;
    const reload = () => {
      void refresh();
    };
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    const offCatalog = subscribeCatalog(reload);
    const offSharing = subscribePackageValue("shell.market.changed", reload);
    const offWorks = applicationContext("jolly").storage.subscribe(
      "workspaces",
      reload
    );
    const timer = setInterval(() => {
      if (
        scope === "works" &&
        works.some((work) =>
          ["making", "reply", "load", "blocked"].includes(work.stage)
        )
      )
        reload();
    }, 30000);
    return () => {
      appState.remove();
      offCatalog();
      offSharing();
      offWorks();
      clearInterval(timer);
    };
  }, [focused, user?.id, scope, works]);
  async function workshop(work: MyWork) {
    await openApplicationWorkshop(work.appId, work.title, false, false);
  }
  function detail(work: MyWork) {
    if (work.manifest)
      onDetail({
        manifest: work.manifest,
        title: work.title,
        authorId: user?.id ?? null,
        authorName: user?.name ?? "创作者",
        authorAvatarUrl: user?.avatarUrl,
        originalAppId: null,
        owned: true,
      });
  }
  async function update(item: MarketApplication) {
    if (writing.current) return;
    writing.current = true;
    setUpdating(item.manifest.appId);
    try {
      const published = await fetchPublicMarketApplication(item.manifest.appId);
      validateApplication(published.manifest);
      await installMarketApplication(published);
      Toast.show({ type: "success", text1: "应用已更新，本机数据保留" });
      void refresh(true);
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
    const before = generation.current;
    try {
      const latest = await fetchPublicMarketApplication(item.manifest.appId);
      if (before === generation.current) onDetail(latest);
    } catch {
      if (before === generation.current) onDetail(item);
    }
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
          `${item.manifest.title} ${item.manifest.summary}`
            .toLowerCase()
            .includes(term)
        )
      : [];
  const installedIds = new Set(installed.map((item) => item.manifest.appId));
  type Row =
    | { type: "work"; work: MyWork }
    | { type: "app"; app: MarketApplication };
  const Root = embedded ? View : Screen;
  const actionStyle = {
    minHeight: 44,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  };
  return (
    <Root style={{ flex: 1, backgroundColor: colors.canvas }}>
      {!embedded ? (
        <PageHeader
          variant="pixel"
          title={scope === "works" ? "我的作品" : "我安装的"}
          onBack={onBack}
        />
      ) : null}
      <PullRefreshSurface
        refresh={refreshPull}
        drawerGesture={drawerGesture}
        top={profileScroll.refreshOffset}
      >
        <Animated.FlatList<Row>
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
          keyExtractor={(row) =>
            row.type === "work" ? row.work.appId : row.app.manifest.appId
          }
          initialNumToRender={6}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            {
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 24,
            },
            profileScroll.contentStyle,
          ]}
          bounces={false}
          overScrollMode="never"
          scrollEnabled={
            refreshPull.phase !== "refreshing" && refreshPull.phase !== "done"
          }
          ListHeaderComponent={
            <View style={{ gap: 8, paddingBottom: 8 }}>
              {scope === "installed" ? (
                <Text style={{ fontSize: 12, color: colors.ink3 }}>
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
                    minHeight: 44,
                    paddingHorizontal: 12,
                    backgroundColor: colors.surfaceRaised,
                    color: colors.ink1,
                    borderRadius: 4,
                    fontSize: 13,
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
              {busy &&
              !(scope === "works" ? works.length : installed.length) ? (
                <ActivityIndicator color={colors.accentText} />
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
                  title={published?.title || visual?.title || work.title}
                  summary={published?.summary || visual?.summary || work.wish}
                  mark={visual?.mark}
                  visibility={published ? "public" : "private"}
                  status={
                    workLabels[work.stage] + (work.stale ? " · 待同步" : "")
                  }
                  authorName={user?.name}
                  authorAvatarUrl={user?.avatarUrl}
                  tone={index}
                  onOpen={() => (work.manifest ? detail(work) : workshop(work))}
                  actions={
                    <>
                      <Pressy
                        accessibilityLabel={
                          ["making", "reply"].includes(work.stage)
                            ? "查看制作进度"
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
                        <PixelIcon
                          name="edit"
                          size={18}
                          color={colors.orchidText}
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
                          <PixelIcon
                            name="share"
                            size={18}
                            color={colors.redText}
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
                          <PixelIcon
                            name="box"
                            size={18}
                            color={colors.greenText}
                          />
                        </Pressy>
                      ) : null}
                    </>
                  }
                />
              );
            }
            const app = item.app;
            const updateState = updates[app.manifest.appId];
            const Avatar = marketDefinition(app)?.avatar;
            return (
              <View
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 0.5,
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
                    accessibilityLabel={`打开${app.manifest.title}`}
                    onPress={() => onOpen(app.manifest.appId)}
                    scale={1}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                      justifyContent: "flex-start",
                    }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: colors.orchidTint,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {Avatar ? (
                        <Avatar size={44} />
                      ) : (
                        <Text
                          style={{ fontSize: 24, color: app.manifest.accent }}
                        >
                          {app.manifest.mark}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.ink1,
                          fontSize: 16,
                          lineHeight: 21,
                        }}
                      >
                        {app.manifest.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.ink3,
                          fontSize: 12,
                          lineHeight: 17,
                        }}
                      >
                        {app.manifest.summary || "点击打开应用"}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color:
                            updateState?.status === "update"
                              ? colors.greenText
                              : colors.ink3,
                          fontSize: 10,
                        }}
                      >
                        {updateState?.status === "update"
                          ? "有新版本"
                          : "已安装"}
                        {app.authorName ? ` · ${app.authorName}` : ""}
                      </Text>
                    </View>
                  </Pressy>

                  <Pressy
                    disabled={!!updating}
                    accessibilityLabel={`${app.manifest.title}详情与卸载`}
                    onPress={() => void installedDetail(app)}
                    style={{ width: 44, height: 44, alignItems: "center" }}
                  >
                    <PixelIcon name="more" size={18} color={colors.ink3} />
                  </Pressy>
                </View>
                {updateState?.status === "update" ? (
                  <Pressy
                    disabled={!!updating}
                    onPress={() => void update(app)}
                    style={{
                      alignSelf: "flex-start",
                      marginLeft: 58,
                      minHeight: 32,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: colors.greenTint,
                    }}
                  >
                    <Text style={{ color: colors.greenText, fontSize: 12 }}>
                      {updating === app.manifest.appId
                        ? "正在更新…"
                        : "更新应用"}
                    </Text>
                  </Pressy>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            !busy && !error ? (
              <View
                style={{ paddingVertical: 24, gap: 12, alignItems: "center" }}
              >
                <PixelIcon name="box" size={32} color={colors.orchidText} />
                <Text style={{ color: colors.ink3, fontSize: 13 }}>
                  {term
                    ? "没有找到匹配的内容"
                    : scope === "works"
                    ? "从一个想法开始，做出你的第一份作品"
                    : "还没有安装应用，去发现喜欢的作品吧"}
                </Text>
                {scope === "works" && !term ? (
                  <Pressy onPress={onCreate} style={actionStyle}>
                    <Text style={{ color: colors.accentText }}>
                      制作第一份作品
                    </Text>
                  </Pressy>
                ) : null}
              </View>
            ) : null
          }
        />
      </PullRefreshSurface>
    </Root>
  );
}
