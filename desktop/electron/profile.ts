import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync, lstatSync } from "node:fs";
export function prepareProfile(command: string, args: string[], profile: string, base: string) {
  if (process.platform === "win32") {
    // Only the main-computed path is sent over stdin; never a renderer argument.
    const result = spawnSync(command,[...args,"--secure-profile"],{
      input:JSON.stringify({base,profile})+"\n",encoding:"utf8",timeout:15000,maxBuffer:4096,
      shell:false,windowsHide:true,env:Object.fromEntries(Object.entries({...process.env,PYTHONDONTWRITEBYTECODE:"1",PYTHONNOUSERSITE:"1"}).filter(([key]) => ["PATH","SystemRoot","SYSTEMROOT","WINDIR","TEMP","TMP","PYTHONDONTWRITEBYTECODE","PYTHONNOUSERSITE"].includes(key))),
    });
    let value;
    try { value=JSON.parse(result.stdout); } catch { throw Error("Windows profile security validation failed. No profile was opened."); }
    if(result.error || result.status !== 0 || value.profileReady !== true) throw Error("Windows profile security validation failed. No profile was opened.");
  } else {
    mkdirSync(profile,{recursive:true,mode:0o700});
    if(lstatSync(profile).isSymbolicLink()) throw Error("Unsafe preview profile");
  }
  const session=path.join(profile,"session");
  if(process.platform !== "win32") mkdirSync(session,{recursive:true,mode:0o700});
}
