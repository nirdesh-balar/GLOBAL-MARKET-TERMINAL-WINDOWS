import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {validateNative,operateWindow}=require("../dist-electron/native.cjs");
const {summarizeCsv,validateCsvPath}=require("../dist-electron/csv.cjs");
test("native IPC has bounded exact operations and no paths, URLs, commands or extra arguments", async () => {
  for(const op of ["state","minimize","maximize","restore","toggleMaximize","enterFullscreen","exitFullscreen","toggleFullscreen","focus","previewCsv"]) assert.equal(validateNative([op]),op);
  for(const args of [[],[null],[{}],["__proto__"],["close"],["loadURL"],["http://localhost"],["x".repeat(4096)],["state",{}],["previewCsv","/tmp/secret"]]) assert.throws(() => validateNative(args));
  await assert.rejects(operateWindow({},"loadURL"));
});
test("CSV preview only returns structural counts and rejects formulas/quoting/oversize/malformed UTF-8", () => {
  const b=Buffer.from("column1,column2\nvalue1,value2\n");
  assert.deepEqual(summarizeCsv(b),{cancelled:false,rows:2,columns:2,bytes:b.length});
  for(const b of [Buffer.alloc(0),Buffer.alloc(65537),Buffer.from([0xff]),Buffer.from('a,"b"'),Buffer.from('a,b\n=CMD(),c'),Buffer.from('a,b\nx'),Buffer.from('a\0b'),Buffer.from('x\n'.repeat(502))]) assert.throws(() => summarizeCsv(b));
});
test("CSV selection rejects paths outside a regular explicit local CSV and never writes content", async () => {
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),"gmt-csv-")));
  const file=path.join(root,"selected.csv");await fs.writeFile(file,"col1,col2\none,two\n");
  const before=await fs.readFile(file);assert.equal((await validateCsvPath(file)).rows,2);
  assert.deepEqual(await fs.readFile(file),before);
  for(const candidate of ["relative.csv",file+"\0",root,path.join(root,"nested","..","selected.csv")+path.sep+"..",path.join(root,"missing.csv")]) await assert.rejects(validateCsvPath(candidate));
  const folder=path.join(root,"folder.csv");await fs.mkdir(folder);await assert.rejects(validateCsvPath(folder));
  const redirect=path.join(root,"redirect");await fs.symlink(root,redirect,process.platform === "win32" ? "junction" : "dir");await assert.rejects(validateCsvPath(path.join(redirect,"selected.csv")));
});
