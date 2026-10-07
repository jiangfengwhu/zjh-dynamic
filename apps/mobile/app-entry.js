import { installShell } from "./src/runtime/shellSlot";
import { installApplicationPlatform } from "./src/runtime/applicationPlatform";
import { markStartup } from "./src/runtime/startupTiming";

markStartup("app-entry");
installApplicationPlatform();
markStartup("platform-ready");
const App = require("./App").default;
installShell(App);
markStartup("shell-installed");
