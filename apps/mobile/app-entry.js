import { installShell } from "./src/runtime/shellSlot";
import { installApplicationPlatform } from "./src/runtime/applicationPlatform";
import { installGlobalTypography } from "./src/runtime/globalTypography";

installGlobalTypography();
installApplicationPlatform();
const App = require("./App").default;
installShell(App);
