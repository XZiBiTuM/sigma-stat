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

    // 1. Check cache
    const cache = readCache();
    if (cache[matchId]) {
      return NextResponse.json(cache[matchId]);
    }

    // 2. Determine demo URL (either passed manually via query param or fetched from FACEIT)
    const { searchParams } = request.nextUrl;
    let demoUrl = searchParams.get("demoUrl");

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
      demoUrl = demoUrls[0]; // Use first map demo
    }
    const tmpDir = path.join(process.cwd(), "tmp");
    const compressedPath = path.join(tmpDir, `${matchId}.dem.zst`);
    const decompressedPath = path.join(tmpDir, `${matchId}.dem`);

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

    // 4. Download demo file
    console.log(`Downloading demo from: ${demoUrl}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });
    
    const response = await fetch(demoUrl);
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

    // Clean up files immediately to save space
    await fs.promises.unlink(compressedPath).catch(() => {});
    await fs.promises.unlink(decompressedPath).catch(() => {});

    if (!Array.isArray(events)) {
      throw new Error("Неверный формат ответа от парсера демок");
    }

    // 7. Process events
    // Filter events to find competitive rounds.
    // In CS2, winner = 2 (T), winner = 3 (CT).
    const validEvents = events.filter((e: any) => e.winner === 2 || e.winner === 3);

    // Map reasons to frontend representations
    // reasons mapping in CS2:
    // 1 = Target Bombed (T win)
    // 7 = Bomb Defused (CT win)
    // 8 = CT win (Elimination)
    // 9 = T win (Elimination)
    // 12 = Time Expired (CT win)
    const rounds = validEvents.map((e: any, index: number) => {
      let reasonStr = "elimination";
      if (e.reason === 1) reasonStr = "bomb_exploded";
      else if (e.reason === 7) reasonStr = "bomb_defused";
      else if (e.reason === 12) reasonStr = "time_expired";
      else if (e.message && e.message.includes("Bomb_Defused")) reasonStr = "bomb_defused";
      else if (e.message && e.message.includes("Target_Bombed")) reasonStr = "bomb_exploded";

      return {
        round: index + 1,
        winner: e.winner === 3 ? "CT" : "T",
        reason: reasonStr,
        tick: e.tick
      };
    });

    const result = {
      rounds,
      source: "parsed"
    };

    // 8. Save cache and return
    const currentCache = readCache();
    currentCache[matchId] = result;
    writeCache(currentCache);

    console.log(`Successfully parsed ${rounds.length} rounds for match ${matchId}`);
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
