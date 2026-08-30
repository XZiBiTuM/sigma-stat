import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const overridesFilePath = path.join(process.cwd(), "src", "lib", "player_overrides.json");
const persistentFilePath = path.join(process.cwd(), "..", "sigma_persistent_player_overrides.json");

async function readOverrides() {
  let fileData: any = {};
  try {
    const data = await fs.readFile(overridesFilePath, "utf8");
    fileData = JSON.parse(data || "{}");
  } catch {}

  let persistentData: any = {};
  try {
    const pData = await fs.readFile(persistentFilePath, "utf8");
    persistentData = JSON.parse(pData || "{}");
  } catch {}

  return { ...fileData, ...persistentData };
}

async function saveOverrides(overrides: any) {
  try {
    await fs.writeFile(overridesFilePath, JSON.stringify(overrides, null, 2), "utf8");
  } catch (e) {}
  try {
    await fs.writeFile(persistentFilePath, JSON.stringify(overrides, null, 2), "utf8");
  } catch (e) {}
}

export async function GET() {
  try {
    const data = await readOverrides();
    return NextResponse.json({ success: true, overrides: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch overrides" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      passcode, 
      batchOverrides, 
      playerId, 
      nickname, 
      csRating, 
      customElo, 
      customSkillScore,
      shooting,
      calls,
      mental,
      gamesense,
      aura
    } = body;

    if (passcode !== "demon323161" && passcode !== "sigmaadmin") {
      return NextResponse.json({ error: "Неверный пароль администратора" }, { status: 403 });
    }

    const current = await readOverrides();

    // Support batch update for all players at once!
    if (Array.isArray(batchOverrides)) {
      batchOverrides.forEach((item: any) => {
        const key = item.playerId || item.nickname;
        if (!key) return;
        const updatedObj = {
          ...(current[key] || {}),
          nickname: item.nickname || current[key]?.nickname || key,
          csRating: item.csRating !== undefined && item.csRating !== "" && item.csRating !== null ? Number(item.csRating) : current[key]?.csRating,
          customElo: item.customElo !== undefined && item.customElo !== "" && item.customElo !== null ? Number(item.customElo) : current[key]?.customElo,
          customSkillScore: item.customSkillScore !== undefined && item.customSkillScore !== "" && item.customSkillScore !== null ? Number(item.customSkillScore) : current[key]?.customSkillScore,
          shooting: item.shooting !== undefined && item.shooting !== "" && item.shooting !== null ? Number(item.shooting) : current[key]?.shooting,
          calls: item.calls !== undefined && item.calls !== "" && item.calls !== null ? Number(item.calls) : current[key]?.calls,
          mental: item.mental !== undefined && item.mental !== "" && item.mental !== null ? Number(item.mental) : current[key]?.mental,
          gamesense: item.gamesense !== undefined && item.gamesense !== "" && item.gamesense !== null ? Number(item.gamesense) : current[key]?.gamesense,
          aura: item.aura !== undefined && item.aura !== "" && item.aura !== null ? Number(item.aura) : current[key]?.aura,
          updatedAt: new Date().toISOString()
        };
        if (item.playerId) current[item.playerId] = updatedObj;
        if (item.nickname) {
          current[item.nickname] = updatedObj;
          current[item.nickname.toLowerCase()] = updatedObj;
        }
      });

      await saveOverrides(current);
      return NextResponse.json({ success: true, allOverrides: current });
    }

    if (!playerId && !nickname) {
      return NextResponse.json({ error: "Укажите ID или никнейм игрока" }, { status: 400 });
    }

    const key = playerId || nickname;
    const targetNick = (nickname || current[key]?.nickname || "").trim();
    const targetId = playerId || current[key]?.playerId || (key.includes("-") ? key : undefined);

    // Compute automatic customSkillScore as the average of 5 traits if customSkillScore is not explicitly sent
    let effSkill = customSkillScore !== undefined && customSkillScore !== "" ? Number(customSkillScore) : current[key]?.customSkillScore;
    const finalShooting = shooting !== undefined && shooting !== "" ? Number(shooting) : current[key]?.shooting;
    const finalCalls = calls !== undefined && calls !== "" ? Number(calls) : current[key]?.calls;
    const finalMental = mental !== undefined && mental !== "" ? Number(mental) : current[key]?.mental;
    const finalGamesense = gamesense !== undefined && gamesense !== "" ? Number(gamesense) : current[key]?.gamesense;
    const finalAura = aura !== undefined && aura !== "" ? Number(aura) : current[key]?.aura;

    if (finalShooting && finalCalls && finalMental && finalGamesense && finalAura) {
      effSkill = Math.round((finalShooting + finalCalls + finalMental + finalGamesense + finalAura) / 5);
    }

    const updatedObj = {
      ...(current[key] || {}),
      nickname: targetNick || key,
      ...(targetId ? { playerId: targetId } : {}),
      csRating: csRating !== undefined && csRating !== "" ? Number(csRating) : current[key]?.csRating,
      customElo: customElo !== undefined && customElo !== "" ? Number(customElo) : current[key]?.customElo,
      customSkillScore: effSkill,
      shooting: finalShooting,
      calls: finalCalls,
      mental: finalMental,
      gamesense: finalGamesense,
      aura: finalAura,
      updatedAt: new Date().toISOString()
    };

    // Update all existing entries that reference this player
    Object.keys(current).forEach((k) => {
      const entry = current[k];
      const matchNick = targetNick && (k.toLowerCase() === targetNick.toLowerCase() || entry?.nickname?.toLowerCase() === targetNick.toLowerCase());
      const matchId = targetId && (k === targetId || entry?.playerId === targetId);
      if (matchNick || matchId) {
        current[k] = { ...entry, ...updatedObj };
      }
    });

    if (targetId) current[targetId] = updatedObj;
    if (targetNick) {
      current[targetNick] = updatedObj;
      current[targetNick.toLowerCase()] = updatedObj;
    }

    await saveOverrides(current);

    return NextResponse.json({ success: true, override: updatedObj, allOverrides: current });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка при сохранении данных игрока" }, { status: 500 });
  }
}
