import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { currentAccountId } from "./account";
import { creationService } from "./cloudEvolve";
import { openCreationRequest } from "./workshopNavigation";
import {
  readShellValue,
  writeShellValue,
  removeShellValue,
} from "./shellStorage";
const bootstrap = require("../../../../tools/applications/bootstrap.json");

export async function polishCreationPrompt(source: string) {
  const owner = await currentAccountId();
  if (!owner) throw new Error("请先登录后润色");
  const ai = applicationContext(bootstrap.defaultApplication).ai;
  if (!(await ai.listProviders()).length)
    throw new Error("还没有配置 AI 引擎，可前往设置配置，也可以按原文制作");
  if ((await currentAccountId()) !== owner)
    throw new Error("账号已改变，请重试");
  const result = await ai.complete({
    messages: [
      {
        role: "system",
        content:
          "你是 Jolly 的需求润色助手。将用户的应用想法整理为简洁、可以直接制作的首版需求，只输出需求正文，不输出代码块、解释或追问。保留用户原意和所有明确限制；仅整理已提到的用途、功能、界面与完成标准，不擅自新增功能、技术架构、商业化或登录需求，不把未知信息编成已确认需求。正文最多 8000 个字符。",
      },
      { role: "user", content: source },
    ],
  });
  if ((await currentAccountId()) !== owner)
    throw new Error("账号已改变，请重试");
  if (!result.ok) throw new Error(result.error);
  const text = result.text.trim();
  if (!text || text.length > 8000)
    throw new Error("润色内容超出需求长度限制，请重试；原文已保留");
  return text;
}

const flights = new Map<string, { prompt: string; promise: Promise<string> }>();
/** A stable target and the existing server requestId make timeout retries safe. */
export async function submitCreationPrompt(prompt: string) {
  const owner = await currentAccountId();
  if (!owner) throw new Error("请先登录后制作");
  const text = prompt.trim();
  if (!text || text.length > 8000)
    throw new Error("请填写 1 到 8000 个字符的制作需求");
  const previous = flights.get(owner);
  if (previous) {
    if (previous.prompt === text) return previous.promise;
    throw new Error("另一份需求正在提交，请稍后重试；这份草稿已保留");
  }
  const operation = (async () => {
    const key = `creation.pending.${owner}`;
    let saved: { target: string; prompt: string } | undefined;
    try {
      saved = JSON.parse((await readShellValue(key)) || "null");
    } catch {}
    if ((await currentAccountId()) !== owner)
      throw new Error("账号已改变，请重新提交");
    const target =
      saved?.prompt === text && /^[a-z][a-z0-9-]{0,63}$/.test(saved.target)
        ? saved.target
        : await openCreationRequest(
            bootstrap.defaultApplication,
            undefined,
            false,
            owner,
          );
    if (!target) throw new Error("暂时无法准备制作，需求已保留");
    if ((await currentAccountId()) !== owner)
      throw new Error("账号已改变，请重新提交");
    writeShellValue(key, JSON.stringify({ target, prompt: text }));
    const context = applicationContext(bootstrap.defaultApplication);
    const service = creationService(target);
    await service.runCloudEvolve({
      requirement: text,
      submitOnly: true,
      expectedOwnerId: owner,
      onStatus: () => {},
      onTrace: () => {},
      shouldStop: () => false,
      onRunId: (session) => {
        service.saveJulesRun({ session, prompt: text, startedAt: Date.now() });
        context.storage.set(
          `run:${target}`,
          JSON.stringify({
            phase: "making",
            stage: "making",
            wish: text,
            status: "已提交，正在制作",
            steps: [],
            at: Date.now(),
          }),
        );
      },
    });
    if ((await currentAccountId()) !== owner)
      throw new Error("账号已改变，请回到原账号查看制作结果");
    const workspaces = JSON.parse(
      context.storage.get("workspaces") || "[]",
    ) as Array<{ appId: string; title: string }>;
    const workspace = workspaces.find((item) => item.appId === target);
    if (workspace) {
      workspace.title = text.replace(/\s+/g, " ").slice(0, 20);
      context.storage.set("workspaces", JSON.stringify(workspaces));
    }
    context.storage.remove(`pendingPrompt.${target}`);
    context.storage.set("workshopTarget", target);
    context.storage.set("openWorkshop", String(Date.now()));
    removeShellValue(key);
    return target;
  })();
  flights.set(owner, { prompt: text, promise: operation });
  try {
    return await operation;
  } finally {
    if (flights.get(owner)?.promise === operation) flights.delete(owner);
  }
}
