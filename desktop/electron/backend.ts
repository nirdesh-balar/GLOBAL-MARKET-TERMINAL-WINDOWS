import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { Health, ServiceStatus } from "../shared/contracts";

function exited(child: ChildProcessWithoutNullStreams) {
  return child.exitCode !== null || child.signalCode !== null;
}
async function waitExit(child: ChildProcessWithoutNullStreams, ms: number) {
  if (exited(child)) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      child.removeListener("exit", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    child.once("exit", done);
    if (exited(child)) done();
  });
}
export async function stopOwnedChild(
  child: ChildProcessWithoutNullStreams | undefined,
  token: string,
  graceMs = 3000,
) {
  if (!child || exited(child) || !child.pid) return;
  child.stdin.on("error", () => {});
  child.stdin.end(JSON.stringify({ command: "shutdown", token }) + "\n");
  await waitExit(child, graceMs);
  if (!exited(child)) {
    child.kill("SIGTERM");
    await waitExit(child, 2000);
  }
  if (!exited(child))
    throw Error("Owned backend did not exit within the shutdown deadline");
}
export class Backend {
  #child?: ChildProcessWithoutNullStreams;
  #token = randomBytes(32).toString("hex");
  #port = 0;
  #stopping = false;
  #status: ServiceStatus = {
    state: "starting",
    message: "Starting authenticated local service",
  };
  #healthPending?: Promise<Health>;
  #healthAbort?: AbortController;
  #stopPending?: Promise<void>;
  constructor(
    private command: string,
    private args: string[],
    private cwd: string,
    private startupMs = 15000,
  ) {}
  status(): ServiceStatus {
    return { ...this.#status };
  }
  async start() {
    if (this.#child) throw Error("Backend already started");
    const env: NodeJS.ProcessEnv = {
      PYTHONUNBUFFERED: "1",
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONNOUSERSITE: "1",
    };
    // No provider credentials, tokens or arbitrary inherited Python hooks.
    for (const key of [
      "PATH",
      "SystemRoot",
      "SYSTEMROOT",
      "WINDIR",
      "TEMP",
      "TMP",
      "TMPDIR",
      "LANG",
    ])
      if (process.env[key]) env[key] = process.env[key];
    const child = (this.#child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    }));
    child.on("error", () => {
      if (!this.#stopping)
        this.#status = {
          state: "failed",
          message: "Local service process failed. Restart the application.",
        };
    });
    child.stdin.on("error", () => {});
    child.stderr.on("data", () => {});
    child.on("exit", () => {
      this.#port = 0;
      if (!this.#stopping)
        this.#status = {
          state: "failed",
          message:
            "Local service exited unexpectedly. Restart the application.",
        };
    });
    try {
      await new Promise<void>((resolve, reject) => {
        let output = "";
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          child.stdout.removeListener("data", data);
          child.removeListener("error", failed);
          child.removeListener("exit", earlyExit);
          error ? reject(error) : resolve();
        };
        const failed = () =>
          finish(
            Error("Local service could not be started. Run npm run setup."),
          );
        const earlyExit = () =>
          finish(Error("Local service exited before readiness"));
        const data = (chunk: Buffer) => {
          output += chunk.toString("utf8");
          if (output.length > 4096) {
            finish(Error("Invalid readiness response"));
            return;
          }
          const newline = output.indexOf("\n");
          if (newline < 0) return;
          try {
            const v = JSON.parse(output.slice(0, newline));
            if (
              !v || Object.keys(v).sort().join(",") !== "host,port,ready" ||
              v.ready !== true ||
              v.host !== "127.0.0.1" ||
              !Number.isInteger(v.port) ||
              v.port < 1 ||
              v.port > 65535
            )
              throw Error();
            this.#port = v.port;
            finish();
          } catch {
            finish(Error("Invalid readiness response"));
          }
        };
        const timer = setTimeout(
          () => finish(Error("Local service startup timed out")),
          this.startupMs,
        );
        child.once("error", failed);
        child.once("exit", earlyExit);
        child.stdout.on("data", data);
        child.stdin.write(JSON.stringify({ token: this.#token, parentPid: process.pid }) + "\n");
      });
      child.stdout.resume();
      await this.health();
      if (this.#stopping || exited(child))
        throw Error("Local service stopped during startup");
      this.#status = {
        state: "ready",
        message: "Local service ready · market providers disconnected",
      };
    } catch {
      this.#status = {
        state: "failed",
        message:
          "Local service startup failed. Check setup, then restart the application.",
      };
      await this.stop();
      this.#status = {
        state: "failed",
        message:
          "Local service startup failed. Check setup, then restart the application.",
      };
      throw Error(this.#status.message);
    }
  }
  async health(): Promise<Health> {
    if (this.#stopping || !this.#port)
      throw Error("Local service is unavailable");
    if (this.#healthPending) return this.#healthPending;
    this.#healthAbort = new AbortController();
    const signal = AbortSignal.any([this.#healthAbort.signal, AbortSignal.timeout(2000)]);
    this.#healthPending = (async () => {
      const response = await fetch(`http://127.0.0.1:${this.#port}/health`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.#token}` },
        redirect: "error",
        signal,
      });
      if (!response.ok) throw Error("Local health check failed");
      if (!response.body) throw Error("Invalid local response");
      const reader=response.body.getReader(); let size=0; const chunks: Buffer[]=[];
      try {
        for (;;) {
          const {done,value}=await reader.read(); if(done) break;
          size+=value.byteLength;
          if(size>4096) { await reader.cancel(); throw Error("Invalid local response"); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      const text=Buffer.concat(chunks).toString("utf8");
      const v = JSON.parse(text);
      if (
        v.status !== "ok" ||
        v.application !== "GLOBAL MARKET TERMINAL" ||
        v.version !== "0.1.0" ||
        v.phase !== 1 ||
        v.mode !== "read-only" ||
        v.providersConnected !== false ||
        v.marketHistoryStorage !== "none"
      )
        throw Error("Invalid local health response");
      return {
        status: "ok",
        application: v.application,
        version: "0.1.0",
        phase: 1,
        mode: "read-only",
        providersConnected: false,
        marketHistoryStorage: "none",
      };
    })();
    try {
      return await this.#healthPending;
    } catch {
      if (!this.#stopping)
        this.#status = {
          state: "failed",
          message:
            "Local service health check failed. Restart the application.",
        };
      throw Error("Local service health check failed");
    } finally {
      this.#healthPending = undefined;
    }
  }
  async stop() {
    if(this.#stopPending) return this.#stopPending;
    this.#stopping = true;
    this.#healthAbort?.abort();
    this.#stopPending=(async () => {
      await stopOwnedChild(this.#child, this.#token);
      this.#port = 0;
      this.#status = { state: "stopped", message: "Local service stopped" };
    })();
    return this.#stopPending;
  }
}
