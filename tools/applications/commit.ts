import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Commit only this application's source and the shared lockfile before building. */
export async function commitApplication(root: string, appId: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用 ID 无效");
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  const origin = git(["remote", "get-url", "origin"]).trim();
  if (!/^(?:git@github\.com:|https:\/\/github\.com\/)jiangfengwhu\/zjh-plugin(?:\.git)?$/.test(origin)) throw new Error("应用只能从 zjh-plugin 仓库发布");
  const config = JSON.parse(await readFile(path.join(root, "apps", appId, "application.json"), "utf8"));
  if (config.appId !== appId) throw new Error("应用配置与发布 ID 不一致");
  const files = [...new Set([
    ...git(["diff", "--name-only", "--no-renames", "-z", "HEAD"]).split("\0"),
    ...git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"),
  ].filter(Boolean))];
  const outside = files.filter(file => !file.startsWith(`apps/${appId}/`) && file !== "package-lock.json");
  if (outside.length) throw new Error("存在本应用范围之外的改动，请先单独处理，自动发布不会提交其他文件");
  if (!files.length) return;
  if (files.some(file => /(?:^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|id_rsa|id_ed25519)$|\.(?:pem|p12|pfx|key)$/i.test(file) && !file.endsWith(".env.example")))
    throw new Error("应用改动包含凭证文件，不能自动提交");
  git(["--literal-pathspecs", "add", "--all", "--", ...files]);
  git(["commit", "-m", `feat(${appId}): deliver application changes`]);
  console.log(`源码已提交：${git(["rev-parse", "--short", "HEAD"]).trim()}`);
}
