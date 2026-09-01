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

export function isMatchExcluded(matchId: string | undefined | null): boolean {
  if (!matchId) return false;
  const p = getStoragePath("excluded_matches.json");
  try {
    if (fs.existsSync(p)) {
      const list = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Array.isArray(list) && list.includes(matchId)) {
        return true;
      }
    }
  } catch (e) {}

  const fallbackExcluded = new Set([
    "1-33cb631c-9e98-4a87-94e0-c307fa6f999c",
    "1-61116a2e-6818-4505-8c91-1bcab96b3e13"
  ]);
  return fallbackExcluded.has(matchId);
}
