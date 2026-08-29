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
    const { passcode, batchOverrides, playerId, nickname, csRating, customElo, customSkillScore } = body;

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

    const updatedObj = {
      ...(current[key] || {}),
      nickname: nickname || current[key]?.nickname || key,
      csRating: csRating !== undefined && csRating !== "" ? Number(csRating) : current[key]?.csRating,
      customElo: customElo !== undefined && customElo !== "" ? Number(customElo) : current[key]?.customElo,
      customSkillScore: customSkillScore !== undefined && customSkillScore !== "" ? Number(customSkillScore) : current[key]?.customSkillScore,
      updatedAt: new Date().toISOString()
    };

    if (playerId) current[playerId] = updatedObj;
    if (nickname) {
      current[nickname] = updatedObj;
      current[nickname.toLowerCase()] = updatedObj;
    }

    await saveOverrides(current);

    return NextResponse.json({ success: true, override: current[key], allOverrides: current });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка при сохранении данных игрока" }, { status: 500 });
  }
}
