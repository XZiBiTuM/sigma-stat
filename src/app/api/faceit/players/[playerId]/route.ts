import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/faceit";
import { getStoragePath } from "@/lib/storage";
import { computeAdaptiveSkillScore } from "@/lib/skill";
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

    const realFaceitElo = data.games?.cs2?.faceit_elo || data.games?.csgo?.faceit_elo;
    const elo = realFaceitElo || override.customElo || 1000;
    const faceitMatches = data.games?.cs2?.matches || data.lifetime?.Matches || 500;

    const skillObj = computeAdaptiveSkillScore({
      playerId,
      nickname: data.nickname,
      elo,
      faceitMatches,
      premierRating: override.csRating,
      overrides: override
    });

    return NextResponse.json({
      ...data,
      csRating: skillObj.csRating,
      skillScore: skillObj.score,
      skillTier: skillObj.tier,
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
