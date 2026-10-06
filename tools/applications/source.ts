import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Capture the files Jules will commit without changing its index or history. */
export async function applicationSource(repo: string) {
  const git = async (args: string[], env = process.env) =>
    (await run("git", args, { cwd: repo, env, windowsHide: true })).stdout.trim();
  const commit = await git(["rev-parse", "HEAD"]);
  const remote = await git(["remote", "get-url", "origin"]);
  const match = remote.match(/^(?:git@github\.com:|https:\/\/github\.com\/)([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) throw new Error("仅支持明确的 GitHub origin 仓库");
  const index = path.join(os.tmpdir(), `zjh-application-index-${randomUUID()}`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    await git(["read-tree", commit], env);
    await git(["add", "--all", "--", "."], env);
    const tree = await git(["write-tree"], env);
    const dirty = Boolean(await git(["status", "--porcelain", "--untracked-files=normal"]));
    return { repository: match[1], commit, tree, dirty };
  } finally {
    await rm(index, { force: true });
    await rm(`${index}.lock`, { force: true });
  }
}
