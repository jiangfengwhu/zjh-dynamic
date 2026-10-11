import { installShell } from "./src/runtime/shellSlot";
import { installApplicationPlatform } from "./src/runtime/applicationPlatform";
import { markStartup } from "./src/runtime/startupTiming";
import { beginDiscoveryStartup } from "./src/shell/discoveryStartup";

markStartup("app-entry");
installApplicationPlatform();
markStartup("platform-ready");
beginDiscoveryStartup();
const App = require("./App").default;
installShell(App);
markStartup("shell-installed");
