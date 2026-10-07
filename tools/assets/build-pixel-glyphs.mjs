// Maintainer asset generation: node tools/assets/build-pixel-glyphs.mjs
// Keeps the authored SVG paths, with no image tooling/runtime dependency.
import fs from "node:fs";
import { deflateSync } from "node:zlib";
const directory = new URL("../../packages/ui/chrome/", import.meta.url);
const paths = JSON.parse(fs.readFileSync(new URL("pixelGlyphPaths.json", directory), "utf8"));
const size = 128;
function polygons(path) {
  if (/[^MmLlHhVvZz\d\s,.-]/.test(path)) throw new Error("Unsupported SVG command");
  const tokens = path.match(/[MmLlHhVvZz]|-?\d*\.?\d+/g);
  const result = []; let x = 0, y = 0, command, points;
  for (let i = 0; i < tokens.length;) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
    if (/^z$/i.test(command)) {
      if (!points?.length) throw new Error("Invalid closed path");
      [x, y] = points[0]; result.push(points); points = undefined; command = undefined; continue;
    }
    const relative = command === command?.toLowerCase();
    const a = Number(tokens[i++]); if (!Number.isFinite(a)) throw new Error("Invalid coordinate");
    switch (command?.toLowerCase()) {
      case "m": case "l": {
        const b = Number(tokens[i++]); if (!Number.isFinite(b)) throw new Error("Invalid coordinate");
        x = relative ? x + a : a; y = relative ? y + b : b;
        if (command.toLowerCase() === "m") { if (points) result.push(points); points = []; command = relative ? "l" : "L"; }
        break;
      }
      case "h": x = relative ? x + a : a; break;
      case "v": y = relative ? y + a : a; break;
      default: throw new Error("Missing SVG command");
    }
    points.push([x, y]);
  }
  if (points) result.push(points);
  return result;
}
function contains(polygons, x, y) {
  let inside = false;
  for (const points of polygons) for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = value >>> 1 ^ (value & 1 ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const data = Buffer.concat([Buffer.from(type), bytes]);
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc(data));
  return Buffer.concat([length, data, checksum]);
}
const sources = {};
for (const [name, path] of Object.entries(paths)) {
  const shape = polygons(path), raw = Buffer.alloc(size * (size * 2 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * (size * 2 + 1) + 1 + x * 2;
    raw[index] = 255;
    raw[index + 1] = contains(shape, (x + 0.5) * 16 / size, (y + 0.5) * 16 / size) ? 255 : 0;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 4;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  sources[name] = { uri: `data:image/png;base64,${png.toString("base64")}` };
}
fs.writeFileSync(new URL("pixelGlyphs.ts", directory), `// Generated from pixelGlyphPaths.json by tools/assets/build-pixel-glyphs.mjs.\nexport const pixelGlyphs = ${JSON.stringify(sources, null, 2)} as const;\n`);
console.log(`Generated ${Object.keys(sources).length} monochrome pixel glyphs (${size}px)`);
