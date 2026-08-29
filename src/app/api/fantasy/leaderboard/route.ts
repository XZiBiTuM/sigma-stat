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

    const isLiveOrDone = tour?.status === "LIVE" || tour?.status === "COMPLETED" || tour?.status === "DRAFT_WAITING";

    // 1. If tournament is COMPLETED or DRAFT_WAITING and has a frozen snapshot, return it directly!
    if ((tour?.status === "COMPLETED" || tour?.status === "DRAFT_WAITING") && Array.isArray(tour?.completedLeaderboard) && tour.completedLeaderboard.length > 0) {
      return NextResponse.json({
        success: true,
        tourStatus: tour?.status,
        count: tour.completedLeaderboard.length,
        leaderboard: tour.completedLeaderboard
      });
    }

    const leaderboard = Object.values(picks).map((pick: any) => {
      const darkSkill = getPlayerSkill(pick.darkHorse, overrides, weeklyPlayers);
      
      // Dynamic Underdog Multiplier with Overpower Penalty (>65)
      let underdogBonus = 1.0;
      if (darkSkill <= 65) {
        underdogBonus = Math.round((1.0 + ((65 - Math.max(15, darkSkill)) / 50) * 0.40) * 100) / 100;
      } else {
        underdogBonus = Math.round(Math.max(0.60, 1.0 - ((darkSkill - 65) / 30) * 0.40) * 100) / 100;
      }

      const snipSkill = getPlayerSkill(pick.sniper, overrides, weeklyPlayers);
      const suppSkill = getPlayerSkill(pick.support, overrides, weeklyPlayers);

      // Card buffs
      const snipBuff = pick.sniper?.buff || null;
      const suppBuff = pick.support?.buff || null;
      const darkBuff = pick.darkHorse?.buff || null;

      const snipBuffMult = 1 + ((snipBuff?.percent || 0) / 100);
      const suppBuffMult = 1 + ((suppBuff?.percent || 0) / 100);
      const darkBuffMult = 1 + ((darkBuff?.percent || 0) / 100);

      const isSuppLucky = suppBuff?.id === "lucky_loser";
      const isDarkLucky = darkBuff?.id === "lucky_loser";

      const effectiveUnderdogBonus = isDarkLucky && underdogBonus < 1.0 ? 1.0 : underdogBonus;
      const suppPenalty = suppSkill > 65 && !isSuppLucky ? 0.50 : 1.0;

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
            skill: snipSkill,
            buff: snipBuff,
            points: 0
          },
          support: {
            nickname: pick.support?.nickname,
            skill: suppSkill,
            penaltyApplied: suppSkill > 65 && !isSuppLucky,
            buff: suppBuff,
            points: 0
          },
          darkHorse: {
            nickname: pick.darkHorse?.nickname,
            skill: darkSkill,
            multiplier: effectiveUnderdogBonus,
            buff: darkBuff,
            points: 0
          },
          totalPoints: 0
        };
      }

      // 1. Calculate base points for each slot
      let snipPoints = (snipSkill * 1.45 + 35) * snipBuffMult;
      let suppPoints = (suppSkill * 1.25 + 45) * suppPenalty * suppBuffMult;
      let darkPoints = (darkSkill * 1.20 + 30) * effectiveUnderdogBonus * darkBuffMult;

      // 2. Vampire Siphon Mechanics
      // If Star is vampire: drain 15% from Support, gain 15% * 1.2 (= 18%) of Support
      if (snipBuff?.id === "vampire") {
        const drain = suppPoints * 0.15;
        suppPoints -= drain;
        snipPoints += drain * 1.2;
      }
      // If Support is vampire: drain 10% from Star and 10% from Dark Horse, gain 10% * 1.2 (= 12%) from each
      if (suppBuff?.id === "vampire") {
        const drainSnip = snipPoints * 0.10;
        const drainDark = darkPoints * 0.10;
        snipPoints -= drainSnip;
        darkPoints -= drainDark;
        suppPoints += (drainSnip + drainDark) * 1.2;
      }
      // If Dark Horse is vampire: drain 15% from Support, gain 15% * 1.2 (= 18%) of Support
      if (darkBuff?.id === "vampire") {
        const drain = suppPoints * 0.15;
        suppPoints -= drain;
        darkPoints += drain * 1.2;
      }

      const snipFinal = Math.round(snipPoints * 10) / 10;
      const suppFinal = Math.round(suppPoints * 10) / 10;
      const darkFinal = Math.round(darkPoints * 10) / 10;
      const totalPoints = Math.round((snipFinal + suppFinal + darkFinal) * 10) / 10;

      return {
        userId: pick.userId,
        userName: pick.userName,
        avatar: pick.avatar || "/default-avatar.png",
        faceitNickname: pick.faceitNickname,
        submittedAt: pick.submittedAt,
        status: tour?.status,
        sniper: {
          nickname: pick.sniper?.nickname,
          skill: snipSkill,
          buff: snipBuff,
          points: snipFinal
        },
        support: {
          nickname: pick.support?.nickname,
          skill: suppSkill,
          penaltyApplied: suppSkill > 55 && !isSuppLucky,
          buff: suppBuff,
          points: suppFinal
        },
        darkHorse: {
          nickname: pick.darkHorse?.nickname,
          skill: darkSkill,
          multiplier: effectiveUnderdogBonus,
          buff: darkBuff,
          points: darkFinal
        },
        totalPoints
      };
    });

    // Sort by total points descending (or submittedAt if equal)
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints || (b.submittedAt || "").localeCompare(a.submittedAt || ""));

    // Auto-freeze completed tournament snapshot if not frozen yet
    if (tour?.status === "COMPLETED" && (!tour?.completedLeaderboard || tour.completedLeaderboard.length === 0)) {
      try {
        const updatedTour = {
          ...tour,
          completedLeaderboard: leaderboard,
          updatedAt: new Date().toISOString()
        };
        const str = JSON.stringify(updatedTour, null, 2);
        await fs.writeFile(TOUR_LOCAL, str, "utf8").catch(() => {});
        await fs.writeFile(TOUR_PERSISTENT, str, "utf8").catch(() => {});
      } catch (e) {}
    }

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
