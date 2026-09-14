import path from 'path';
import fs from 'fs';
import { getStoragePath, getPersistentPath } from '@/lib/storage';

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
  if (score >= 80) return { tier: 'fire', tierLabel: 'Пиковая' };
  if (score >= 65) return { tier: 'great', tierLabel: 'Хорошая' };
  if (score >= 50) return { tier: 'stable', tierLabel: 'Норма' };
  if (score >= 35) return { tier: 'slump', tierLabel: 'Спад' };
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
  const expectedKd = 0.40 + (Math.max(1, Math.min(100, playerSkill)) / 100) * 1.00;
  const performanceRatio = expectedKd > 0 ? kd / expectedKd : 1.0;

  // Ratio 1.0 = baseline (50 score)
  // Winrate 100% = +12 points, 0% = -12 points
  let score = 50 + (performanceRatio - 1.0) * 55 + ((winrate - 50) / 50) * 12;

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

export function getHubPlayersFormMap(hubId: string, tournamentsData?: any[]): Record<string, PlayerFormStats> {
  const formMap: Record<string, PlayerFormStats> = {};
  try {
    const skillSnapshotPath = fs.existsSync(getPersistentPath('weekly_skill_snapshots.json'))
      ? getPersistentPath('weekly_skill_snapshots.json')
      : getStoragePath('weekly_skill_snapshots.json');
    let skillMap: Record<string, number> = {};
    try {
      if (fs.existsSync(skillSnapshotPath)) {
        const snap = JSON.parse(fs.readFileSync(skillSnapshotPath, 'utf8'));
        if (snap?.players) {
          for (const [key, p] of Object.entries(snap.players as Record<string, any>)) {
            if (p?.currentScore) {
              skillMap[key.toLowerCase()] = p.currentScore;
              if (p.nickname) skillMap[p.nickname.toLowerCase()] = p.currentScore;
            }
          }
        }
      }
    } catch {}

    const overridesPath = fs.existsSync(getPersistentPath('player_overrides.json'))
      ? getPersistentPath('player_overrides.json')
      : getStoragePath('player_overrides.json');
    try {
      if (fs.existsSync(overridesPath)) {
        const ovs = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
        for (const [key, ov] of Object.entries(ovs as Record<string, any>)) {
          if (ov?.customSkillScore) {
            skillMap[key.toLowerCase()] = ov.customSkillScore;
          }
        }
      }
    } catch {}

    // If tournamentsData is provided directly, extract form from tournaments in order (newest first)
    if (Array.isArray(tournamentsData) && tournamentsData.length > 0) {
      for (const t of tournamentsData) {
        for (const p of t.players || []) {
          const pid = (p.playerId || '').toLowerCase();
          const nick = (p.nickname || '').toLowerCase();
          if ((pid && formMap[pid]) || (nick && formMap[nick])) {
            continue; // Player already has their latest tournament recorded
          }
          const skill = (pid && skillMap[pid]) || (nick && skillMap[nick]) || 50;
          const formData = calculatePlayerForm(
            skill,
            {
              matchesPlayed: p.played || 1,
              kills: p.kills || 0,
              deaths: p.deaths || 0,
              wins: p.wins || 0,
            },
            {
              id: t.id,
              name: t.name,
              date: t.startDate || '',
            }
          );
          if (pid) formMap[pid] = formData;
          if (nick) formMap[nick] = formData;
        }
      }
      return formMap;
    }

    // Fallback to match_stats_cache.json
    const cachePath = getStoragePath('match_stats_cache.json');
    if (!fs.existsSync(cachePath)) return formMap;

    const raw = fs.readFileSync(cachePath, 'utf8');
    const cache = JSON.parse(raw);
    const matchesList: any[] = [];
    for (const [mId, mData] of Object.entries(cache as Record<string, any>)) {
      if (!mData || !Array.isArray(mData.rounds) || mData.rounds.length === 0) continue;
      // Extract timestamp
      let mTime = mData.finished_at || mData.started_at || 0;
      if (!mTime) {
        for (const r of mData.rounds) {
          for (const team of r.teams || []) {
            for (const pl of team.players || []) {
              if (pl.player_stats?.created_at) {
                mTime = Math.max(mTime, new Date(pl.player_stats.created_at).getTime());
              }
            }
          }
        }
      }
      matchesList.push({
        id: mId,
        time: mTime || 0,
        rounds: mData.rounds
      });
    }

    matchesList.sort((a, b) => a.time - b.time);

    // Group into tournaments
    interface TournamentGroup {
      id: string;
      name: string;
      time: number;
      matches: any[];
    }
    const tGroups: TournamentGroup[] = [];
    let curG: TournamentGroup | null = null;
    let tIdx = 1;

    for (const m of matchesList) {
      if (!curG) {
        curG = {
          id: 'tournament-' + tIdx,
          name: 'Турнир #' + tIdx,
          time: m.time,
          matches: [m]
        };
      } else {
        const diffHours = (m.time - curG.time) / (1000 * 60 * 60);
        if (diffHours <= 36 && curG.matches.length < 6) {
          curG.matches.push(m);
        } else {
          tGroups.push(curG);
          tIdx++;
          curG = {
            id: 'tournament-' + tIdx,
            name: 'Турнир #' + tIdx,
            time: m.time,
            matches: [m]
          };
        }
      }
    }
    if (curG) tGroups.push(curG);

    // Track players per tournament chronologically (latest tournament overwrites previous)
    for (const t of tGroups) {
      const pTotals: Record<string, { matchesPlayed: number; kills: number; deaths: number; wins: number; nickname?: string }> = {};

      for (const m of t.matches) {
        const seenInMatch = new Set<string>();
        for (const r of m.rounds) {
          const rWinner = r.round_stats?.Winner;
          for (const team of r.teams || []) {
            const isTeamWin = (Boolean(rWinner) && team.team_id === rWinner) ||
                              team.team_stats?.TeamWin === '1' ||
                              team.team_stats?.['Team Win'] === '1';

            for (const pl of team.players || []) {
              const pid = (pl.player_id || '').toLowerCase();
              const nick = (pl.nickname || '').toLowerCase();
              const key = pid || nick;
              if (!key) continue;

              if (!pTotals[key]) {
                pTotals[key] = { matchesPlayed: 0, kills: 0, deaths: 0, wins: 0, nickname: pl.nickname };
              }
              if (!seenInMatch.has(key)) {
                seenInMatch.add(key);
                pTotals[key].matchesPlayed += 1;
              }
              const isWin = isTeamWin || pl.player_stats?.Result === '1';
              if (isWin) pTotals[key].wins += 1;
              pTotals[key].kills += parseInt(pl.player_stats?.Kills || '0', 10);
              pTotals[key].deaths += parseInt(pl.player_stats?.Deaths || '0', 10);
            }
          }
        }
      }

      const dateStr = t.time > 0 ? new Date(t.time).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';

      for (const [key, stats] of Object.entries(pTotals)) {
        const skill = (key && skillMap[key]) || (stats.nickname && skillMap[stats.nickname.toLowerCase()]) || 50;
        const formData = calculatePlayerForm(
          skill,
          stats,
          {
            id: t.id,
            name: t.name,
            date: dateStr
          }
        );
        formMap[key] = formData;
        if (stats.nickname) {
          formMap[stats.nickname.toLowerCase()] = formData;
        }
      }
    }
  } catch (err) {
    console.error('Error computing hub players form map:', err);
  }

  return formMap;
}
