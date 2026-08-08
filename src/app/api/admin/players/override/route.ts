import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const overridesFilePath = path.join(process.cwd(), "src", "lib", "player_overrides.json");

async function readOverrides() {
  try {
    const data = await fs.readFile(overridesFilePath, "utf8");
    return JSON.parse(data || "{}");
  } catch {
    return {};
  }
}

async function saveOverrides(overrides: any) {
  await fs.writeFile(overridesFilePath, JSON.stringify(overrides, null, 2), "utf8");
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
    const { passcode, playerId, nickname, csRating, customElo, customSkillScore } = body;

    if (passcode !== "demon323161" && passcode !== "sigmaadmin") {
      return NextResponse.json({ error: "Неверный пароль администратора" }, { status: 403 });
    }

    if (!playerId && !nickname) {
      return NextResponse.json({ error: "Укажите ID или никнейм игрока" }, { status: 400 });
    }

    const key = playerId || nickname;
    const current = await readOverrides();

    current[key] = {
      ...(current[key] || {}),
      nickname: nickname || current[key]?.nickname || key,
      csRating: csRating !== undefined && csRating !== "" ? Number(csRating) : current[key]?.csRating,
      customElo: customElo !== undefined && customElo !== "" ? Number(customElo) : current[key]?.customElo,
      customSkillScore: customSkillScore !== undefined && customSkillScore !== "" ? Number(customSkillScore) : current[key]?.customSkillScore,
      updatedAt: new Date().toISOString()
    };

    // Also alias by nickname if key is UUID
    if (nickname && nickname !== key) {
      current[nickname] = current[key];
    }

    await saveOverrides(current);

    return NextResponse.json({ success: true, override: current[key], allOverrides: current });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка при сохранении данных игрока" }, { status: 500 });
  }
}
