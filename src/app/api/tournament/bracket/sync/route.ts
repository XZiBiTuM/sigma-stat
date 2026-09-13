import { NextRequest, NextResponse } from "next/server";
import { faceitFetch } from "@/lib/faceit";
import * as fs from "fs";
import * as path from "path";
import { BracketState, BracketMatch, BracketTeam } from "@/app/api/tournament/bracket/route";

const BRACKET_FILE = path.join(process.cwd(), "src/lib/tournament_bracket.json");
const PERSISTENT_BRACKET = path.join(process.cwd(), "..", "sigma_persistent_tournament_bracket.json");

const TOURNAMENT_FILE = path.join(process.cwd(), "src/lib/fantasy_tournament.json");
const PERSISTENT_TOURNAMENT = path.join(process.cwd(), "..", "sigma_persistent_fantasy_tournament.json");

const HUB_ID = "d0701937-8eba-4df9-8830-22137001c0bd";

function readJsonFile<T>(primary: string, fallback: string): T | null {
  try {
    let target = primary;
    if (fs.existsSync(fallback)) target = fallback;
    if (fs.existsSync(target)) {
      const data = fs.readFileSync(target, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Error reading ${primary}:`, e);
  }
  return null;
}

function writeBracket(bracket: BracketState) {
  try {
    const dir = path.dirname(BRACKET_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BRACKET_FILE, JSON.stringify(bracket, null, 2), "utf8");
    try {
      fs.writeFileSync(PERSISTENT_BRACKET, JSON.stringify(bracket, null, 2), "utf8");
    } catch {}
  } catch (e) {
    console.error("Failed to write bracket state in sync:", e);
  }
}

export async function GET(request: NextRequest) {
  return handleSync();
}

export async function POST(request: NextRequest) {
  return handleSync();
}

async function handleSync() {
  try {
    // 1. Read bracket & tournament info
    const bracket = readJsonFile<BracketState>(BRACKET_FILE, PERSISTENT_BRACKET);
    if (!bracket || !Array.isArray(bracket.matches) || !Array.isArray(bracket.teams)) {
      return NextResponse.json({ success: false, message: "Bracket not initialized" });
    }

    const tourData = readJsonFile<any>(TOURNAMENT_FILE, PERSISTENT_TOURNAMENT);
    let minTimestampSec = 0;
    if (tourData?.startTime) {
      const parsed = new Date(tourData.startTime).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        minTimestampSec = Math.floor(parsed / 1000);
      }
    }

    // 2. Fetch recent hub matches from FACEIT
    const hubMatchesData = await faceitFetch(`/hubs/${HUB_ID}/matches`, { limit: 25, type: "all" });
    const faceitMatches: any[] = hubMatchesData?.items || [];
    if (faceitMatches.length === 0) {
      return NextResponse.json({ success: true, message: "No FACEIT hub matches found", updatedCount: 0 });
    }

    // Helper map of team id -> BracketTeam
    const teamsMap = new Map<string, BracketTeam>();
    bracket.teams.forEach(t => teamsMap.set(t.id, t));

    let updatedCount = 0;
    const logDetails: string[] = [];

    // 3. For each match in our bracket
    for (const match of bracket.matches) {
      const team1 = teamsMap.get(match.team1Id);
      const team2 = teamsMap.get(match.team2Id);
      if (!team1 || !team2) continue;

      const cap1 = (team1.captain || "").toLowerCase().trim();
      const cap2 = (team2.captain || "").toLowerCase().trim();
      const roster1 = (team1.players || []).map(p => p.toLowerCase().trim());
      const roster2 = (team2.players || []).map(p => p.toLowerCase().trim());

      // Helper to check if a Faceit faction roster belongs to team1 or team2
      const matchFaction = (fRoster: any[]): 1 | 2 | 0 => {
        const nicknames = fRoster.map(r => (r.nickname || "").toLowerCase().trim());
        const hasCap1 = nicknames.includes(cap1);
        const hasCap2 = nicknames.includes(cap2);

        if (hasCap1 && !hasCap2) return 1;
        if (hasCap2 && !hasCap1) return 2;

        // Fallback: check how many members of roster are in this faction
        const count1 = nicknames.filter(n => roster1.includes(n)).length;
        const count2 = nicknames.filter(n => roster2.includes(n)).length;

        if (count1 >= 2 && count1 > count2) return 1;
        if (count2 >= 2 && count2 > count1) return 2;

        return 0;
      };

      // Search matching FACEIT game among hub matches
      for (const fm of faceitMatches) {
        const fmStatus = (fm.status || "").toUpperCase();
        if (fmStatus === "CANCELLED" || fmStatus === "CANCEL" || fmStatus === "ABORTED") {
          continue;
        }

        // Must be played after tournament start time (if specified)
        const matchTimeSec = Number(fm.started_at || fm.created_at || 0);
        if (minTimestampSec > 0 && matchTimeSec > 0 && matchTimeSec < minTimestampSec) {
          continue;
        }

        const f1Roster: any[] = fm.teams?.faction1?.roster || [];
        const f2Roster: any[] = fm.teams?.faction2?.roster || [];

        const teamForF1 = matchFaction(f1Roster);
        const teamForF2 = matchFaction(f2Roster);

        // BOTH conditions must be satisfied simultaneously:
        // One faction corresponds to Team 1, and the other faction corresponds to Team 2
        const isMatched = (teamForF1 === 1 && teamForF2 === 2) || (teamForF1 === 2 && teamForF2 === 1);
        if (!isMatched) continue;

        // Match found on FACEIT!
        let changed = false;

        // Detect Status
        const isFaceitLive = ["ONGOING", "CONFIGURING", "READY", "RUNNING", "LIVE"].includes(fmStatus);
        const isFaceitFinished = ["FINISHED", "COMPLETED"].includes(fmStatus);

        if (isFaceitLive && match.status !== "LIVE") {
          match.status = "LIVE";
          match.faceitMatchId = fm.match_id;
          changed = true;
          logDetails.push(`Match ${match.id} (${team1.name} vs ${team2.name}) set to LIVE`);
        } else if (isFaceitFinished) {
          // Parse score
          let f1Score = 0;
          let f2Score = 0;

          if (fm.results?.score) {
            f1Score = Number(fm.results.score.faction1 ?? 0);
            f2Score = Number(fm.results.score.faction2 ?? 0);
          } else if (fm.results?.winner) {
            if (fm.results.winner === "faction1") f1Score = 1;
            else if (fm.results.winner === "faction2") f2Score = 1;
          }

          // Map factions to team1 and team2
          const scoreForT1 = (teamForF1 === 1) ? f1Score : f2Score;
          const scoreForT2 = (teamForF1 === 1) ? f2Score : f1Score;

          if (match.status !== "FINISHED" || match.score1 !== scoreForT1 || match.score2 !== scoreForT2 || !match.map1Score1) {
            match.status = "FINISHED";
            match.score1 = scoreForT1;
            match.score2 = scoreForT2;
            match.faceitMatchId = fm.match_id;

            // Fetch detailed map round stats from FACEIT for round handicap & total rounds settlement
            try {
              const statsData = await faceitFetch(`/matches/${fm.match_id}/stats`);
              if (statsData && Array.isArray(statsData.rounds) && statsData.rounds.length > 0) {
                const r1 = statsData.rounds[0];
                const r2 = statsData.rounds[1];
                if (r1) {
                  match.map1 = r1.round_stats?.Map || "de_mirage";
                  const scoreStr = r1.round_stats?.Score || "";
                  const parts = scoreStr.split("/").map((s: string) => parseInt(s.trim(), 10));
                  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    match.map1Score1 = teamForF1 === 1 ? parts[0] : parts[1];
                    match.map1Score2 = teamForF1 === 1 ? parts[1] : parts[0];
                  }
                }
                if (r2) {
                  match.map2 = r2.round_stats?.Map || "de_dust2";
                  const scoreStr = r2.round_stats?.Score || "";
                  const parts = scoreStr.split("/").map((s: string) => parseInt(s.trim(), 10));
                  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    match.map2Score1 = teamForF1 === 1 ? parts[0] : parts[1];
                    match.map2Score2 = teamForF1 === 1 ? parts[1] : parts[0];
                  }
                }
              }
            } catch (err) {
              console.warn("Failed to fetch match stats for map rounds:", err);
            }

            changed = true;
            logDetails.push(`Match ${match.id} (${team1.name} vs ${team2.name}) FINISHED: ${scoreForT1}:${scoreForT2} (M1: ${match.map1Score1 ?? '-'}:${match.map1Score2 ?? '-'}, M2: ${match.map2Score1 ?? '-'}:${match.map2Score2 ?? '-'})`);
          }
        }

        if (changed) {
          updatedCount++;
        }
        // Found matching game for this bracket match, stop inner loop
        break;
      }
    }

    if (updatedCount > 0) {
      bracket.updatedAt = Date.now();
      writeBracket(bracket);
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      logDetails,
      minTimestampSec,
      updatedAt: bracket.updatedAt
    });
  } catch (error: any) {
    console.error("Bracket sync error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
