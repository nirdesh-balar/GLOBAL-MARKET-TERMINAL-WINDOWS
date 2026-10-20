import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const python = path.join(
  root,
  "backend",
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(
            Error(
              `${path.basename(command)} failed (exit ${code}, signal ${signal})`,
            ),
          ),
    );
  });
}
export function tool(name, args = []) {
  return run(process.execPath, [
    path.join(root, "node_modules", ...name.split("/")),
    ...args,
  ]);
}
