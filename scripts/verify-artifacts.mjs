import fs from "node:fs";
import { createHash } from "node:crypto";
const files = [
  "release/win-unpacked/GlobalMarketTerminalWindows.exe",
  "release/win-unpacked/resources/app.asar",
  "release/win-unpacked/resources/backend/gmt-windows-backend.exe",
  "release/GMT-Windows-0.1.0-dev-x64-Setup.exe",
];
for (const file of files)
  if (!fs.statSync(file).isFile())
    throw Error("Required artifact missing: " + file);
const rows = files.map((file) => ({
  file,
  bytes: fs.statSync(file).size,
  sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
}));
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/artifacts.json", JSON.stringify(rows, null, 2));
fs.writeFileSync(
  "release/SHA256SUMS.txt",
  rows.map((r) => r.sha256 + "  " + r.file).join("\n") + "\n",
);
console.log(rows);
