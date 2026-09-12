"use client";

import React, { useState } from 'react';

export interface TeamLogo {
  shape: 'shield' | 'circle' | 'hexagon' | 'diamond' | 'badge';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  icon: string;
  pattern: 'stripes' | 'solid' | 'gradient' | 'glow';
}

export interface BracketTeam {
  id: string;
  name: string;
  captain: string;
  members: string[];
  logo: TeamLogo;
}

export interface BracketMatch {
  id: string;
  round: number; // 1, 2, 3
  team1Id: string;
  team2Id: string;
  score1: number | null;
  score2: number | null;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  map?: string;
  startTime?: string;
  winnerId?: string;
}

export interface BracketState {
  tournamentName: string;
  season: string;
  isCompleted: boolean;
  teams: BracketTeam[];
  matches: BracketMatch[];
  rules: {
    pointsWin: number;
    pointsDraw: number;
    pointsLoss: number;
  };
}

export const TeamBadgeLogo = ({ logo, name, size = 'md' }: { logo?: TeamLogo; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'xl' ? 'w-24 h-24 text-4xl' : 'w-11 h-11 text-base';
  const iconSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : size === 'xl' ? 'text-4xl' : 'text-lg';

  if (!logo) {
    return (
      <div className={`${sClass} rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/30 border border-amber-500/40 flex items-center justify-center font-black text-amber-300 shadow-md shadow-amber-500/10`}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  const shapeClass = 
    logo.shape === 'circle' ? 'rounded-full' :
    logo.shape === 'diamond' ? 'rounded-xl rotate-45 scale-90' :
    logo.shape === 'hexagon' ? 'rounded-2xl' :
    'rounded-xl';

  return (
    <div className="relative group flex items-center justify-center select-none">
      <div 
        className={`${sClass} ${shapeClass} flex items-center justify-center font-black relative overflow-hidden transition-transform duration-300 group-hover:scale-105`}
        style={{
          background: `linear-gradient(135deg, ${logo.primaryColor}dd, ${logo.secondaryColor}ee)`,
          borderColor: logo.accentColor,
          borderWidth: '2px',
          boxShadow: `0 0 16px ${logo.accentColor}55, inset 0 0 10px ${logo.accentColor}33`
        }}
      >
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none" 
          style={{
            backgroundImage: logo.pattern === 'stripes' ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)' : 'none'
          }}
        />
        <div className={`relative z-10 ${iconSize} drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${logo.shape === 'diamond' ? '-rotate-45' : ''}`}>
          {logo.icon}
        </div>
      </div>
    </div>
  );
};

export interface TeamStanding {
  team: BracketTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  roundsFor: number;
  roundsAgainst: number;
  roundDiff: number;
  points: number;
}

export function computeStandings(teams: BracketTeam[], matches: BracketMatch[], rules = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 }): TeamStanding[] {
  const standingsMap: Record<string, TeamStanding> = {};

  teams.forEach(t => {
    standingsMap[t.id] = {
      team: t,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      roundsFor: 0,
      roundsAgainst: 0,
      roundDiff: 0,
      points: 0
    };
  });

  matches.forEach(m => {
    if (m.status !== 'FINISHED' || m.score1 === null || m.score2 === null) return;
    const st1 = standingsMap[m.team1Id];
    const st2 = standingsMap[m.team2Id];
    if (!st1 || !st2) return;

    st1.played += 1;
    st2.played += 1;
    st1.roundsFor += m.score1;
    st1.roundsAgainst += m.score2;
    st2.roundsFor += m.score2;
    st2.roundsAgainst += m.score1;

    if (m.score1 > m.score2) {
      st1.won += 1;
      st1.points += rules.pointsWin;
      st2.lost += 1;
      st2.points += rules.pointsLoss;
    } else if (m.score2 > m.score1) {
      st2.won += 1;
      st2.points += rules.pointsWin;
      st1.lost += 1;
      st1.points += rules.pointsLoss;
    } else {
      st1.drawn += 1;
      st2.drawn += 1;
      st1.points += rules.pointsDraw;
      st2.points += rules.pointsDraw;
    }
  });

  const list = Object.values(standingsMap);
  list.forEach(item => {
    item.roundDiff = item.roundsFor - item.roundsAgainst;
  });

  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
    if (b.roundsFor !== a.roundsFor) return b.roundsFor - a.roundsFor;
    if (b.won !== a.won) return b.won - a.won;
    return a.team.name.localeCompare(b.team.name);
  });

  return list;
}

export function TournamentBracketView({ bracket }: { bracket: BracketState }) {
  const [selectedRound, setSelectedRound] = useState<number | 'ALL'>('ALL');
  const standings = computeStandings(bracket.teams, bracket.matches, bracket.rules);

  const teamMap = new Map<string, BracketTeam>();
  bracket.teams.forEach(t => teamMap.set(t.id, t));

  const filteredMatches = selectedRound === 'ALL' 
    ? bracket.matches 
    : bracket.matches.filter(m => m.round === selectedRound);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-600/10 to-blue-600/10 border border-white/10 p-6 sm:p-8 backdrop-blur-md">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Round-Robin • 4 Команды
              </span>
              <span className="text-xs text-white/50">Каждый играет с каждым</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              🏆 {bracket.tournamentName || 'SIGMA CS2 TOURNAMENT'}
            </h2>
            <p className="text-sm text-white/70 mt-1 max-w-xl">
              Всего 3 тура (6 матчей). Победитель определяется по максимальному количеству набранных очков (Победа = 3 очка, Ничья = 1 очко).
            </p>
          </div>

          {standings.length > 0 && standings[0].played > 0 && (
            <div className="bg-black/40 border border-amber-500/40 rounded-xl p-4 flex items-center gap-4 backdrop-blur-sm">
              <div className="text-3xl animate-bounce">👑</div>
              <div>
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Текущий лидер</div>
                <div className="text-base font-extrabold text-white flex items-center gap-2 mt-0.5">
                  <TeamBadgeLogo logo={standings[0].team.logo} name={standings[0].team.name} size="sm" />
                  <span>{standings[0].team.name}</span>
                </div>
                <div className="text-xs text-white/60 font-medium mt-0.5">
                  {standings[0].points} очков • {standings[0].won}W {standings[0].drawn}D {standings[0].lost}L (RD: {standings[0].roundDiff > 0 ? '+' : ''}{standings[0].roundDiff})
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Standings Table */}
      <div className="bg-black/30 border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-amber-400">📊</span> Турнирная таблица
          </h3>
          <span className="text-xs text-white/50">Сортировка: Очки &gt; Разница раундов &gt; Взятые раунды</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold text-white/50 uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4">Команда</th>
                <th className="py-3 px-3 text-center">И</th>
                <th className="py-3 px-3 text-center">В</th>
                <th className="py-3 px-3 text-center">Н</th>
                <th className="py-3 px-3 text-center">П</th>
                <th className="py-3 px-3 text-center">РД (Счёт)</th>
                <th className="py-3 px-4 text-center font-bold text-amber-400">Очки (PTS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {standings.map((st, idx) => {
                const isLeader = idx === 0 && st.played > 0;
                return (
                  <tr 
                    key={st.team.id} 
                    className={`transition-colors hover:bg-white/5 ${isLeader ? 'bg-amber-500/5' : ''}`}
                  >
                    <td className="py-3.5 px-3 text-center font-bold">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-black shadow-lg shadow-amber-500/30">
                          1
                        </span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-black text-xs font-black">
                          2
                        </span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white text-xs font-black">
                          3
                        </span>
                      ) : (
                        <span className="text-white/40 text-xs">{idx + 1}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <TeamBadgeLogo logo={st.team.logo} name={st.team.name} size="sm" />
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {st.team.name}
                            {isLeader && <span className="text-xs text-amber-400">👑</span>}
                          </div>
                          <div className="text-xs text-white/40">
                            Капитан: <span className="text-white/70">{st.team.captain || 'Не назначен'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center text-white/80 font-medium">{st.played}</td>
                    <td className="py-3.5 px-3 text-center text-emerald-400 font-bold">{st.won}</td>
                    <td className="py-3.5 px-3 text-center text-white/50 font-medium">{st.drawn}</td>
                    <td className="py-3.5 px-3 text-center text-red-400 font-bold">{st.lost}</td>
                    <td className="py-3.5 px-3 text-center font-mono text-xs">
                      <span className={st.roundDiff > 0 ? 'text-emerald-400' : st.roundDiff < 0 ? 'text-red-400' : 'text-white/50'}>
                        {st.roundDiff > 0 ? `+${st.roundDiff}` : st.roundDiff}
                      </span>
                      <span className="text-white/30 ml-1">({st.roundsFor}:{st.roundsAgainst})</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-black text-sm shadow-inner">
                        {st.points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matches Schedule & Results */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-amber-400">⚔️</span> Расписание и Результаты Матчей
            </h3>
            <p className="text-xs text-white/50 mt-0.5">3 раунда, по 2 матча в каждом</p>
          </div>

          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            {(['ALL', 1, 2, 3] as const).map(rnd => (
              <button
                key={rnd}
                onClick={() => setSelectedRound(rnd)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  selectedRound === rnd
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {rnd === 'ALL' ? 'Все матчи' : `Тур ${rnd}`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map(match => {
            const team1 = teamMap.get(match.team1Id);
            const team2 = teamMap.get(match.team2Id);
            const isFinished = match.status === 'FINISHED';
            const isLive = match.status === 'LIVE';

            const team1Won = isFinished && (match.score1 ?? 0) > (match.score2 ?? 0);
            const team2Won = isFinished && (match.score2 ?? 0) > (match.score1 ?? 0);

            return (
              <div 
                key={match.id}
                className={`relative rounded-2xl border p-5 backdrop-blur-md transition-all ${
                  isLive 
                    ? 'bg-red-500/10 border-red-500/50 shadow-lg shadow-red-500/10' 
                    : isFinished 
                    ? 'bg-black/30 border-white/10 hover:border-white/20' 
                    : 'bg-black/20 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-amber-400/80 uppercase tracking-wider">
                    Тур {match.round}
                  </span>
                  <div className="flex items-center gap-2">
                    {match.map && (
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 font-mono text-[11px]">
                        🗺️ {match.map}
                      </span>
                    )}
                    {isLive ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/40 animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> LIVE
                      </span>
                    ) : isFinished ? (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-semibold">
                        Завершён
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Ожидается
                      </span>
                    )}
                  </div>
                </div>

                {/* Team 1 Row */}
                <div className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  team1Won ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-white/5'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <TeamBadgeLogo logo={team1?.logo} name={team1?.name || 'T1'} size="md" />
                    <div className="min-w-0">
                      <div className={`font-bold truncate ${team1Won ? 'text-amber-300' : 'text-white'}`}>
                        {team1?.name || 'Команда 1'}
                      </div>
                      <div className="text-xs text-white/40 truncate">
                        Капитан: {team1?.captain || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xl font-black font-mono ml-4">
                    {isFinished || isLive ? (
                      <span className={team1Won ? 'text-amber-300' : 'text-white/80'}>
                        {match.score1 ?? 0}
                      </span>
                    ) : (
                      <span className="text-white/20">-</span>
                    )}
                  </div>
                </div>

                <div className="text-center my-1.5 text-xs text-white/20 font-black tracking-widest">
                  VS
                </div>

                {/* Team 2 Row */}
                <div className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  team2Won ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-white/5'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <TeamBadgeLogo logo={team2?.logo} name={team2?.name || 'T2'} size="md" />
                    <div className="min-w-0">
                      <div className={`font-bold truncate ${team2Won ? 'text-amber-300' : 'text-white'}`}>
                        {team2?.name || 'Команда 2'}
                      </div>
                      <div className="text-xs text-white/40 truncate">
                        Капитан: {team2?.captain || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xl font-black font-mono ml-4">
                    {isFinished || isLive ? (
                      <span className={team2Won ? 'text-amber-300' : 'text-white/80'}>
                        {match.score2 ?? 0}
                      </span>
                    ) : (
                      <span className="text-white/20">-</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Teams Roster with Logos Preview */}
      <div className="bg-black/30 border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-md">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <span className="text-amber-400">🛡️</span> Составы и Символика Команд
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {bracket.teams.map(team => (
            <div 
              key={team.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden group hover:border-amber-500/40 transition-all"
            >
              <div 
                className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none"
                style={{ backgroundColor: team.logo?.primaryColor || '#f59e0b' }}
              />
              <div className="mb-3">
                <TeamBadgeLogo logo={team.logo} name={team.name} size="lg" />
              </div>
              <h4 className="font-black text-white text-base tracking-tight mb-1">
                {team.name}
              </h4>
              <div className="text-xs font-semibold text-amber-400/90 mb-3">
                Капитан: {team.captain || 'Не назначен'}
              </div>

              <div className="w-full text-left bg-black/40 rounded-lg p-2.5 border border-white/5 text-xs space-y-1 mt-auto">
                <div className="text-[10px] uppercase font-bold text-white/40 mb-1">Состав:</div>
                {team.members && team.members.length > 0 ? (
                  team.members.map((m, idx) => (
                    <div key={idx} className="text-white/80 truncate flex items-center gap-1.5">
                      <span className="text-white/30 text-[10px]">#{idx + 1}</span>
                      <span className={m === team.captain ? 'font-bold text-amber-300' : ''}>{m}</span>
                      {m === team.captain && <span className="text-[10px] text-amber-400 font-bold">(C)</span>}
                    </div>
                  ))
                ) : (
                  <div className="text-white/30 italic">Игроки не выбраны</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
