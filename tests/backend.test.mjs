import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { python, root } from "../scripts/common.mjs";
const require = createRequire(import.meta.url);
const { Backend } = require("../dist-electron/backend.cjs");
const temp = () => mkdtempSync(path.join(os.tmpdir(), "gmt-backend-test-"));
test("real backend starts, authenticates and shuts down only its owned child", async () => {
  const unrelated = spawn(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    { stdio: "ignore", shell: false },
  );
  const b = new Backend(
    python,
    [path.join(root, "backend/launcher.py")],
    temp(),
  );
  try {
    await b.start();
    assert.equal(b.status().state, "ready");
    assert.equal((await b.health()).providersConnected, false);
    assert.ok(!JSON.stringify(b).includes("token"));
    assert.deepEqual(Object.keys(b.status()).sort(), ["message", "state"]);
    await b.stop();
    assert.equal(b.status().state, "stopped");
    assert.equal(unrelated.exitCode, null);
    assert.equal(unrelated.signalCode, null);
    await assert.rejects(b.health(), /unavailable/);
  } finally {
    await b.stop();
    unrelated.kill();
  }
});
test("spawn failure is bounded and reported honestly", async () => {
  const b = new Backend(
    path.join(temp(), "missing-executable"),
    [],
    temp(),
    500,
  );
  await assert.rejects(b.start(), /startup failed/);
  assert.equal(b.status().state, "failed");
});
test("exit before readiness fails visibly", async () => {
  const b = new Backend(
    process.execPath,
    ["-e", "process.exit(2)"],
    temp(),
    1000,
  );
  await assert.rejects(b.start(), /startup failed/);
  assert.equal(b.status().state, "failed");
});
test("readiness timeout terminates the owned child and fails", async () => {
  const b = new Backend(
    process.execPath,
    ["-e", "process.stdin.resume();setInterval(()=>{},1000)"],
    temp(),
    100,
  );
  await assert.rejects(b.start(), /startup failed/);
  assert.equal(b.status().state, "failed");
});
test("malformed readiness is rejected", async () => {
  const b = new Backend(
    process.execPath,
    [
      "-e",
      'console.log(JSON.stringify({ready:true,host:"0.0.0.0",port:80}));process.stdin.resume()',
    ],
    temp(),
    1000,
  );
  await assert.rejects(b.start(), /startup failed/);
  assert.equal(b.status().state, "failed");
});
test("unexpected backend exit changes service status to failed", async () => {
  const code = `const http=require('node:http');process.stdin.once('data',()=>{const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ok',application:'GLOBAL MARKET TERMINAL',version:'0.1.0',phase:1,mode:'read-only',providersConnected:false,marketHistoryStorage:'none'}));});server.listen(0,'127.0.0.1',()=>{console.log(JSON.stringify({ready:true,host:'127.0.0.1',port:server.address().port}));setTimeout(()=>process.exit(3),400);});});`;
  const b = new Backend(process.execPath, ["-e", code], temp(), 2000);
  try {
    await b.start();
    await new Promise((resolve) => setTimeout(resolve, 650));
    assert.equal(b.status().state, "failed");
    await assert.rejects(b.health(), /unavailable/);
  } finally {
    await b.stop();
  }
});
