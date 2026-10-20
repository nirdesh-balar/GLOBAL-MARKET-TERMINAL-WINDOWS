import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { root, python, run } from "./common.mjs";
if (process.version !== "v22.23.3")
  throw Error("Use Node 22.23.3 (see .nvmrc).");
if (!process.env.npm_execpath) throw Error("Run npm run setup");
await run(process.execPath, [process.env.npm_execpath, "ci"]);
await run(process.execPath, ["node_modules/electron/install.js"]);
const bootstrap =
  process.env.GMT_PYTHON ||
  (process.platform === "win32" ? "python" : "python3.11");
const candidate = existsSync(python) ? python : bootstrap;
const version = spawnSync(
  candidate,
  ["-c", 'import sys; print(".".join(map(str,sys.version_info[:3])))'],
  { encoding: "utf8", shell: false },
);
if (version.status !== 0 || version.stdout.trim() !== "3.11.17")
  throw Error(
    "Python 3.11.17 required. Set GMT_PYTHON to its executable; existing environments are never deleted.",
  );
if (!existsSync(python))
  await run(bootstrap, ["-m", "venv", root + "/backend/.venv"]);
await run(python, [
  "-m",
  "pip",
  "install",
  "--require-hashes",
  "--only-binary=:all:",
  "-r",
  "backend/requirements.lock",
]);
console.log("Setup complete. Run npm run dev.");
