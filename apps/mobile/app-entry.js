import { installShell } from "./src/runtime/shellSlot";
import { installApplicationPlatform } from "./src/runtime/applicationPlatform";

installApplicationPlatform();
const App = require("./App").default;
installShell(App);
