import { useEffect, useRef, useState } from "react";
import { getAppContext } from "@zijinhua/app-sdk";
import { getCreationService } from "@zijinhua/app-sdk/creation";
import { AgentScreen, type AgentTrace } from "./AgentScreen";
import { jollyPhaseFromStatus, noteJollyRun, syncJollyFeedPost, type JollyPhase } from "./run";
const { runCloudEvolve, cancelCloudRun, loadJulesRun, loadJulesSession, saveJulesRun, clearJulesRun, clearJulesSession, inspectJulesSession, julesSessionLive, watchJulesSession, workshopStatus, confirmWorkshop, checkPackageUpdates, applyPackageUpdates } = getCreationService();
type PendingPackage = Awaited<ReturnType<typeof checkPackageUpdates>>[number];
export default function Workshop() {
  const context = getAppContext();
  const pluginsReady = true;
  const [requirement, setRequirement] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState("");
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [busy, setBusy] = useState(false);
  const [providerId, setProviderId] = useState("jules");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState(0);
  const [workshopPhase, setWorkshopPhase] = useState<JollyPhase>("idle");
  const [sessionId, setSessionId] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [workshopReady, setWorkshopReady] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const confirmingRef = useRef(false);
  const cloudStop = useRef(false);
  const cloudRun = useRef<{ runId?: string } | null>(null);
  const busyRef = useRef(false);
  const resumedCloud = useRef(false);

  useEffect(() => {
    if (!pluginsReady) return;
    const phase = jollyPhaseFromStatus(busy, status);
    if (phase === "idle" && !prompt.trim()) return;
    const steps = [...new Set(traces.map((item) => item.title.trim()).filter(Boolean))].slice(-4);
    noteJollyRun({ phase, wish: prompt, status, steps });
    syncJollyFeedPost({ startedAt: runStartedAt, phase: workshopPhase, wish: prompt, status, steps });
  }, [pluginsReady, busy, status, prompt, traces, runStartedAt, workshopPhase]);

  async function refreshUpdates(force = false, strict = false): Promise<PendingPackage[]> {
    try { return await checkPackageUpdates(); } catch (error) { if (strict) throw error; return []; }
  }
  async function applyUpdatesNow() { setUpdateBusy(true); try { await applyPackageUpdates(); } finally { setUpdateBusy(false); } }
  useEffect(() => { void resumeCloud(); }, []);
  useEffect(() => {
    const accept = () => {
      const prompt = context.storage.get("pendingPrompt");
      if (prompt) { setRequirement(prompt); context.storage.set("pendingPrompt", ""); }
    };
    accept(); return context.storage.subscribe("pendingPrompt", accept);
  }, []);
  async function stop() {
    cloudStop.current = true;
    const cloud = cloudRun.current;
    if (cloud) {
      setStatus("正在停止");
      console.log("evolve stop", cloud.runId ?? "pending");
      if (cloud.runId) {
        try {
          await cancelCloudRun(cloud.runId);
          setSessionId("");
        } catch (error) {
          console.log("evolve stop failed", error instanceof Error ? error.message : error);
        }
      }
      return;
    }
  }

  function newSession() {
    if (busyRef.current || sessionLoading || confirmingRef.current) return;
    if (sessionId) {
      resumedCloud.current = false;
      setSessionLoading(true);
      void resumeCloud();
      return;
    }
    clearJulesSession();
    setSessionId("");
    setPrompt("");
    setStatus("");
    setTraces([]);
    setReport("");
    setRunStartedAt(0);
    setWorkshopPhase("idle");
    setAwaitingConfirmation(false);
    setWorkshopReady(false);
    setAwaitingReply(false);
    setConfirmationMessage("");
  }

  async function confirmWish() {
    if (!sessionId || !awaitingConfirmation || !workshopReady || busyRef.current || confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirmationBusy(true);
    setConfirmationMessage("正在为这份心愿落款…");
    try {
      const delivery = await checkWorkshopDelivery(sessionId);
      if (delivery.delivery !== "loaded") return;
      await confirmWorkshop(sessionId);
      clearJulesSession();
      setSessionId("");
      setAwaitingConfirmation(false);
      setAwaitingReply(false);
      setConfirmationMessage("");
      setStatus("这份心愿已收好，可以开始新的心愿了");
    } catch (error) {
      setConfirmationMessage(error instanceof Error ? error.message : "这份心愿暂时没能收好，请稍后再试");
      void refreshUpdates(true);
    } finally {
      confirmingRef.current = false;
      setConfirmationBusy(false);
    }
  }

  async function checkWorkshopDelivery(session: string) {
    setWorkshopReady(false);
    try {
      const workshop = await workshopStatus(session);
      setConfirmationMessage(workshop.message || "暂时无法核对作品发布状态，请稍后重试。");
      if (workshop.delivery === "loaded") {
        setWorkshopReady(true);
        setStatus("正在体验这次作品");
      } else if (workshop.delivery === "update") {
        const ready = await refreshUpdates(true, true);
        setStatus(ready.length ? "这次作品可以加载" : "新包暂未就绪，请重新检查");
      } else {
        setStatus(workshop.delivery === "blocked" ? "作品交付需要处理" : "代码已完成，等待发布");
      }
      return workshop;
    } catch (error) {
      setConfirmationMessage(error instanceof Error ? error.message : "作品更新检查失败，请稍后重试");
      setStatus("作品更新检查失败");
      throw error;
    }
  }

  async function loadWish() {
    if (updateBusy || confirmingRef.current || !sessionId) return;
    try {
      const workshop = await checkWorkshopDelivery(sessionId);
      if (workshop.delivery === "update") {
        const ready = await refreshUpdates(true, true);
        if (ready.length) await applyUpdatesNow();
        else setConfirmationMessage("新包暂未就绪，请重新检查；确认前会再次核对运行版本。");
      }
    } catch (error) {
      setConfirmationMessage(error instanceof Error ? error.message : "新作品暂时没接好，请稍后再试");
    }
  }

  function noteError(where: string, detail: string) {
    console.log("app error", where, detail.trim().slice(0, 4000));
  }

  async function runCloud(text: string, status = "正在生成") {
    busyRef.current = true;
    setBusy(true);
    // 回复同一份心愿沿用动态身份；轮次消息的时间由 cloudEvolve 单独管理。
    const startedAt = sessionId && runStartedAt > 0 ? runStartedAt : Date.now();
    const wish = sessionId && prompt.trim() ? prompt : text;
    setRunStartedAt(startedAt);
    setPrompt(wish);
    setWorkshopPhase("making");
    setAwaitingReply(false);
    setConfirmationMessage("");
    setTraces([]);
    setReport("");
    context.navigation.create();
    setStatus(status);
    cloudStop.current = false;
    cloudRun.current = {};
    let waiting = false;
    try {
      const outcome = await runCloudEvolve({
        requirement: text,
        onStatus: setStatus,
        onTrace: setTraces,
        onRunId: (runId) => {
          setSessionId(runId);
          cloudRun.current = { runId };
          saveJulesRun({ session: runId, prompt: wish, startedAt });
        },
        shouldStop: () => cloudStop.current,
      });
      if (outcome === "cancelled") {
        setSessionId("");
        setWorkshopPhase("stopped");
        setStatus("已停止");
        setBusy(false);
        return;
      }
      if (outcome === "waiting") {
        waiting = true;
        setAwaitingReply(true);
        return;
      }
      waiting = true;
      setAwaitingConfirmation(true);
      setWorkshopPhase("ready");
      await workshopStatus(cloudRun.current?.runId || await loadJulesSession());
      
      setRequirement("");
      setStatus("正在检查新包");
      await checkWorkshopDelivery(cloudRun.current?.runId || await loadJulesSession());
      setBusy(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("evolve failed", message);
      setWorkshopPhase(waiting ? "ready" : "failed");
      setStatus(message);
      setBusy(false);
    } finally {
      cloudRun.current = null;
      busyRef.current = false;
      setBusy(false);
      if (!waiting) clearJulesRun();
    }
  }

  async function resumeCloud() {
    if (resumedCloud.current || busyRef.current) return;
    resumedCloud.current = true;
    const run = await loadJulesRun();
    const session = run?.session || await loadJulesSession();
    setSessionId(session);
    if (!session) {
      setSessionLoading(false);
      return;
    }
    let info: { state: string; url: string; title: string; startedAt: number } | undefined;
    try {
      info = await inspectJulesSession(session);
      if (info) {
        const workshop = await workshopStatus(session);
        if (workshop.merged) {
          setRunStartedAt(run?.startedAt || info.startedAt);
          setPrompt(run?.prompt || info.title);
          setWorkshopPhase("ready");
          setStatus("这份心愿已收好");
          clearJulesSession();
          setSessionId("");
          return;
        }
        setAwaitingConfirmation(workshop.completed);
        setAwaitingReply(workshop.state === "AWAITING_USER_FEEDBACK");
      }
    } catch (error) {
      console.log("jules resume failed", error instanceof Error ? error.message : error);
      return;
    } finally {
      setSessionLoading(false);
    }
    if (!info || info.state === "FAILED") {
      setRunStartedAt(run?.startedAt || info?.startedAt || 0);
      setWorkshopPhase(info?.state === "FAILED" ? "failed" : "stopped");
      clearJulesSession();
      setSessionId("");
      busyRef.current = false;
      setBusy(false);
      setStatus(info?.state === "FAILED" ? "Jules 失败" : "上次的生成已经中断");
      console.log("jules resume dropped", session, info?.state ?? "missing");
      return;
    }
    if (julesSessionLive(info.state)) {
      const promptText = run?.prompt || info.title || "线上定制";
      const startedAt = run?.startedAt || info.startedAt;
      setPrompt(promptText);
      setRunStartedAt(startedAt);
      setWorkshopPhase("making");
      showAgent();
      saveJulesRun({ session, prompt: promptText, startedAt });
      console.log("jules resume", session, info.state);
      busyRef.current = true;
      setBusy(true);
      setStatus("正在接上");
      setTraces([{ id: "jules", kind: "status", title: "正在接上", state: "running", detail: info.url }]);
      cloudStop.current = false;
      cloudRun.current = { runId: session };
      let waiting = false;
      try {
        const outcome = await watchJulesSession(session, info.url, {
          onStatus: setStatus,
          onTrace: setTraces,
          shouldStop: () => cloudStop.current,
        }, startedAt);
        if (outcome === "cancelled") {
          setSessionId("");
          setWorkshopPhase("stopped");
          setStatus("已停止");
          setBusy(false);
          return;
        }
        if (outcome === "waiting") {
          waiting = true;
          setAwaitingReply(true);
          return;
        }
        waiting = true;
        setAwaitingConfirmation(true);
        setWorkshopPhase("ready");
        await workshopStatus(session);
        setStatus("正在检查新包");
        await checkWorkshopDelivery(session);
        setBusy(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log("jules resume failed", message);
        setWorkshopPhase(waiting ? "ready" : "failed");
        setStatus(message);
        setBusy(false);
      } finally {
        cloudRun.current = null;
        busyRef.current = false;
        setBusy(false);
        if (!waiting) clearJulesRun();
      }
      return;
    }
    if (info.state === "COMPLETED") {
      setPrompt(run?.prompt || info.title || "这次的心愿");
      setRunStartedAt(run?.startedAt || info.startedAt);
      setWorkshopPhase("ready");
      showAgent();
      busyRef.current = false;
      setBusy(false);
      setStatus("正在检查新包");
      console.log("jules resume completed", session);
      try {
        
        await checkWorkshopDelivery(session);
      } catch (error) {
        console.log("jules resume check failed", error instanceof Error ? error.message : error);
      }
      // 保留这次心愿，重载新包后仍要由用户确认收下。
      return;
    }
    if (info.state === "PAUSED") {
      setRunStartedAt(run?.startedAt || info.startedAt);
      setWorkshopPhase("stopped");
      setAwaitingReply(true);
      setPrompt(run?.prompt || info.title || "线上定制");
      showAgent();
      busyRef.current = false;
      setBusy(false);
      setStatus("Jules 已暂停");
      console.log("jules resume paused", session);
    }
  }

  function showAgent() {
    context.navigation.create();
    setTimeout(() => context.navigation.create(), 400);
  }

  async function submit() {
    const text = requirement.trim();
    if (!text || busyRef.current || sessionLoading || confirmingRef.current || (sessionId && !awaitingReply)) return;
    console.log("evolve submit", providerId, text);
    await runCloud(text);
  }

  return <AgentScreen
    value={requirement} prompt={prompt} status={status} busy={busy} traces={traces} report={report}
    startedAt={runStartedAt} sessionId={sessionId} sessionLoading={sessionLoading} onNewSession={newSession}
    awaitingConfirmation={awaitingConfirmation} workshopReady={workshopReady} awaitingReply={awaitingReply}
    confirmationBusy={confirmationBusy} confirmationMessage={confirmationMessage}
    onConfirmWish={() => void confirmWish()} onLoadWish={() => void loadWish()}
    providerId={providerId} onProviderChange={setProviderId} onChange={setRequirement}
    onSubmit={() => void submit()} onStop={() => void stop()} onBack={context.navigation.back}
  />;
}
