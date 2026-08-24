import { NextRequest, NextResponse } from "next/server";
import { faceitFetch, getPlayerProfile } from "@/lib/faceit";
import { getStoragePath, getPersistentPath } from "@/lib/storage";
import { promises as fs } from "fs";
import fsSync from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    if (!hubId) {
      return NextResponse.json({ error: "Не указан ID хаба" }, { status: 400 });
    }

    const data = await faceitFetch(`/hubs/${hubId}/members`);
    const items = data?.items || [];

    // Read stored overrides
    let overrides: any = {};
    try {
      const ovPath = getPersistentPath("player_overrides.json");
      const fallbackOv = getStoragePath("player_overrides.json");
      const activePath = fsSync.existsSync(ovPath) ? ovPath : fallbackOv;
      if (fsSync.existsSync(activePath)) {
        overrides = JSON.parse(await fs.readFile(activePath, "utf8") || "{}");
      }
    } catch {}

    // Enrich members with real faceit ELO in parallel
    const enrichedItems = await Promise.all(
      items.map(async (member: any) => {
        const uid = member.user_id || member.player_id;
        const ov = overrides[uid] || overrides[member.nickname] || overrides[member.nickname?.toLowerCase()] || {};
        try {
          if (uid) {
            const prof = await getPlayerProfile(uid);
            const cs2 = prof?.games?.cs2 || prof?.games?.csgo || {};
            const realElo = cs2.faceit_elo;
            const skillLevel = cs2.skill_level;
            return {
              ...member,
              avatar: prof?.avatar || member.avatar,
              faceit_elo: realElo || ov.customElo || 1000,
              skill_level: skillLevel || 1,
              games: prof?.games || member.games
            };
          }
        } catch {
          // fallback to override or default
        }
        return {
          ...member,
          faceit_elo: ov.customElo || 1000,
          skill_level: 1
        };
      })
    );

    return NextResponse.json({
      ...data,
      items: enrichedItems
    });
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить список участников хаба" },
      { status: error.status || 500 }
    );
  }
}
