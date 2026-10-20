import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { run, tool, python } from "./common.mjs";
// Guard before any build, download or output mutation.
if (process.platform !== "win32" || process.arch !== "x64")
  throw Error(
    "Windows packaging requires a native Windows x64 runner. Use GitHub Actions windows-2022; macOS cross-packaging is disabled.",
  );
if (
  existsSync("release") ||
  existsSync("backend/dist") ||
  existsSync("backend/build")
)
  throw Error(
    "Packaging output already exists. Preserve it; use a fresh independent checkout. No directories are deleted.",
  );
await tool("typescript/bin/tsc", ["--noEmit"]);
await run(process.execPath, ["scripts/build.mjs"]);
await run(python, [
  "-m",
  "PyInstaller",
  "--noconfirm",
  "--onedir",
  "--console",
  "--name",
  "gmt-windows-backend",
  "--distpath",
  "backend/dist",
  "--workpath",
  "backend/build",
  "--specpath",
  "backend/build",
  "--paths",
  "backend",
  "--collect-all",
  "uvicorn",
  "backend/launcher.py",
]);
await run(process.execPath, ["scripts/frozen-smoke.mjs"]);
const require = createRequire(import.meta.url);
const { build, Platform, Arch } = require("electron-builder");
await build({
  targets: Platform.WINDOWS.createTarget(["dir", "nsis"], Arch.x64),
  publish: "never",
  config: "electron-builder.yml",
});
await run(process.execPath, ["scripts/verify-artifacts.mjs"]);
