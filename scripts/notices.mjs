import fs from "node:fs";
import path from "node:path";
import { run, python } from "./common.mjs";
const base = "THIRD_PARTY_NOTICES";
fs.mkdirSync(base, { recursive: true });
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const rows = [];
for (const [key, entry] of Object.entries(lock.packages)) {
  if (!key || entry.dev) continue;
  const metadata = JSON.parse(
    fs.readFileSync(path.join(key, "package.json"), "utf8"),
  );
  const files = fs
    .readdirSync(key)
    .filter(
      (f) =>
        /^(licen[cs]e|copying|notice)(\.|$)/i.test(f) &&
        fs.statSync(path.join(key, f)).isFile(),
    );
  const target = path.join(base, "npm", metadata.name.replaceAll("/", "__"));
  fs.mkdirSync(target, { recursive: true });
  for (const file of files)
    fs.copyFileSync(path.join(key, file), path.join(target, file));
  rows.push({
    name: metadata.name,
    version: metadata.version,
    license: metadata.license ?? "REVIEW REQUIRED",
    source:
      typeof metadata.repository === "object"
        ? metadata.repository.url
        : metadata.repository,
    noticeFiles: files,
  });
}
fs.writeFileSync(
  path.join(base, "npm-inventory.json"),
  JSON.stringify(rows, null, 2) + "\n",
);
await run(python, ["scripts/python-notices.py"]);
