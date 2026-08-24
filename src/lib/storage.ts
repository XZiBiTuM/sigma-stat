import path from "path";
import fs from "fs";

export function getPersistentPath(filename: string): string {
  // If filename starts with sigma_persistent_
  const base = filename.startsWith("sigma_persistent_") ? filename : `sigma_persistent_${filename}`;
  const p1 = path.join("/root", base);
  if (fs.existsSync(p1)) return p1;

  const p2 = path.join(process.cwd(), "..", base);
  if (fs.existsSync(p2)) return p2;

  const p3 = path.join(process.cwd(), base);
  if (fs.existsSync(p3)) return p3;

  return p1;
}

export function getStoragePath(filename: string): string {
  // Candidate 0: Check persistent path first (for VPS deployments)
  const pPersist = getPersistentPath(filename);
  if (fs.existsSync(pPersist)) return pPersist;

  // Candidate 1: standard local path from process.cwd()
  const p1 = path.join(process.cwd(), "src", "lib", filename);
  if (fs.existsSync(p1)) return p1;

  // Candidate 2: sigma-stat subdirectory from /root
  const p2 = path.join(process.cwd(), "sigma-stat", "src", "lib", filename);
  if (fs.existsSync(p2)) return p2;

  // Candidate 3: absolute VPS path
  const p3 = path.join("/root", "sigma-stat", "src", "lib", filename);
  if (fs.existsSync(p3)) return p3;

  return p1;
}
