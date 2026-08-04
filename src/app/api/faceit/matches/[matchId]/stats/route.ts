import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import { promises as fs } from "fs";
import path from "path";

const customMatchesFilePath = path.join(process.cwd(), "src", "lib", "custom_matches.json");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    if (!matchId) {
      return NextResponse.json({ error: "Не указан ID матча" }, { status: 400 });
    }

    if (matchId.startsWith("cs_")) {
      try {
        const fileData = await fs.readFile(customMatchesFilePath, "utf8");
        const customMatches = JSON.parse(fileData || "[]");
        const found = customMatches.find((m: any) => m.match_id === matchId);
        if (found) {
          const rounds = [
            {
              match_id: matchId,
              round_stats: {
                Map: found.maps?.[0] || "de_mirage",
                Score: `${found.results?.score?.faction1 || 13}:${found.results?.score?.faction2 || 9}`
              },
              teams: [
                {
                  team_id: "faction1",
                  team_stats: { Team: found.teams?.faction1?.name || "Команда 1" },
                  players: (found.players1 || []).map((p: any) => ({
                    player_id: `cs_${p.nickname}`,
                    nickname: p.nickname,
                    player_stats: {
                      Kills: (p.kills || 0).toString(),
                      Deaths: (p.deaths || 0).toString(),
                      Assists: (p.assists || 0).toString(),
                      "K/D Ratio": (p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toString()),
                      "K/R Ratio": "0.75"
                    }
                  }))
                },
                {
                  team_id: "faction2",
                  team_stats: { Team: found.teams?.faction2?.name || "Команда 2" },
                  players: (found.players2 || []).map((p: any) => ({
                    player_id: `cs_${p.nickname}`,
                    nickname: p.nickname,
                    player_stats: {
                      Kills: (p.kills || 0).toString(),
                      Deaths: (p.deaths || 0).toString(),
                      Assists: (p.assists || 0).toString(),
                      "K/D Ratio": (p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toString()),
                      "K/R Ratio": "0.75"
                    }
                  }))
                }
              ]
            }
          ];
          return NextResponse.json({ rounds });
        }
      } catch (e) {
        console.error("Error reading custom match details:", e);
      }
    }

    const data = await faceitFetch(`/matches/${matchId}/stats`);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
      return NextResponse.json({ error: "API_KEY_MISSING" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Не удалось загрузить статистику матча" },
      { status: error.status || 500 }
    );
  }
}
