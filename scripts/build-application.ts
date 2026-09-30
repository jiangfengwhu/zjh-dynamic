import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApplication } from "../tools/applications/build.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appId = process.argv[2];
if (!appId) throw new Error("用法：npm run build:application -- <appId>");
await buildApplication(root, appId);
