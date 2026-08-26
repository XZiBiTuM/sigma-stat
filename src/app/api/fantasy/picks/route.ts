import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { loadWeeklySkillData } from "@/lib/weekly_skill";

const LOCAL_FILE = path.join(process.cwd(), "src", "lib", "fantasy_picks.json");
const PERSISTENT_FILE = path.join(process.cwd(), "..", "sigma_persistent_fantasy_picks.json");
const OVERRIDES_LOCAL = path.join(process.cwd(), "src", "lib", "player_overrides.json");
const OVERRIDES_PERSISTENT = path.join(process.cwd(), "..", "sigma_persistent_player_overrides.json");

interface FantasyPick {
  userId: string; // steamId or custom ID
  userName: string;
  avatar?: string;
  faceitNickname?: string;
  sniper: { playerId: string; nickname: string; skillScore: number };
  support: { playerId: string; nickname: string; skillScore: number };
  darkHorse: { playerId: string; nickname: string; skillScore: number; underdogBonus: number };
  submittedAt: string;
}

async function getAllPicks(): Promise<Record<string, FantasyPick>> {
  let fileToRead = LOCAL_FILE;
  try {
    const pStat = await fs.stat(PERSISTENT_FILE).catch(() => null);
    if (pStat) fileToRead = PERSISTENT_FILE;
    const data = await fs.readFile(fileToRead, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function getOverrides(): Promise<Record<string, any>> {
  let fileToRead = OVERRIDES_LOCAL;
  try {
    const pStat = await fs.stat(OVERRIDES_PERSISTENT).catch(() => null);
    if (pStat) fileToRead = OVERRIDES_PERSISTENT;
    const data = await fs.readFile(fileToRead, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function resolvePlayerSkillScore(player: any, overrides: any, weeklyPlayers: Record<string, any>): number {
  if (!player) return 50;
  const pId = player.playerId || "";
  const nick = player.nickname || "";
  const nickLower = nick.toLowerCase();

  // 1. Check weekly skill data
  if (pId && weeklyPlayers[pId]?.currentScore) return weeklyPlayers[pId].currentScore;
  for (const key of Object.keys(weeklyPlayers)) {
    const wp = weeklyPlayers[key];
    if (wp && (wp.playerId === pId || wp.nickname?.toLowerCase() === nickLower)) {
      return wp.currentScore;
    }
  }

  // 2. Check player overrides
  const ov = (pId && overrides[pId]) || (nick && overrides[nick]) || (nickLower && overrides[nickLower]);
  if (ov?.customSkillScore) return ov.customSkillScore;

  // 3. Pick skill score
  if (player.skillScore && player.skillScore !== 50) return Number(player.skillScore);

  return 50;
}

async function savePicks(picks: Record<string, FantasyPick>) {
  const jsonStr = JSON.stringify(picks, null, 2);
  try {
    const dir = path.dirname(LOCAL_FILE);
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    await fs.writeFile(LOCAL_FILE, jsonStr, "utf8");
  } catch (e) {}
  try {
    await fs.writeFile(PERSISTENT_FILE, jsonStr, "utf8");
  } catch (e) {}
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get("userId");
  const picks = await getAllPicks();

  if (userId) {
    return NextResponse.json({ success: true, pick: picks[userId] || null });
  }

  return NextResponse.json({ success: true, picks });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let { userId, userName, avatar, faceitNickname, sniper, support, darkHorse } = body;

    if (!userName || typeof userName !== "string" || !userName.trim()) {
      return NextResponse.json({ error: "Пожалуйста, укажите ваш никнейм для участия в Fantasy League" }, { status: 400 });
    }

    userName = userName.trim();
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      userId = `guest_${userName.toLowerCase().replace(/[^a-z0-9а-яё_]/gi, "_")}`;
    }

    if (!sniper?.playerId || !support?.playerId || !darkHorse?.playerId) {
      return NextResponse.json({ error: "Необходимо заполнить все 3 слота (Стар-плеер, Саппорт, Темная лошадка)" }, { status: 400 });
    }

    // Check for duplicate players in one team
    const playerIds = [sniper.playerId, support.playerId, darkHorse.playerId];
    const uniqueIds = new Set(playerIds);
    if (uniqueIds.size !== 3) {
      return NextResponse.json({ error: "Нельзя выбирать одного и того же игрока на несколько ролей" }, { status: 400 });
    }

    const overrides = await getOverrides();
    const weeklyData = await loadWeeklySkillData().catch(() => ({ players: {} }));
    const weeklyPlayers = weeklyData?.players || {};

    const sniperSkill = resolvePlayerSkillScore(sniper, overrides, weeklyPlayers);
    const supportSkill = resolvePlayerSkillScore(support, overrides, weeklyPlayers);
    const rawDarkSkill = resolvePlayerSkillScore(darkHorse, overrides, weeklyPlayers);
    const underdogBonus = Math.round((1.0 + ((100 - Math.min(100, Math.max(10, rawDarkSkill))) / 100) * 0.40) * 100) / 100;

    const allPicks = await getAllPicks();
    const newPick: FantasyPick = {
      userId,
      userName,
      avatar,
      faceitNickname,
      sniper: {
        playerId: sniper.playerId,
        nickname: sniper.nickname,
        skillScore: sniperSkill
      },
      support: {
        playerId: support.playerId,
        nickname: support.nickname,
        skillScore: supportSkill
      },
      darkHorse: {
        playerId: darkHorse.playerId,
        nickname: darkHorse.nickname,
        skillScore: rawDarkSkill,
        underdogBonus
      },
      submittedAt: new Date().toISOString()
    };

    allPicks[userId] = newPick;
    await savePicks(allPicks);

    return NextResponse.json({
      success: true,
      pick: newPick,
      message: "Ваш состав на Fantasy League успешно сохранен!"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ошибка сохранения состава" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("userId");
    const clearAll = searchParams.get("all") === "true";

    const allPicks = await getAllPicks();

    if (clearAll) {
      await savePicks({});
      return NextResponse.json({
        success: true,
        message: "Все прогнозы Fantasy League успешно удалены"
      });
    }

    if (!userId) {
      return NextResponse.json({ error: "Не указан userId для удаления" }, { status: 400 });
    }

    if (!allPicks[userId]) {
      return NextResponse.json({ error: "Прогноз с таким userId не найден" }, { status: 404 });
    }

    delete allPicks[userId];
    await savePicks(allPicks);

    return NextResponse.json({
      success: true,
      message: "Прогноз успешно удален"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ошибка удаления прогноза" }, { status: 500 });
  }
}
