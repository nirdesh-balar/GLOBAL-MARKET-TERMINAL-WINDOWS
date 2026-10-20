import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import type { CsvPreview } from "../shared/contracts";
export const MAX_CSV_BYTES = 65536;
// Deliberately limited CSV dialect: plain UTF-8 comma-separated cells; no quoted
// fields, multiline cells, formulas or import semantics. Return counts, not data.
export function summarizeCsv(bytes: Uint8Array): CsvPreview {
  if (!bytes.length || bytes.length > MAX_CSV_BYTES) throw Error("Invalid CSV size");
  const text = new TextDecoder("utf-8", {fatal:true}).decode(bytes).replace(/^\uFEFF/, "");
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f"]/.test(text) || text.includes('"')) throw Error("Unsupported CSV format");
  const lines = text.replace(/\r\n/g,"\n").trimEnd().split("\n");
  if (lines.length > 501) throw Error("Too many rows");
  const rows = lines.map(line => line.split(","));
  const columns = rows[0].length;
  if (columns < 1 || columns > 16 || rows.some(row => row.length !== columns || row.some(cell => cell.length > 128 || /^[\s]*[=+@-]/.test(cell)))) throw Error("Unsupported CSV cells");
  return {cancelled:false, rows:rows.length, columns, bytes:bytes.length};
}
export async function validateCsvPath(selected: string, helper?: {command:string; args:string[]}): Promise<CsvPreview> {
  if (typeof selected !== "string" || selected.length > 1024 || !path.isAbsolute(selected) || path.extname(selected).toLowerCase() !== ".csv" || selected.includes("\0") || (process.platform === "win32" && (!/^[A-Za-z]:\\/.test(selected) || selected.slice(2).includes(":")))) throw Error("Invalid selection");
  const normalized = path.normalize(selected);
  if (normalized !== selected || selected.split(/[\\/]/).some(v => v === ".." || v === ".")) throw Error("Invalid selection");
  if(process.platform === "win32") {
    const command=helper?.command ?? path.join(process.cwd(),"backend/.venv/Scripts/python.exe");
    const args=helper?.args ?? [path.join(process.cwd(),"backend/launcher.py")];
    const bytes=await new Promise<Buffer>((resolve,reject) => {
      const env:NodeJS.ProcessEnv={PYTHONDONTWRITEBYTECODE:"1",PYTHONNOUSERSITE:"1"};
      for(const key of ["PATH","SystemRoot","SYSTEMROOT","WINDIR","TEMP","TMP"]) if(process.env[key])env[key]=process.env[key];
      const child=spawn(command,[...args,"--preview-file"],{shell:false,windowsHide:true,stdio:["pipe","pipe","pipe"],env});
      let output="", failed=false;
      const timer=setTimeout(() => {failed=true;child.kill();reject(Error("Selection validation timed out"));},3000);
      child.on("error",() => {clearTimeout(timer);reject(Error("Selection unavailable"));});
      child.stdin.on("error",() => {});child.stderr.on("data",()=>{});
      child.stdout.on("data",chunk => {output+=chunk.toString("utf8");if(output.length>100000){failed=true;child.kill();reject(Error("Selection too large"));}});
      child.on("close",code => {
        clearTimeout(timer);if(failed)return;
        try {const value=JSON.parse(output);if(code!==0 || typeof value.bytes!=="string" || value.bytes.length>87384)throw Error();resolve(Buffer.from(value.bytes,"base64"));}
        catch {reject(Error("Selection rejected"));}
      });
      child.stdin.end(JSON.stringify({path:selected})+"\n");
    });
    return summarizeCsv(bytes);
  }
  // macOS preview: conservative no-follow path and bounded descriptor read.
  const parsed = path.parse(selected);
  let current = parsed.root;
  for (const segment of selected.slice(parsed.root.length).split(path.sep)) {
    current = path.join(current,segment);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw Error("Redirected selection");
  }
  if (await fs.realpath(selected) !== selected) throw Error("Redirected selection");
  const file = await fs.open(selected, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size < 1 || before.size > MAX_CSV_BYTES) throw Error("Invalid selected file");
    const buffer = Buffer.alloc(MAX_CSV_BYTES+1);
    const {bytesRead} = await file.read(buffer,0,buffer.length,0);
    const after = await file.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytesRead !== before.size) throw Error("Selection changed");
    return summarizeCsv(buffer.subarray(0,bytesRead));
  } finally { await file.close(); }
}
