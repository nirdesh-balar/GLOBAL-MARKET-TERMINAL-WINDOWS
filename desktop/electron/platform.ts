import path from "node:path";
export function backendExecutable(
  root: string,
  packaged: boolean,
  platform = process.platform,
) {
  const p = platform === "win32" ? path.win32 : path.posix;
  return packaged
    ? p.join(
        root,
        "backend",
        platform === "win32"
          ? "gmt-windows-backend.exe"
          : "gmt-windows-backend",
      )
    : p.join(
        root,
        "backend",
        ".venv",
        platform === "win32" ? "Scripts" : "bin",
        platform === "win32" ? "python.exe" : "python",
      );
}
export function profilePath(
  platform: string,
  appData: string,
  projectRoot: string,
) {
  if (platform === "win32")
    return path.win32.join(appData, "GlobalMarketTerminalWindows.Native", "Desktop");
  if (platform === "darwin")
    return path.posix.join(projectRoot, ".local-profile", "mac-preview");
  throw Error(
    "Only Windows distribution and macOS development preview are supported",
  );
}
export function assertWindowsPackaging(
  platform = process.platform,
  arch = process.arch,
) {
  if (platform !== "win32" || arch !== "x64")
    throw Error(
      "Windows packaging requires a native Windows x64 runner. Use GitHub Actions windows-2022; macOS cross-packaging is disabled.",
    );
}
