import { mkdirSync } from "node:fs";
import { run, tool, python } from "./common.mjs";
mkdirSync("reports", { recursive: true });
await tool("typescript/bin/tsc", ["--noEmit"]);
await run(process.execPath, ["scripts/build.mjs"]);
await run(process.execPath, [
  "--test",
  "--test-reporter=spec",
  "tests/security.test.mjs",
  "tests/backend.test.mjs",
  "tests/production.test.mjs",
]);
await run(python, [
  "-m",
  "pytest",
  "backend/tests",
  "-q",
  "--junitxml=reports/backend-tests.xml",
]);
await run(process.execPath, ["scripts/smoke.mjs"]);
