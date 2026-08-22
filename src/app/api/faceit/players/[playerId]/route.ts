import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/faceit";
import { getStoragePath } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";

const overridesFilePath = getStoragePath("player_overrides.json");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ error: "Не указан ID игрока" }, { status: 400 });
    }

    const data = await getPlayerProfile(playerId);

    // Read stored overrides
    let overrides: any = {};
    try {
      const fileContent = await fs.readFile(overridesFilePath, "utf8");
      overrides = JSON.parse(fileContent || "{}");
    } catch {}

    const playerKey = playerId;
    const nicknameKey = data.nickname;
    const override = overrides[playerKey] || overrides[nicknameKey] || {};

    const elo = override.customElo || data.games?.cs2?.faceit_elo || data.games?.csgo?.faceit_elo || 1000;
    const csRating = override.csRating || Math.round(elo * 9.5);

    let skillScore = override.customSkillScore;
    if (skillScore === undefined || skillScore === null) {
      const sElo = Math.min(100, Math.max(10, (elo - 300) / 22));
      const sPremier = Math.min(100, Math.max(10, csRating / 260));
      // Base calculation
      skillScore = Math.round((0.45 * sElo) + (0.55 * sPremier));
    }

    let skillTier = "C Tier";
    if (skillScore >= 90) skillTier = "S+ Tier";
    else if (skillScore >= 80) skillTier = "S Tier";
    else if (skillScore >= 70) skillTier = "A+ Tier";
    else if (skillScore >= 60) skillTier = "A Tier";
    else if (skillScore >= 50) skillTier = "B Tier";
    else if (skillScore >= 40) skillTier = "C Tier";
    else skillTier = "D Tier";

    return NextResponse.json({
      ...data,
      csRating,
      skillScore,
      skillTier,
      override
    });
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить профиль игрока" },
      { status: error.status || 500 }
    );
  }
}
