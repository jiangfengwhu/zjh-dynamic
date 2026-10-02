import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import FastImage from "@d11/react-native-fast-image";
import { PageHeader } from "../../../../../packages/ui/chrome";
import { Screen } from "../../../../../packages/ui/edge";
import { useTheme } from "../../../../../packages/ui/theme";
import { useAccount } from "../account";
import { ApplicationPostCard } from "./ApplicationPostCard";
import { UserPostCard } from "./UserPostCard";
import { usePullToRefresh } from "./pullToRefresh";
import { PullIndicator } from "./PullIndicator";
import { fetchAuthorPosts, fetchAuthorProfile, useUserPosts, type AuthorProfile, type PublicAuthor, type UserPost } from "./userPosts";

export function AuthorProfileScreen({ initialAuthor, onBack, onPost, onApplication }: { initialAuthor: PublicAuthor; onBack: () => void; onPost: (post: UserPost) => void; onApplication: (appId: string) => Promise<void> }) {
  const { colors } = useTheme(); const { user } = useAccount(); const timeline = useUserPosts(); const focused = useIsFocused();
  const [profile, setProfile] = useState<AuthorProfile>(() => ({ author: initialAuthor, posts: timeline.posts.filter(post => post.author.id === initialAuthor.id), applications: [], nextCursor: null }));
  const [tab, setTab] = useState<"posts" | "apps">("posts"); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false); const [error, setError] = useState("");
  const alive = useRef(true); const reading = useRef(false); const revision = useRef(0); const rerun = useRef(false);
  const identity = useRef(user?.id);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(event => { scrollY.value = event.contentOffset.y; });
  const { pull, phase, gesture, scrollGesture } = usePullToRefresh({ scrollY, onRefresh: () => load() });
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  async function load(more = false) {
    if (reading.current) { if (!more) rerun.current = true; return false; }
    if (more && !profile.nextCursor) return false;
    reading.current = true; setBusy(true); const before = revision.current;
    try {
      const result = more ? await fetchAuthorPosts(initialAuthor.id, profile.nextCursor!) : await fetchAuthorProfile(initialAuthor.id);
      if (!alive.current || before !== revision.current) return false;
      setProfile(previous => more ? { ...previous, posts: [...previous.posts, ...result.posts.filter(item => !previous.posts.some(old => old.id === item.id))], nextCursor: result.nextCursor } : result as AuthorProfile);
      setLoaded(true); setError("");
      return true;
    } catch (cause) { if (alive.current && before === revision.current) setError(cause instanceof Error ? cause.message : "主页暂时无法加载"); return false; }
    finally { reading.current = false; if (alive.current) { setBusy(false); if (rerun.current) { rerun.current = false; void load(); } } }
  }
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { revision.current++; if (identity.current !== user?.id) { identity.current = user?.id; setProfile(previous => ({ ...previous, posts: previous.posts.map(post => ({ ...post, liked: false })) })); } if (focused) void load(); }, [focused, user?.id]);
  function updated(post: UserPost) { revision.current++; if (reading.current) rerun.current = true; setProfile(previous => ({ ...previous, posts: previous.posts.map(item => item.id === post.id ? post : item) })); }
  function deleted(id: string) { revision.current++; if (reading.current) rerun.current = true; setProfile(previous => ({ ...previous, posts: previous.posts.filter(post => post.id !== id) })); }
  const author = profile.author.id === user?.id ? { ...profile.author, name: user.name, avatarUrl: user.avatarUrl } : profile.author;
  const header = <View><View style={{ padding: 20, gap: 12 }}>{author.avatarUrl ? <FastImage source={{ uri: author.avatarUrl }} style={{ width: 76, height: 76, borderRadius: 38 }} /> : <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 30, color: colors.accent }}>{Array.from(author.name)[0]}</Text></View>}<View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Text style={{ fontSize: 23, fontWeight: "700", color: colors.ink1 }}>{author.name}</Text>{author.official ? <Text style={{ fontSize: 12, color: colors.accent }}>官方</Text> : null}{user?.id === author.id ? <Text style={{ fontSize: 12, color: colors.ink3 }}>我</Text> : null}</View><Text style={{ color: colors.ink3, fontSize: 13 }}>{loaded ? `${profile.applications.length} 个公开应用` : error ? "主页暂时未能同步" : busy ? "正在接回作者主页…" : "作者主页"}</Text></View><View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.line }}>{(["posts", "apps"] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={{ flex: 1, alignItems: "center", padding: 14 }}><Text style={{ color: tab === value ? colors.ink1 : colors.ink3, fontWeight: tab === value ? "700" : "400" }}>{value === "posts" ? "动态" : "应用"}</Text><View style={{ position: "absolute", bottom: 0, height: 3, width: 28, borderRadius: 2, backgroundColor: tab === value ? colors.accent : "transparent" }} /></Pressable>)}</View>{error ? <Pressable onPress={() => void load()} style={{ padding: 16 }}><Text style={{ color: colors.danger }}>{error} · 点击重试</Text></Pressable> : null}</View>;
  return <Screen style={{ flex: 1, backgroundColor: colors.canvas }}><PageHeader title="作者主页" onBack={onBack} /><GestureDetector gesture={gesture}><View style={{ flex: 1, overflow: "hidden" }}><PullIndicator pull={pull} phase={phase} /><Animated.View style={[{ flex: 1 }, lift]}><GestureDetector gesture={scrollGesture}><Animated.FlatList<{ type: "post"; post: UserPost } | { type: "app"; app: AuthorProfile["applications"][number] }> data={tab === "posts" ? profile.posts.map(post => ({ type: "post" as const, post })) : profile.applications.map(app => ({ type: "app" as const, app }))} keyExtractor={row => row.type === "post" ? row.post.id : row.app.manifest.appId} removeClippedSubviews={false} onScroll={onScroll} scrollEventThrottle={16} overScrollMode="never" bounces={false} scrollEnabled={phase !== "refreshing" && phase !== "done"} ListHeaderComponent={header}
    renderItem={({ item: row }) => { if (row.type === "app") { const item = row.app; return <View style={{ padding: 16 }}><ApplicationPostCard application={{ ...item.manifest, title: item.title || item.manifest.title, summary: item.summary ?? item.manifest.summary }} onOpen={onApplication} /></View>; } const item = row.post; return <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.line }}><UserPostCard post={{ ...item, author }} time={new Date(item.createdAt).toLocaleDateString()} own={user?.id === item.author.id} onOpen={() => onPost(item)} onApplication={onApplication} onUpdated={updated} onDeleted={() => deleted(item.id)} /></View>; }}
    ListEmptyComponent={loaded && !error ? <Text style={{ textAlign: "center", padding: 32, color: colors.ink3 }}>{tab === "apps" ? "还没有公开应用" : "还没有公开动态"}</Text> : null}
    ListFooterComponent={<View style={{ padding: 18 }}>{busy && !loaded ? <ActivityIndicator color={colors.accent} /> : tab === "posts" && profile.nextCursor ? <Pressable disabled={busy} onPress={() => void load(true)} style={{ padding: 14 }}>{busy ? <ActivityIndicator color={colors.accent} /> : <Text style={{ textAlign: "center", color: colors.accent }}>加载更多动态</Text>}</Pressable> : null}</View>} /></GestureDetector></Animated.View></View></GestureDetector></Screen>;
}
