import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const PICKS_LOCAL = path.join(process.cwd(), "src", "lib", "fantasy_picks.json");
const PICKS_PERSISTENT = path.join(process.cwd(), "..", "sigma_persistent_fantasy_picks.json");

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

export async function GET() {
  try {
    const picks = await readJsonFile(PICKS_LOCAL, PICKS_PERSISTENT);
    const overrides = await readJsonFile(OVERRIDES_LOCAL, OVERRIDES_PERSISTENT);

    const leaderboard = Object.values(picks).map((pick: any) => {
      // 1. Calculate Sniper Score
      const snipOv = overrides[pick.sniper?.playerId] || overrides[pick.sniper?.nickname] || {};
      const snipSkill = pick.sniper?.skillScore || snipOv.customSkillScore || 50;
      // Simulated/proportional performance based on skill rating and activity
      const snipBasePoints = Math.round((snipSkill * 1.45 + 35) * 10) / 10;

      // 2. Calculate Support Score
      const suppOv = overrides[pick.support?.playerId] || overrides[pick.support?.nickname] || {};
      const suppSkill = pick.support?.skillScore || suppOv.customSkillScore || 50;
      const suppBasePoints = Math.round((suppSkill * 1.25 + 45) * 10) / 10;

      // 3. Calculate Dark Horse Score with Underdog Multiplier!
      const darkOv = overrides[pick.darkHorse?.playerId] || overrides[pick.darkHorse?.nickname] || {};
      const darkSkill = pick.darkHorse?.skillScore || darkOv.customSkillScore || 40;
      const underdogBonus = pick.darkHorse?.underdogBonus || Math.round((1.0 + ((100 - darkSkill) / 100) * 0.40) * 100) / 100;
      const darkRawPoints = darkSkill * 1.20 + 30;
      const darkFinalPoints = Math.round((darkRawPoints * underdogBonus) * 10) / 10;

      const totalPoints = Math.round((snipBasePoints + suppBasePoints + darkFinalPoints) * 10) / 10;

      return {
        userId: pick.userId,
        userName: pick.userName,
        avatar: pick.avatar || "/default-avatar.png",
        faceitNickname: pick.faceitNickname,
        submittedAt: pick.submittedAt,
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

    // Sort by total points descending
    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({
      success: true,
      count: leaderboard.length,
      leaderboard
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Ошибка загрузки таблицы фентези" }, { status: 500 });
  }
}
