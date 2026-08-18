import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const LOCAL_FILE = path.join(process.cwd(), "src", "lib", "fantasy_picks.json");
const PERSISTENT_FILE = path.join(process.cwd(), "..", "sigma_persistent_fantasy_picks.json");

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
    const { userId, userName, avatar, faceitNickname, sniper, support, darkHorse } = body;

    if (!userId || !userName) {
      return NextResponse.json({ error: "Пожалуйста, авторизуйтесь через Steam для участия в Fantasy League" }, { status: 401 });
    }

    if (!sniper?.playerId || !support?.playerId || !darkHorse?.playerId) {
      return NextResponse.json({ error: "Необходимо заполнить все 3 слота (Снайпер, Саппорт, Темная лошадка)" }, { status: 400 });
    }

    // Check for duplicate players in one team
    const playerIds = [sniper.playerId, support.playerId, darkHorse.playerId];
    const uniqueIds = new Set(playerIds);
    if (uniqueIds.size !== 3) {
      return NextResponse.json({ error: "Нельзя выбирать одного и того же игрока на несколько ролей" }, { status: 400 });
    }

    // Calculate dynamic Underdog Bonus: 1.0 + ((100 - SkillScore) / 100) * 0.40
    const rawDarkSkill = Number(darkHorse.skillScore) || 50;
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
        skillScore: Number(sniper.skillScore) || 50
      },
      support: {
        playerId: support.playerId,
        nickname: support.nickname,
        skillScore: Number(support.skillScore) || 50
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
