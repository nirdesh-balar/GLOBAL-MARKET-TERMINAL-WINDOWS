import { createServer } from "vite";
import electron from "electron";
import { spawn } from "node:child_process";
import { run, root } from "./common.mjs";
// Build once for a valid preload/main; Vite provides renderer hot reload.
await run(process.execPath, ["scripts/build.mjs"]);
const server = await createServer({ configFile: root + "/vite.config.ts" });
await server.listen();
const env = { ...process.env, GMT_WINDOWS_DEV: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [root], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: false,
});
let closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  await server.close();
  process.exitCode = code;
}
child.once("exit", (code) => void close(code ?? 1));
child.once("error", () => void close(1));
process.on("SIGINT", () => {
  child.kill("SIGTERM");
  void close();
});
process.on("SIGTERM", () => {
  child.kill("SIGTERM");
  void close();
});
