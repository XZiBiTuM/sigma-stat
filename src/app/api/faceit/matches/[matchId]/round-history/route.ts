import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import * as fs from "fs";
import * as path from "path";

// Cache file path
const CACHE_FILE = path.join(process.cwd(), "src/lib/round_history_cache.json");

// Helper to read cache
function readCache(): Record<string, any> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(content || "{}");
    }
  } catch (e) {
    console.error("Failed to read round history cache:", e);
  }
  return {};
}

// Helper to write cache
function writeCache(data: Record<string, any>) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write round history cache:", e);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    if (!matchId) {
      return NextResponse.json({ error: "Не указан ID матча" }, { status: 400 });
    }

    // 2. Determine demo URL (either passed manually via query param or fetched from FACEIT)
    const { searchParams } = request.nextUrl;
    let demoUrl = searchParams.get("demoUrl");
    const mapIndex = parseInt(searchParams.get("mapIndex") || "0", 10);
    const cacheKey = `${matchId}_map${mapIndex}`;

    // 1. Check cache (only if we're not manually specifying a demoUrl and have valid cached rounds & deaths)
    if (!demoUrl) {
      const cache = readCache();
      if (cache[cacheKey] && cache[cacheKey].rounds && cache[cacheKey].rounds.length > 0 && cache[cacheKey].deaths) {
        return NextResponse.json(cache[cacheKey]);
      }
    }

    if (!demoUrl) {
      let matchDetails;
      try {
        matchDetails = await faceitFetch(`/matches/${matchId}`);
      } catch (err: any) {
        if (err.message === "API_KEY_MISSING") {
          return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
        }
        throw err;
      }

      const demoUrls = matchDetails?.demo_url;
      if (!demoUrls || demoUrls.length === 0) {
        return NextResponse.json({ rounds: [], source: "none", message: "Демка матча отсутствует" });
      }
      demoUrl = demoUrls[mapIndex];
      if (!demoUrl) {
        return NextResponse.json({ rounds: [], source: "none", message: `Демка для карты с индексом ${mapIndex} не найдена` });
      }
    }
    const tmpDir = path.join(process.cwd(), "tmp");
    const compressedPath = path.join(tmpDir, `${cacheKey}.dem.zst`);
    const decompressedPath = path.join(tmpDir, `${cacheKey}.dem`);

    // 3. Try to load parser and decompressor libraries
    let fzstd: any;
    let demoparser: any;
    try {
      fzstd = require("fzstd");
      demoparser = require("@laihoe/demoparser2");
    } catch (e: any) {
      console.warn("Dynamic load of demoparser2 or fzstd failed. Falling back to empty timeline.", e.message);
      return NextResponse.json({
        rounds: [],
        source: "fallback",
        message: "Компоненты парсера недоступны на этом сервере (например, Vercel)"
      });
    }

    if (!demoUrl) {
      return NextResponse.json({ error: "Ссылка на демку не найдена" }, { status: 400 });
    }

    // 4. Download demo file with DNS fallback
    console.log(`Downloading demo from: ${demoUrl}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });

    /**
     * Resilient fetch that handles:
     * 1. Normal redirect-following fetch
     * 2. DNS-over-HTTPS fallback when hostname can't be resolved
     * 3. Alternative URL transformations (Backblaze CDN → direct S3)
     */
    async function resilientFetch(url: string): Promise<Response> {
      // Attempt 1: Normal fetch (follows redirects automatically)
      try {
        const r = await fetch(url, { redirect: "follow" });
        if (r.ok) return r;
        console.warn(`Attempt 1 failed: HTTP ${r.status} for ${url}`);
        // Fall through to try alternatives on non-ok responses too
        if (r.status !== 401 && r.status !== 403) return r; // Only retry auth failures
      } catch (err: any) {
        const isNotFound = err?.cause?.code === "ENOTFOUND" || err?.cause?.code === "EAI_NONAME";
        if (!isNotFound) throw err;
        console.warn(`DNS resolution failed for ${url}, trying fallbacks...`);
      }

      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Attempt 2: DNS-over-HTTPS via Google (resolves real IP even if local DNS fails)
      try {
        console.log(`Resolving ${hostname} via Google DoH...`);
        const dohRes = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`, {
          headers: { Accept: "application/dns-json" }
        });
        const dohData = await dohRes.json();
        const aRecord = (dohData.Answer || []).find((a: any) => a.type === 1);
        if (aRecord?.data) {
          const resolvedIp = aRecord.data;
          console.log(`Resolved ${hostname} → ${resolvedIp}, retrying download...`);
          const ipUrl = url.replace(hostname, resolvedIp);
          const r = await fetch(ipUrl, {
            redirect: "follow",
            headers: { Host: hostname }
          });
          if (r.ok) return r;
          console.warn(`DoH attempt failed: HTTP ${r.status}`);
        }
      } catch (dohErr: any) {
        console.warn("DoH lookup failed:", dohErr.message);
      }

      // Attempt 3: Try alternative Backblaze URL pattern
      // CDN: demos-europe-central.backblaze.faceit-cdn.net/cs2/FILE
      // S3:  demos-europe-central-faceit-cdn.s3.eu-central-003.backblazeb2.com/cs2/FILE
      if (hostname.includes("faceit-cdn.net")) {
        const region = hostname.split(".")[0]; // e.g. "demos-europe-central"
        const s3Hostname = `${region}-faceit-cdn.s3.eu-central-003.backblazeb2.com`;
        const altUrl = url.replace(hostname, s3Hostname);
        console.log(`Trying alternative S3 URL: ${altUrl}`);
        try {
          const r = await fetch(altUrl, { redirect: "follow" });
          if (r.ok) return r;
          console.warn(`Alt S3 attempt failed: HTTP ${r.status}`);
        } catch (altErr: any) {
          console.warn("Alt S3 URL failed:", altErr.message);
        }
      }

      throw new Error(`Не удалось скачать демку (исчерпаны все способы): ${url}`);
    }

    const response = await resilientFetch(demoUrl);
    if (!response.ok) {
      throw new Error(`Не удалось скачать демку: Код ${response.status} (${response.statusText || "Без описания"})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(compressedPath, Buffer.from(arrayBuffer));

    // 5. Decompress ZST
    console.log(`Decompressing ${compressedPath}...`);
    const compressedData = await fs.promises.readFile(compressedPath);
    const decompressedData = fzstd.decompress(compressedData);
    await fs.promises.writeFile(decompressedPath, decompressedData);

    // 6. Parse events
    console.log(`Parsing events from ${decompressedPath}...`);
    // Event "round_end" fields: winner, reason, message
    const events = demoparser.parseEvent(decompressedPath, "round_end");

    // Parse "player_death" events with positions
    let rawDeaths = [];
    try {
      rawDeaths = demoparser.parseEvent(decompressedPath, "player_death", ["X", "Y"]) || [];
    } catch (e: any) {
      console.warn("Failed to parse player_death events:", e.message);
    }

    // Clean up files immediately to save space
    await fs.promises.unlink(compressedPath).catch(() => {});
    await fs.promises.unlink(decompressedPath).catch(() => {});

    if (!Array.isArray(events)) {
      throw new Error("Неверный формат ответа от парсера демок");
    }

    console.log(`Parsed ${events.length} raw round_end events and ${rawDeaths.length} deaths.`);
    if (events.length > 0) {
      console.log("Sample raw events:", JSON.stringify(events.slice(0, 3), null, 2));
    }

    // 7. Process events
    // Filter events to find competitive rounds.
    // In CS2, winner can be "T" / "CT" or 2 (T) / 3 (CT).
    const validEvents = events.filter((e: any) => {
      const w = e.winner;
      return w === "T" || w === "CT" || w === 2 || w === 3;
    });

    // Map reasons to frontend representations
    const rounds = validEvents.map((e: any, index: number) => {
      const winnerStr = (e.winner === 3 || e.winner === "CT") ? "CT" : "T";
      
      let reasonStr = "elimination";
      const reasonVal = String(e.reason || "").toLowerCase();
      const messageVal = String(e.message || "").toLowerCase();

      if (
        reasonVal.includes("bombed") ||
        reasonVal.includes("exploded") ||
        reasonVal === "1" ||
        messageVal.includes("target_bombed") ||
        messageVal.includes("exploded")
      ) {
        reasonStr = "bomb_exploded";
      } else if (
        reasonVal.includes("defused") ||
        reasonVal === "7" ||
        messageVal.includes("bomb_defused")
      ) {
        reasonStr = "bomb_defused";
      } else if (
        reasonVal.includes("expired") ||
        reasonVal === "12" ||
        messageVal.includes("time_expired")
      ) {
        reasonStr = "time_expired";
      }

      return {
        round: index + 1,
        winner: winnerStr,
        reason: reasonStr,
        tick: e.tick
      };
    });

    if (rawDeaths.length > 0) {
      const sample = rawDeaths[0];
      const sampleKeys = Object.keys(sample);
      console.log("DEBUG rawDeath keys:", JSON.stringify(sampleKeys));
      console.log("DEBUG rawDeath sample:", JSON.stringify(sample));
    }

    // Process and simplify player death events for frontend
    // demoparser2 returns coordinates with various prefix conventions depending on version:
    // - attacker: attacker_X / attacker_x / attacker_pos_x
    // - victim (user): user_X / user_x / user_pos_x / victim_X
    const getCoord = (obj: any, ...keys: string[]): number | null => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      }
      return null;
    };

    const deaths = rawDeaths.map((d: any) => {
      const atkX = getCoord(d, "attacker_X", "attacker_x", "attacker_pos_x");
      const atkY = getCoord(d, "attacker_Y", "attacker_y", "attacker_pos_y");
      const vicX = getCoord(d, "user_X", "user_x", "user_pos_x", "victim_X", "victim_x");
      const vicY = getCoord(d, "user_Y", "user_y", "user_pos_y", "victim_Y", "victim_y");

      return {
        tick: d.tick,
        attackerName: d.attacker_name || d.attacker || null,
        attackerTeam: d.attacker_team || d.attacker_team_name || null,
        attackerX: atkX,
        attackerY: atkY,
        victimName: d.user_name || d.user || d.victim || null,
        victimTeam: d.user_team || d.user_team_name || null,
        victimX: vicX,
        victimY: vicY,
        weapon: d.weapon || "unknown",
        headshot: !!d.headshot
      };
    });

    const result = {
      rounds,
      deaths,
      source: "parsed"
    };

    // 8. Save cache and return
    const currentCache = readCache();
    currentCache[cacheKey] = result;
    writeCache(currentCache);

    console.log(`Successfully parsed ${rounds.length} rounds for match ${matchId} (map ${mapIndex})`);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error in round-history parser:", error);
    // Return graceful fallback so page doesn't break
    return NextResponse.json({
      rounds: [],
      source: "error",
      error: error.message || "Не удалось спарсить ход игры"
    });
  }
}
