import { build as bundle } from "esbuild";
import { build as renderer } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { root } from "./common.mjs";
import path from "node:path";
await renderer({ configFile: path.join(root, "vite.config.ts") });
await bundle({
  entryPoints: [
    "desktop/electron/main.ts",
    "desktop/electron/preload.ts",
    "desktop/electron/platform.ts",
    "desktop/electron/security.ts",
    "desktop/electron/backend.ts",
    "desktop/electron/native.ts",
    "desktop/electron/csv.ts",
  ],
  outdir: "dist-electron",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
});
const index = path.join(root, "dist/index.html");
const html = await readFile(index, "utf8");
const csp =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";
await writeFile(
  index,
  html.replace(/content="default-src[^"]*"/, `content="${csp}"`),
);
