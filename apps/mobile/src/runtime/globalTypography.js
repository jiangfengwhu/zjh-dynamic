import React from "react";
const Native = require("react-native");

const pixelStyle = {
  fontFamily: "Fusion Pixel 12px Proportional SC",
  fontWeight: "normal",
  fontStyle: "normal",
};
const installed = Symbol.for("zijinhua.pixelTypography");

// Install before loading the shell or application modules. Preserve native text,
// refs, selection, accessibility and font scaling; only enforce typography.
export function installGlobalTypography() {
  for (const name of ["Text", "TextInput"]) {
    const Original = Native[name];
    if (Original[installed]) continue;
    const Pixel = React.forwardRef((props, ref) =>
      React.createElement(Original, {
        ...props,
        ref,
        style: [props.style, pixelStyle],
      })
    );
    Pixel.displayName = `Pixel${name}`;
    if (Original.State) Pixel.State = Original.State;
    Pixel[installed] = true;
    Object.defineProperty(Native, name, {
      configurable: true,
      enumerable: true,
      value: Pixel,
    });
  }
}
