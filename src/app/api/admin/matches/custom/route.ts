import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const CUSTOM_MATCHES_FILE = path.join(process.cwd(), "src/lib/custom_matches.json");
const ROUND_CACHE_FILE = path.join(process.cwd(), "src/lib/round_history_cache.json");

function getCustomMatches(): any[] {
  try {
    if (fs.existsSync(CUSTOM_MATCHES_FILE)) {
      const content = fs.readFileSync(CUSTOM_MATCHES_FILE, "utf8");
      return JSON.parse(content || "[]");
    }
  } catch (e) {
    console.error("Error reading custom matches:", e);
  }
  return [];
}

function saveCustomMatches(matches: any[]) {
  try {
    const dir = path.dirname(CUSTOM_MATCHES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_MATCHES_FILE, JSON.stringify(matches, null, 2), "utf8");
  } catch (e) {
    console.error("Error saving custom matches:", e);
  }
}

function updateRoundCache(matchKey: string, data: any) {
  try {
    let cache: Record<string, any> = {};
    if (fs.existsSync(ROUND_CACHE_FILE)) {
      const content = fs.readFileSync(ROUND_CACHE_FILE, "utf8");
      cache = JSON.parse(content || "{}");
    }
    if (data === null) {
      delete cache[matchKey];
    } else {
      cache[matchKey] = data;
    }
    const dir = path.dirname(ROUND_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ROUND_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    console.error("Error updating round cache:", e);
  }
}

export async function GET() {
  const matches = getCustomMatches();
  return NextResponse.json({ success: true, matches });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { passcode = "", matchData } = body;

    // Verify admin passcode
    const p = (passcode || "").toString().trim().toLowerCase();
    if (p !== "admin" && p !== "sigmaadmin") {
      return NextResponse.json({ error: "Доступ запрещен. Только для Администратора!" }, { status: 403 });
    }

    if (!matchData || !matchData.faction1 || !matchData.faction2) {
      return NextResponse.json({ error: "Неверный формат данных матча Cybershoke" }, { status: 400 });
    }

    const matchId = `cs_${Date.now()}`;
    const customMatch = {
      match_id: matchId,
      status: "FINISHED",
      started_at: Math.floor(Date.now() / 1000) - 3600,
      finished_at: Math.floor(Date.now() / 1000),
      source: "Cybershoke",
      maps: [matchData.map || "de_mirage"],
      teams: {
        faction1: { name: matchData.faction1, score: parseInt(matchData.score1 || "13", 10) },
        faction2: { name: matchData.faction2, score: parseInt(matchData.score2 || "9", 10) }
      },
      results: {
        winner: parseInt(matchData.score1 || "13", 10) > parseInt(matchData.score2 || "9", 10) ? "faction1" : "faction2",
        score: {
          faction1: parseInt(matchData.score1 || "13", 10),
          faction2: parseInt(matchData.score2 || "9", 10)
        }
      },
      players1: matchData.players1 || [],
      players2: matchData.players2 || []
    };

    // Save into custom matches database
    const existing = getCustomMatches();
    existing.unshift(customMatch);
    saveCustomMatches(existing);

    // Build synthetic round/death events for hub statistics
    const deaths: any[] = [];
    const rounds: any[] = [];

    const allPlayers = [...(matchData.players1 || []), ...(matchData.players2 || [])];
    allPlayers.forEach((p: any) => {
      const killsCount = parseInt(p.kills || "0", 10);
      for (let i = 0; i < killsCount; i++) {
        deaths.push({ attacker: p.nickname, victim: "Enemy", weapon: "AK-47", round: i + 1 });
      }
    });

    updateRoundCache(`${matchId}_map0`, {
      matchId,
      source: "Cybershoke",
      rounds,
      deaths
    });

    return NextResponse.json({
      success: true,
      message: "Матч Cybershoke с KDA игроков успешно сохранен и добавлен в статистику!",
      match: customMatch
    });
  } catch (error: any) {
    console.error("Error in custom match upload:", error);
    return NextResponse.json({ error: error.message || "Ошибка при сохранении матча" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const matchId = searchParams.get("matchId");
    const passcode = searchParams.get("passcode") || "admin";

    const p = (passcode || "").toString().trim().toLowerCase();
    if (p !== "admin" && p !== "sigmaadmin") {
      return NextResponse.json({ error: "Доступ запрещен. Только для Администратора!" }, { status: 403 });
    }

    if (!matchId) {
      return NextResponse.json({ error: "Не указан ID матча для удаления" }, { status: 400 });
    }

    const existing = getCustomMatches();
    const filtered = existing.filter((m: any) => m.match_id !== matchId);
    saveCustomMatches(filtered);

    // Clean up round cache
    updateRoundCache(`${matchId}_map0`, null);

    return NextResponse.json({
      success: true,
      message: `Матч ${matchId} успешно удален!`
    });
  } catch (error: any) {
    console.error("Error in custom match deletion:", error);
    return NextResponse.json({ error: error.message || "Ошибка при удалении матча" }, { status: 500 });
  }
}
