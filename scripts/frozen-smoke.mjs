import { run, python } from "./common.mjs";
if (process.platform !== "win32" || process.arch !== "x64")
  throw Error("Frozen backend smoke requires native Windows x64");
await run(
  python,
  [
    "-m",
    "pytest",
    "backend/tests/test_process.py",
    "-q",
    "--junitxml=reports/frozen-backend.xml",
  ],
  {
    env: {
      ...process.env,
      GMT_FROZEN_BACKEND:
        "backend/dist/gmt-windows-backend/gmt-windows-backend.exe",
    },
  },
);
