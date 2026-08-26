import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { loadWeeklySkillData } from "@/lib/weekly_skill";

const PICKS_LOCAL = path.join(process.cwd(), "src", "lib", "fantasy_picks.json");
const PICKS_PERSISTENT = path.join(process.cwd(), "..", "sigma_persistent_fantasy_picks.json");

const TOUR_LOCAL = path.join(process.cwd(), "src", "lib", "fantasy_tournament.json");
const TOUR_PERSISTENT = path.join(process.cwd(), "..", "sigma_persistent_fantasy_tournament.json");

const OVERRIDES_LOCAL = path.join(process.cwd(), "src", "lib", "player_overrides.json");
const OVERRIDES_PERSISTENT = path.join(process.cwd(), "..", "sigma_persistent_player_overrides.json");

async function readJsonFile(localPath: string, persistentPath: string) {
  let target = localPath;
  try {
    const pStat = await fs.stat(persistentPath).catch(() => null);
    if (pStat) target = persistentPath;
    const data = await fs.readFile(target, "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function getPlayerSkill(player: any, overrides: any, weeklyPlayers: Record<string, any>): number {
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

  // 3. Check pick skillScore if valid and not default 50
  if (player.skillScore && player.skillScore !== 50) return Number(player.skillScore);

  return 50;
}

export async function GET() {
  try {
    const picks = await readJsonFile(PICKS_LOCAL, PICKS_PERSISTENT);
    const tour = await readJsonFile(TOUR_LOCAL, TOUR_PERSISTENT);
    const overrides = await readJsonFile(OVERRIDES_LOCAL, OVERRIDES_PERSISTENT);
    const weeklyData = await loadWeeklySkillData().catch(() => ({ players: {} }));
    const weeklyPlayers = weeklyData?.players || {};

    const isLiveOrDone = tour?.status === "LIVE" || tour?.status === "COMPLETED";

    const leaderboard = Object.values(picks).map((pick: any) => {
      const darkSkill = getPlayerSkill(pick.darkHorse, overrides, weeklyPlayers);
      const underdogBonus = Math.round((1.0 + ((100 - Math.min(100, Math.max(10, darkSkill))) / 100) * 0.40) * 100) / 100;

      if (!isLiveOrDone) {
        // Tournament draft is open / has not started yet -> 0 points
        return {
          userId: pick.userId,
          userName: pick.userName,
          avatar: pick.avatar || "/default-avatar.png",
          faceitNickname: pick.faceitNickname,
          submittedAt: pick.submittedAt,
          status: "DRAFT_OPEN",
          sniper: {
            nickname: pick.sniper?.nickname,
            points: 0
          },
          support: {
            nickname: pick.support?.nickname,
            points: 0
          },
          darkHorse: {
            nickname: pick.darkHorse?.nickname,
            multiplier: underdogBonus,
            points: 0
          },
          totalPoints: 0
        };
      }

      // 1. Calculate Sniper Score during LIVE or COMPLETED tournament
      const snipSkill = getPlayerSkill(pick.sniper, overrides, weeklyPlayers);
      const snipBasePoints = Math.round((snipSkill * 1.45 + 35) * 10) / 10;

      // 2. Calculate Support Score
      const suppSkill = getPlayerSkill(pick.support, overrides, weeklyPlayers);
      const suppBasePoints = Math.round((suppSkill * 1.25 + 45) * 10) / 10;

      // 3. Calculate Dark Horse Score with Underdog Multiplier
      const darkRawPoints = darkSkill * 1.20 + 30;
      const darkFinalPoints = Math.round((darkRawPoints * underdogBonus) * 10) / 10;

      const totalPoints = Math.round((snipBasePoints + suppBasePoints + darkFinalPoints) * 10) / 10;

      return {
        userId: pick.userId,
        userName: pick.userName,
        avatar: pick.avatar || "/default-avatar.png",
        faceitNickname: pick.faceitNickname,
        submittedAt: pick.submittedAt,
        status: tour?.status,
        sniper: {
          nickname: pick.sniper?.nickname,
          points: snipBasePoints
        },
        support: {
          nickname: pick.support?.nickname,
          points: suppBasePoints
        },
        darkHorse: {
          nickname: pick.darkHorse?.nickname,
          multiplier: underdogBonus,
          points: darkFinalPoints
        },
        totalPoints
      };
    });

    // Sort by total points descending (or submittedAt if equal)
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints || (b.submittedAt || "").localeCompare(a.submittedAt || ""));

    return NextResponse.json({
      success: true,
      tourStatus: tour?.status || "DRAFT_OPEN",
      count: leaderboard.length,
      leaderboard
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ошибка загрузки таблицы фентези" }, { status: 500 });
  }
}
