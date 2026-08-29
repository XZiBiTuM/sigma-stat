import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { loadWeeklySkillData } from "@/lib/weekly_skill";

const LOCAL_FILE = path.join(process.cwd(), "src", "lib", "fantasy_picks.json");
const PERSISTENT_FILE = path.join(process.cwd(), "..", "sigma_persistent_fantasy_picks.json");
const OVERRIDES_LOCAL = path.join(process.cwd(), "src", "lib", "player_overrides.json");
const OVERRIDES_PERSISTENT = path.join(process.cwd(), "..", "sigma_persistent_player_overrides.json");

export interface CardBuff {
  id: string;
  name: string;
  icon: string;
  percent: number;
  desc: string;
}

export interface FantasyPick {
  userId: string; // steamId or custom ID
  userName: string;
  avatar?: string;
  faceitNickname?: string;
  sniper: { playerId: string; nickname: string; skillScore: number; buff?: CardBuff };
  support: { playerId: string; nickname: string; skillScore: number; penaltyApplied?: boolean; buff?: CardBuff };
  darkHorse: { playerId: string; nickname: string; skillScore: number; underdogBonus: number; buff?: CardBuff };
  submittedAt: string;
}

export const FANTASY_BUFFS = [
  { id: "headshot", name: "Хедшот-Машина", icon: "🎯", min: 10, max: 25, desc: "Прибавляет от +10% до +25% к очкам за хедшоты и фраги" },
  { id: "flow", name: "В потоке", icon: "🌊", min: 8, max: 20, desc: "Дает стабильную прибавку от +8% до +20% ко всем очкам карточки за турнир" },
  { id: "clutcher", name: "Клатчер", icon: "⚡", min: 12, max: 26, desc: "Увеличивает очки карточки на +12% ... +26% за взятые клатчи и победы" },
  { id: "tactician", name: "Тактик Раскидок", icon: "💣", min: 8, max: 20, desc: "Прибавляет от +8% до +20% к очкам за ассисты, флешки и урон от гранат" },
  { id: "joker", name: "Джокер (Крит)", icon: "🎲", min: 15, max: 30, desc: "Джекпот-усиление: дает самый высокий бонус в игре (до +30% к очкам)" },
  { id: "vampire", name: "Вампир", icon: "🧛", min: 0, max: 0, desc: "Забирает 15% очков у соседней карты (или по 10% с обеих, если по центру) и отдает этой карточке с бонусом +20%" },
  { id: "lucky_loser", name: "Неудачник?", icon: "🍀", min: 0, max: 0, desc: "Полностью отменяет любые штрафы за высокий скилл (Саппорт получает 100% очков, Лошадка не штрафуется)" }
];

export function getRandomBuff(): CardBuff {
  const buff = FANTASY_BUFFS[Math.floor(Math.random() * FANTASY_BUFFS.length)];
  let percent = 0;
  if (buff.max > buff.min) {
    percent = Math.floor(Math.random() * (buff.max - buff.min + 1)) + buff.min;
  }
  return {
    id: buff.id,
    name: buff.name,
    icon: buff.icon,
    percent,
    desc: buff.desc
  };
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

    // Dynamic Underdog Multiplier with Overpower Penalty (>65)
    let underdogBonus = 1.0;
    if (rawDarkSkill <= 65) {
      underdogBonus = Math.round((1.0 + ((65 - Math.max(15, rawDarkSkill)) / 50) * 0.40) * 100) / 100;
    } else {
      underdogBonus = Math.round(Math.max(0.60, 1.0 - ((rawDarkSkill - 65) / 30) * 0.40) * 100) / 100;
    }

    // Roll unique card buffs on save
    const TOUR_LOCAL_PATH = path.join(process.cwd(), "src", "lib", "fantasy_tournament.json");
    const TOUR_PERSISTENT_PATH = path.join(process.cwd(), "..", "sigma_persistent_fantasy_tournament.json");
    let tourStatus = "DRAFT_OPEN";
    try {
      let tourTarget = TOUR_LOCAL_PATH;
      const pStat = await fs.stat(TOUR_PERSISTENT_PATH).catch(() => null);
      if (pStat) tourTarget = TOUR_PERSISTENT_PATH;
      const tourData = await fs.readFile(tourTarget, "utf8");
      const tourObj = JSON.parse(tourData);
      if (tourObj?.status) tourStatus = tourObj.status;
    } catch {}

    if (tourStatus === "LIVE" || tourStatus === "COMPLETED") {
      return NextResponse.json({
        error: "Прием составов закрыт (турнир уже идет или завершен)."
      }, { status: 403 });
    }

    const allPicks = await getAllPicks();
    if (allPicks[userId]) {
      return NextResponse.json({
        error: "Состав уже зафиксирован и не может быть изменен! Менять игроков после получения усилений запрещено правилами турнира."
      }, { status: 403 });
    }

    // Roll unique card buffs on save
    const sniperBuff = getRandomBuff();
    const supportBuff = getRandomBuff();
    const darkHorseBuff = getRandomBuff();

    const newPick: FantasyPick = {
      userId,
      userName,
      avatar,
      faceitNickname,
      sniper: {
        playerId: sniper.playerId,
        nickname: sniper.nickname,
        skillScore: sniperSkill,
        buff: sniperBuff
      },
      support: {
        playerId: support.playerId,
        nickname: support.nickname,
        skillScore: supportSkill,
        penaltyApplied: supportSkill > 65,
        buff: supportBuff
      },
      darkHorse: {
        playerId: darkHorse.playerId,
        nickname: darkHorse.nickname,
        skillScore: rawDarkSkill,
        underdogBonus,
        buff: darkHorseBuff
      },
      submittedAt: new Date().toISOString()
    };

    allPicks[userId] = newPick;
    await savePicks(allPicks);

    return NextResponse.json({
      success: true,
      pick: newPick,
      message: "Ваш состав на Fantasy League успешно сохранен и карточки получили случайные усиления!"
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
