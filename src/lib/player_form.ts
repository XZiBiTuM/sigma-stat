import { getPlayerSkill } from './player_scores';
import path from 'path';
import fs from 'fs';

export interface PlayerFormStats {
  score: number; // 0 - 100
  tier: 'fire' | 'great' | 'stable' | 'slump' | 'crisis';
  tierLabel: string;
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  matchesPlayed: number;
  kills: number;
  deaths: number;
  kd: number;
  expectedKd: number;
  performanceRatio: number;
  winrate: number;
}

export function getFormTier(score: number): { tier: PlayerFormStats['tier']; tierLabel: string } {
  if (score >= 80) return { tier: 'fire', tierLabel: 'Огненная' };
  if (score >= 65) return { tier: 'great', tierLabel: 'Отличная' };
  if (score >= 50) return { tier: 'stable', tierLabel: 'Стабильная' };
  if (score >= 35) return { tier: 'slump', tierLabel: 'На спаде' };
  return { tier: 'crisis', tierLabel: 'Кризис' };
}

export function calculatePlayerForm(
  playerSkill: number,
  tournamentStats: {
    matchesPlayed: number;
    kills: number;
    deaths: number;
    wins: number;
  },
  tournamentMeta: {
    id: string;
    name: string;
    date: string;
  }
): PlayerFormStats {
  const { matchesPlayed, kills, deaths, wins } = tournamentStats;
  const kd = deaths > 0 ? kills / deaths : kills;
  const winrate = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;

  // Expected K/D based on player's overall skill score (0-100)
  // Skill 10 -> ~0.50 expected KD
  // Skill 50 -> ~0.90 expected KD
  // Skill 90 -> ~1.30 expected KD
  const expectedKd = 0.40 + (Math.max(1, Math.min(100, playerSkill)) / 100) * 1.00;
  const performanceRatio = expectedKd > 0 ? kd / expectedKd : 1.0;

  // Ratio 1.0 = baseline (50 score)
  // Ratio 1.4 = +22 points (~72)
  // Winrate 100% = +12 points, 0% = -12 points
  let score = 50 + (performanceRatio - 1.0) * 55 + ((winrate - 50) / 50) * 12;

  // Clamp 1 - 100
  const finalScore = Math.max(1, Math.min(100, Math.round(score)));
  const { tier, tierLabel } = getFormTier(finalScore);

  return {
    score: finalScore,
    tier,
    tierLabel,
    tournamentId: tournamentMeta.id,
    tournamentName: tournamentMeta.name,
    tournamentDate: tournamentMeta.date,
    matchesPlayed,
    kills,
    deaths,
    kd: Number(kd.toFixed(2)),
    expectedKd: Number(expectedKd.toFixed(2)),
    performanceRatio: Number(performanceRatio.toFixed(2)),
    winrate: Number(winrate.toFixed(1)),
  };
}

// Helper to read cached match stats and calculate form map for all players in hub
export function getHubPlayersFormMap(hubId: string): Record<string, PlayerFormStats> {
  const formMap: Record<string, PlayerFormStats> = {};
  try {
    const cachePath = path.join(process.cwd(), 'match_stats_cache.json');
    if (!fs.existsSync(cachePath)) return formMap;

    const raw = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(raw);
    const matches = Object.values(cache) as any[];

    // Filter finished hub matches
    const hubMatches = matches.filter((m: any) => {
      const isHub = m.competition_id === hubId || m.hub_id === hubId || m.entity_id === hubId;
      return isHub && m.status === 'FINISHED' && m.started_at && Array.isArray(m.player_stats);
    });

    hubMatches.sort((a, b) => (a.started_at || 0) - (b.started_at || 0));

    // Group matches into tournaments (matching logic from tournaments route)
    interface TournamentGroup {
      id: string;
      name: string;
      started_at: number;
      matches: any[];
    }

    const tournaments: TournamentGroup[] = [];
    let currentT: TournamentGroup | null = null;
    let tIndex = 1;

    for (const match of hubMatches) {
      const matchTime = match.started_at;
      if (!currentT) {
        currentT = {
          id: `tournament-${tIndex}`,
          name: `Турнир #${tIndex}`,
          started_at: matchTime,
          matches: [match],
        };
      } else {
        const firstMatchTime = currentT.started_at;
        const timeDiffHours = (matchTime - firstMatchTime) / (1000 * 60 * 60);
        if (timeDiffHours <= 36 && currentT.matches.length < 6) {
          currentT.matches.push(match);
        } else {
          tournaments.push(currentT);
          tIndex++;
          currentT = {
            id: `tournament-${tIndex}`,
            name: `Турнир #${tIndex}`,
            started_at: matchTime,
            matches: [match],
          };
        }
      }
    }
    if (currentT) tournaments.push(currentT);

    // Track players per tournament
    // Tournaments are chronological, so later tournaments overwrite earlier ones
    for (const t of tournaments) {
      const playerTotals: Record<string, { matchesPlayed: number; kills: number; deaths: number; wins: number }> = {};

      for (const m of t.matches) {
        if (!m.player_stats) continue;
        for (const ps of m.player_stats) {
          const pId = ps.player_id;
          if (!pId) continue;
          if (!playerTotals[pId]) {
            playerTotals[pId] = { matchesPlayed: 0, kills: 0, deaths: 0, wins: 0 };
          }
          playerTotals[pId].matchesPlayed += 1;
          playerTotals[pId].kills += Number(ps.kills || 0);
          playerTotals[pId].deaths += Number(ps.deaths || 0);
          if (Number(ps.result) === 1 || ps.win === true || ps.won === true) {
            playerTotals[pId].wins += 1;
          }
        }
      }

      const dateStr = new Date(t.started_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
      });

      for (const [pId, stats] of Object.entries(playerTotals)) {
        const skill = getPlayerSkill(pId);
        formMap[pId] = calculatePlayerForm(
          skill,
          stats,
          {
            id: t.id,
            name: t.name,
            date: dateStr,
          }
        );
      }
    }
  } catch (err) {
    console.error('Error computing hub players form map:', err);
  }

  return formMap;
}
