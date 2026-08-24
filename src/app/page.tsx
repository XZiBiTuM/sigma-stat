"use client";

import React, { useState, useEffect, useTransition, Component, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { computeAdaptiveSkillScore } from "@/lib/skill";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--danger)" }}>
          <h3>Ошибка отрисовки компонента</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem", fontSize: "0.9rem" }}>
            {this.state.error?.toString()}
          </p>
          <button 
            className="btn btn-secondary" 
            style={{ marginTop: "1rem", fontSize: "0.85rem" }} 
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MAP_CONFIGS: Record<string, { pos_x: number; pos_y: number; scale: number }> = {
  de_mirage: { pos_x: -3230, pos_y: 1713, scale: 5 },
  de_inferno: { pos_x: -2087, pos_y: 3870, scale: 4.9 },
  de_nuke: { pos_x: -3453, pos_y: 2887, scale: 7 },
  de_dust2: { pos_x: -2476, pos_y: 3239, scale: 4.4 },
  de_ancient: { pos_x: -2953, pos_y: 2164, scale: 5 },
  de_anubis: { pos_x: -2796, pos_y: 3328, scale: 5.22 },
  de_vertigo: { pos_x: -3168, pos_y: 1762, scale: 4 },
  de_overpass: { pos_x: -4831, pos_y: 1781, scale: 5.2 }
};

// Types
interface HubDetails {
  hub_id: string;
  name: string;
  avatar: string;
  cover_image: string;
  description: string;
  game_id: string;
  players_number: number;
  join_permission?: string;
  organizer_id?: string;
}

interface LeaderboardItem {
  leaderboard_id: string;
  leaderboard_name: string;
  status: string;
}

interface RankingPlayer {
  player_id: string;
  nickname: string;
  avatar: string;
  country: string;
}

interface RankingItem {
  position: number;
  player: RankingPlayer;
  points: number;
  won: number;
  lost: number;
  played: number;
  current_streak: number;
}

interface MatchFaction {
  name: string;
  score?: number;
}

interface MatchItem {
  match_id: string;
  status: string;
  started_at: number;
  finished_at: number;
  maps?: string[];
  teams: {
    faction1: MatchFaction;
    faction2: MatchFaction;
  };
  voting?: {
    map?: {
      entities?: Array<{ name: string; image_url: string }>;
    };
  };
  results?: {
    winner: string;
    score?: {
      faction1?: number;
      faction2?: number;
    };
  };
}

interface PlayerStats {
  Kills: string;
  Deaths: string;
  Assists: string;
  "K/D Ratio": string;
  "Headshots %": string;
  MVPs: string;
  [key: string]: any;
}

interface MatchPlayer {
  player_id: string;
  nickname: string;
  player_stats: PlayerStats;
}

interface MatchTeam {
  team_id: string;
  team_stats: {
    Team: string;
    Score: string;
    [key: string]: any;
  };
  players: MatchPlayer[];
}

interface MatchRound {
  round_stats: {
    Map: string;
    Winner: string;
    [key: string]: any;
  };
  teams: MatchTeam[];
}

interface PlayerProfile {
  player_id: string;
  nickname: string;
  avatar: string;
  country: string;
  games: {
    [gameId: string]: {
      faceit_elo: number;
      skill_level: number;
    };
  };
  steam_id_64?: string;
  platforms?: {
    steam?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface PlayerGameStats {
  lifetime: {
    Matches: string;
    "Average K/D Ratio": string;
    "Win Rate %": string;
    "Average Headshots %": string;
    "Longest Win Streak": string;
    "Current Win Streak"?: string;
    [key: string]: any;
  };
  segments?: any[];
  [key: string]: any;
}

// Popular Hubs list for quick-select
const POPULAR_HUBS = [
  { id: "e1a5330e-5415-467b-b5d1-137a1c1d0fb9", name: "Mythic Bronze (CS2 NA)", desc: "Популярный хаб в Северной Америке" },
  { id: "f2c8ef67-1c66-4c47-9759-cc32483be835", name: "FPL Challenger Europe", desc: "Европейский дивизион FPL Challenger" },
  { id: "7482cf15-e2cc-4c12-9c1b-ecb0a0a55b38", name: "Пример хаба 1", desc: "Универсальный идентификатор" }
];

export default function Home() {
  const [hubIdInput, setHubIdInput] = useState("0dd077bc-b401-4f5c-8a40-47578601ccb7");
  const [hubId, setHubId] = useState<string | null>("0dd077bc-b401-4f5c-8a40-47578601ccb7");
  const [activeTab, setActiveTab] = useState<"leaderboard" | "matches" | "members" | "tournaments" | "compare" | "fantasy">("leaderboard");
  const [comparePlayer1Id, setComparePlayer1Id] = useState<string>("");
  const [comparePlayer2Id, setComparePlayer2Id] = useState<string>("");
  const [compareSearchQuery1, setCompareSearchQuery1] = useState("");
  const [compareSearchQuery2, setCompareSearchQuery2] = useState("");
  
  // Tournaments states
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(false);
  
  // Data States
  const [hubDetails, setHubDetails] = useState<HubDetails | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardItem[]>([]);
  const [selectedLeaderboardId, setSelectedLeaderboardId] = useState<string>("");
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  
  // Filtering & Search
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [filterMatchStatus, setFilterMatchStatus] = useState<"all" | "ongoing" | "past">("all");

  // Loading & Error States
  const [isPending, startTransition] = useTransition();
  const [isLoadingHub, setIsLoadingHub] = useState(true);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal: Match details
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchRound[] | null>(null);
  const [isLoadingMatchDetails, setIsLoadingMatchDetails] = useState(false);
  // Round history states keyed by mapIndex (0, 1, 2)
  const [roundHistories, setRoundHistories] = useState<Record<number, any>>({});
  const [loadingMapIndexes, setLoadingMapIndexes] = useState<Record<number, boolean>>({});
  const [manualDemoUrls, setManualDemoUrls] = useState<Record<number, string>>({});
  const [submittingDemoUrls, setSubmittingDemoUrls] = useState<Record<number, boolean>>({});
  const [selectedRadarRoundIndexes, setSelectedRadarRoundIndexes] = useState<Record<number, number | null>>({});
  const [showAllMatchDeathsMap, setShowAllMatchDeathsMap] = useState<Record<number, boolean>>({});
  const [hoveredKillIdx, setHoveredKillIdx] = useState<number | null>(null);
  const [selectedKillIdx, setSelectedKillIdx] = useState<number | null>(null);

  // Modal: Player details
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerGameStats, setPlayerGameStats] = useState<PlayerGameStats | null>(null);
  const [playerHubStats, setPlayerHubStats] = useState<any | null>(null);
  const [leetifyStats, setLeetifyStats] = useState<any | null>(null);
  const [playerSteamStats, setPlayerSteamStats] = useState<any | null>(null);
  const [playerModalTab, setPlayerModalTab] = useState<"general" | "tactical" | "maps">("general");
  const [playerActiveLeaderboardItem, setPlayerActiveLeaderboardItem] = useState<any | null>(null);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);

  // Onboarding Tour state
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Sorting & Min Matches filter state
  const [sortField, setSortField] = useState<"default" | "skill" | "points" | "matches" | "kd" | "avg" | "adr" | "hs" | "hltv" | "winrate">("default");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [minMatchesFilter, setMinMatchesFilter] = useState<number>(10);

  const handleSort = (field: "skill" | "points" | "matches" | "kd" | "avg" | "adr" | "hs" | "hltv" | "winrate") => {
    if (sortField === field) {
      if (sortOrder === "desc") {
        setSortOrder("asc");
      } else {
        setSortField("default");
        setSortOrder("desc");
      }
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // 4-Captain Draft System state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftStep, setDraftStep] = useState<"setup" | "picking" | "finished">("setup");
  const [draftCaptains, setDraftCaptains] = useState<[string, string, string, string]>(["Капитан 1", "Капитан 2", "Капитан 3", "Капитан 4"]);
  const [draftPoolInput, setDraftPoolInput] = useState("");
  const [draftAvailablePlayers, setDraftAvailablePlayers] = useState<string[]>([]);
  const [draftTeams, setDraftTeams] = useState<[string[], string[], string[], string[]]>([[], [], [], []]);
  const [draftTurnSequence, setDraftTurnSequence] = useState<number[]>([]);
  const [draftCurrentStepIndex, setDraftCurrentStepIndex] = useState(0);
  const [draftRoomAssignment, setDraftRoomAssignment] = useState<{ vip: number[]; main: number[] } | null>(null);
  const [isRollingRooms, setIsRollingRooms] = useState(false);
  const [draftErrorMsg, setDraftErrorMsg] = useState("");

  // Player Overrides & Skill Rating States
  const [playerOverridesMap, setPlayerOverridesMap] = useState<Record<string, any>>({});
  const [playerEloMap, setPlayerEloMap] = useState<Record<string, number>>({});
  const [weeklySkillMap, setWeeklySkillMap] = useState<Record<string, any>>({});
  const [showAdminPlayerEditModal, setShowAdminPlayerEditModal] = useState<boolean>(false);
  const [adminEditingPlayer, setAdminEditingPlayer] = useState<any>(null);
  const [adminCsRatingInput, setAdminCsRatingInput] = useState<string>("");
  const [adminCustomEloInput, setAdminCustomEloInput] = useState<string>("");
  const [adminCustomScoreInput, setAdminCustomScoreInput] = useState<string>("");
  const [adminEditSubmitting, setAdminEditSubmitting] = useState<boolean>(false);
  const [adminEditMsg, setAdminEditMsg] = useState<string>("");
  const [showBatchPtsModal, setShowBatchPtsModal] = useState<boolean>(false);
  const [batchPtsMap, setBatchPtsMap] = useState<Record<string, string>>({});
  const [batchScoreMap, setBatchScoreMap] = useState<Record<string, string>>({});
  const [batchSaveMsg, setBatchSaveMsg] = useState<string>("");

  const fetchPlayerOverrides = async () => {
    try {
      const res = await fetch("/api/admin/players/override");
      if (res.ok) {
        const data = await res.json();
        if (data.overrides) {
          const map: Record<string, any> = {};
          Object.entries(data.overrides).forEach(([k, v]: [string, any]) => {
            map[k] = v;
            if (v && v.nickname) {
              map[v.nickname] = v;
              map[v.nickname.toLowerCase()] = v;
            }
          });
          setPlayerOverridesMap(map);
        }
      }
    } catch (err) {
      console.error("Failed to fetch player overrides", err);
    }
  };

  const fetchWeeklySkill = async () => {
    try {
      const res = await fetch("/api/faceit/weekly-skill?checkAuto=1");
      if (res.ok) {
        const data = await res.json();
        if (data?.players) {
          setWeeklySkillMap(data.players);
        }
      }
    } catch (err) {
      console.error("Failed to fetch weekly skill snapshots", err);
    }
  };

  useEffect(() => {
    fetchPlayerOverrides();
    fetchWeeklySkill();
  }, []);

  const getPlayerSkillInfo = (
    playerId: string, 
    nickname: string, 
    eloVal?: number, 
    realPremierRating?: number, 
    statsObj?: any,
    faceitMatchesCount?: number,
    premierMatchesCount?: number
  ) => {
    const lowerNick = (nickname || "").toLowerCase();
    const ov = (playerId && playerOverridesMap[playerId]) || 
               (lowerNick && playerOverridesMap[lowerNick]) || 
               (nickname && playerOverridesMap[nickname]) || {};

    const baseElo = (playerId && playerEloMap[playerId]) || 
                    (lowerNick && playerEloMap[lowerNick]) || 
                    (nickname && playerEloMap[nickname]) || 
                    eloVal || 
                    ov.customElo || 
                    (ov.csRating ? Math.round(ov.csRating / 11.53) : 1000);

    const isRealPremier = Boolean(realPremierRating || ov.csRating);

    const skillRes = computeAdaptiveSkillScore({
      playerId,
      nickname,
      elo: baseElo,
      faceitMatches: faceitMatchesCount || 500,
      premierRating: realPremierRating || ov.csRating,
      premierMatches: premierMatchesCount || 0,
      isRealPremier,
      combatStats: statsObj ? {
        kd: statsObj.kd,
        adr: statsObj.adr,
        hltv: statsObj.hltv || statsObj.hltvRating,
        avgKills: statsObj.avgKills,
        hsPct: statsObj.hsPct,
        winrate: statsObj.winrate,
        matchesCount: statsObj.matchesCount || statsObj.matches || 0
      } : null,
      overrides: ov
    });

    return {
      ...skillRes,
      elo: baseElo,
      override: ov
    };
  };

  // Auth & Event of Mr.Chillout States
  const [userRole, setUserRole] = useState<"GUEST" | "EVENT_MAKER" | "ADMIN">("GUEST");
  const [userName, setUserName] = useState<string>("");
  const [eventAnnouncement, setEventAnnouncement] = useState<any>(null);
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [eventAnnText, setEventAnnText] = useState<string>("");
  const [eventAnnPrize, setEventAnnPrize] = useState<string>("Knife");
  const [eventAnnMsg, setEventAnnMsg] = useState<string>("");

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedRole = localStorage.getItem("sigma_user_role") as any;
      const savedName = localStorage.getItem("sigma_user_name");
      if (savedRole && ["GUEST", "EVENT_MAKER", "ADMIN"].includes(savedRole)) {
        setUserRole(savedRole);
      }
      if (savedName) {
        setUserName(savedName);
      }
    } catch (e) {}

    // Fetch active event announcement
    fetch("/api/events/announcement")
      .then(res => res.json())
      .then(data => {
        if (data && data.announcement) {
          setEventAnnouncement(data.announcement);
        }
      })
      .catch(() => {});

    // Fetch Steam / FACEIT user session
    fetch("/api/auth/steam/me")
      .then(res => res.json())
      .then(data => {
        if (data && data.authenticated && data.user) {
          setCurrentUser(data.user);
          // Fetch existing user pick
          fetch(`/api/fantasy/picks?userId=${data.user.steamId}`)
            .then(r => r.json())
            .then(pData => {
              if (pData?.pick) {
                setUserFantasyPick(pData.pick);
                setDraftSniper(pData.pick.sniper);
                setDraftSupport(pData.pick.support);
                setDraftDarkHorse(pData.pick.darkHorse);
              }
            }).catch(() => {});
        }
      })
      .catch(() => {});

    // Fetch Fantasy tournament & leaderboard
    fetch("/api/fantasy/tournament")
      .then(r => r.json())
      .then(d => { if (d?.tournament) setFantasyTour(d.tournament); })
      .catch(() => {});

    fetch("/api/fantasy/leaderboard")
      .then(r => r.json())
      .then(d => { if (d?.leaderboard) setFantasyLeaderboard(d.leaderboard); })
      .catch(() => {});
  }, []);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Fantasy League States
  const [fantasyTour, setFantasyTour] = useState<any>(null);
  const [fantasyLeaderboard, setFantasyLeaderboard] = useState<any[]>([]);
  const [userFantasyPick, setUserFantasyPick] = useState<any>(null);
  const [draftSniper, setDraftSniper] = useState<any>(null);
  const [draftSupport, setDraftSupport] = useState<any>(null);
  const [draftDarkHorse, setDraftDarkHorse] = useState<any>(null);
  const [isSavingFantasy, setIsSavingFantasy] = useState(false);
  const [fantasySaveMsg, setFantasySaveMsg] = useState("");
  const [fantasySearchSniper, setFantasySearchSniper] = useState("");
  const [fantasySearchSupport, setFantasySearchSupport] = useState("");
  const [fantasySearchDark, setFantasySearchDark] = useState("");
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showCybershokeModal, setShowCybershokeModal] = useState<boolean>(false);
  const [csMap1, setCsMap1] = useState<string>("de_mirage");
  const [csMap2, setCsMap2] = useState<string>("");
  const [csFaction1, setCsFaction1] = useState<string>("team_uncle007");
  const [csFaction2, setCsFaction2] = useState<string>("team_nika_jok");
  const [csScore1, setCsScore1] = useState<string>("13");
  const [csScore2, setCsScore2] = useState<string>("9");
  const [csWinner, setCsWinner] = useState<string>("faction1");
  const [csPlayerNick1, setCsPlayerNick1] = useState<string>("");
  const [csKills1, setCsKills1] = useState<string>("0");
  const [csDeaths1, setCsDeaths1] = useState<string>("0");
  const [csAssists1, setCsAssists1] = useState<string>("0");
  const [csPlayers1, setCsPlayers1] = useState<any[]>([]);

  const [csPlayerNick2, setCsPlayerNick2] = useState<string>("");
  const [csKills2, setCsKills2] = useState<string>("0");
  const [csDeaths2, setCsDeaths2] = useState<string>("0");
  const [csAssists2, setCsAssists2] = useState<string>("0");
  const [csPlayers2, setCsPlayers2] = useState<any[]>([]);
  const [csSubmitMsg, setCsSubmitMsg] = useState<string>("");
  const [authPasscode, setAuthPasscode] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [eventQuery, setEventQuery] = useState<string>("knife");
  const [eventLoading, setEventLoading] = useState<boolean>(false);
  const [eventResult, setEventResult] = useState<any>(null);

  async function handleRunEventQuery(promptToRun?: string) {
    const q = promptToRun !== undefined ? promptToRun : eventQuery;
    if (!q) return;
    setEventLoading(true);
    try {
      const res = await fetch("/api/events/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q, role: userRole })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEventResult(data);
      }
    } catch (err) {
      console.error("Failed to run event query:", err);
    } finally {
      setEventLoading(false);
    }
  }

  // Trigger Onboarding Tour on first load
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("hasSeenSigmaTour")) {
      setShowTourModal(true);
    }
  }, []);

  // Synchronize draft state from server API
  const fetchDraftState = async () => {
    try {
      const res = await fetch("/api/faceit/draft");
      if (res.ok) {
        const data = await res.json();
        if (data.step) setDraftStep(data.step);
        if (data.step !== "setup") {
          if (data.captains) setDraftCaptains(data.captains);
          if (data.poolInput !== undefined) setDraftPoolInput(data.poolInput);
        }
        if (data.availablePlayers) setDraftAvailablePlayers(data.availablePlayers);
        if (data.teams) setDraftTeams(data.teams);
        if (data.turnSequence) setDraftTurnSequence(data.turnSequence);
        if (data.currentStepIndex !== undefined) setDraftCurrentStepIndex(data.currentStepIndex);
        if (data.roomAssignment !== undefined) setDraftRoomAssignment(data.roomAssignment);
      }
    } catch (err) {
      console.error("Failed to sync draft state", err);
    }
  };

  // Poll server draft state every 2 seconds for real-time multi-user sync & persistence
  useEffect(() => {
    fetchDraftState();
    const interval = setInterval(fetchDraftState, 2000);
    return () => clearInterval(interval);
  }, []);

  const startDraftSetup = async () => {
    let names: string[] = [];
    if (draftPoolInput.trim()) {
      names = draftPoolInput.split("\n").map(n => n.trim()).filter(Boolean);
    } else if (members && members.length > 0) {
      names = members.map(m => m.nickname).filter(Boolean);
    }

    if (names.length < 4) {
      alert("В пуле должно быть минимум 4 игрока для проведения драфта!");
      return;
    }

    const captainsSet = new Set(draftCaptains.map(c => c.trim().toLowerCase()));
    const initialAvailable = names.filter(n => !captainsSet.has(n.toLowerCase()));

    const seq: number[] = [];
    let r = 0;
    while (seq.length < initialAvailable.length) {
      if (r % 2 === 0) seq.push(0, 1, 2, 3);
      else seq.push(3, 2, 1, 0);
      r++;
    }
    const finalSeq = seq.slice(0, initialAvailable.length);

    try {
      const res = await fetch("/api/faceit/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setup",
          captains: draftCaptains,
          poolInput: draftPoolInput,
          availablePlayers: initialAvailable,
          turnSequence: finalSeq
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDraftAvailablePlayers(data.availablePlayers);
        setDraftTeams(data.teams);
        setDraftTurnSequence(data.turnSequence);
        setDraftCurrentStepIndex(data.currentStepIndex);
        setDraftStep(data.step);
        setDraftRoomAssignment(null);
        setDraftErrorMsg("");
      }
    } catch (err) {
      console.error("Draft setup failed", err);
    }
  };

  const handlePickPlayer = async (playerPick: string) => {
    try {
      const res = await fetch("/api/faceit/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pick",
          playerPick
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDraftAvailablePlayers(data.availablePlayers);
        setDraftTeams(data.teams);
        setDraftTurnSequence(data.turnSequence);
        setDraftCurrentStepIndex(data.currentStepIndex);
        setDraftStep(data.step);
      }
    } catch (err) {
      console.error("Draft pick failed", err);
    }
  };

  const handleResetDraft = async () => {
    try {
      const res = await fetch("/api/faceit/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" })
      });
      if (res.ok) {
        const data = await res.json();
        setDraftStep(data.step);
        setDraftCaptains(data.captains);
        setDraftPoolInput(data.poolInput);
        setDraftAvailablePlayers(data.availablePlayers);
        setDraftTeams(data.teams);
        setDraftCurrentStepIndex(data.currentStepIndex);
        setDraftRoomAssignment(null);
        setDraftErrorMsg("");
      }
    } catch (err) {
      console.error("Draft reset failed", err);
    }
  };

  const getPlayerSkillNumber = (name: string): number => {
    if (!name) return 50;
    const p = members.find(m => (m.nickname || "").toLowerCase() === name.toLowerCase()) || {};
    const pId = p.user_id || p.player_id || p.id || "";
    const info = getPlayerSkillInfo(pId, name);
    return info?.score || 50;
  };

  const handleRollRooms = async () => {
    setIsRollingRooms(true);
    try {
      const res = await fetch("/api/faceit/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "roll_rooms" })
      });
      if (res.ok) {
        const data = await res.json();
        setDraftRoomAssignment(data.roomAssignment);
      }
    } catch (e) {
      console.error("Room roll failed", e);
    } finally {
      setIsRollingRooms(false);
    }
  };

  const downloadDraftResultsFile = () => {
    const dateStr = new Date().toLocaleString("ru-RU");
    let content = "=================================================\n";
    content += "   РЕЗУЛЬТАТЫ КАПИТАНСКОГО ДРАФТА (СИГМА КИБЕР КЛУБ)\n";
    content += "   Лимит очков на команду: 300 PTS (+- 10 PTS)\n";
    content += `   Дата: ${dateStr}\n`;
    content += "=================================================\n\n";

    draftCaptains.forEach((cap, idx) => {
      const roster = draftTeams[idx] || [];
      const teamPts = roster.reduce((sum, pName) => sum + getPlayerSkillNumber(pName), 0);
      const remainingPts = 300 - teamPts;
      let roomTag = "";
      if (draftRoomAssignment) {
        if (draftRoomAssignment.vip.includes(idx)) roomTag = " [ВИП-ЗАЛ]";
        if (draftRoomAssignment.main.includes(idx)) roomTag = " [ОБЩИЙ ЗАЛ]";
      }

      content += `--- КОМАНДА ${idx + 1} (Капитан: ${cap})${roomTag} ---\n`;
      content += `Суммарный скилл: ${teamPts} / 300 PTS (Остаток: ${remainingPts} PTS)\n`;
      roster.forEach((member, i) => {
        const pSkill = getPlayerSkillNumber(member);
        content += `  ${i + 1}. ${member} [${pSkill} PTS]${i === 0 ? " (Капитан)" : ""}\n`;
      });
      content += "\n";
    });

    if (draftRoomAssignment) {
      content += "=================================================\n";
      content += "   РАСПРЕДЕЛЕНИЕ ИГРОВЫХ ЗОН:\n";
      content += "=================================================\n";
      content += `ВИП-ЗАЛ: Команда ${draftRoomAssignment.vip[0] + 1} (${draftCaptains[draftRoomAssignment.vip[0]]}) и Команда ${draftRoomAssignment.vip[1] + 1} (${draftCaptains[draftRoomAssignment.vip[1]]})\n`;
      content += `ОБЩИЙ ЗАЛ: Команда ${draftRoomAssignment.main[0] + 1} (${draftCaptains[draftRoomAssignment.main[0]]}) и Команда ${draftRoomAssignment.main[1] + 1} (${draftCaptains[draftRoomAssignment.main[1]]})\n\n`;
    }

    content += "-------------------------------------------------\n";
    content += "Сформировано на сайте СИГМА КИБЕР КЛУБ\n";
    content += "Powered by XZiBiTuM\n";

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sigma_teams_draft_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Load hub data when hubId changes
  useEffect(() => {
    if (!hubId) {
      setIsLoadingHub(false);
      return;
    }

    const fetchHubData = async () => {
      setIsLoadingHub(true);
      setError(null);
      setHubDetails(null);
      setLeaderboards([]);
      setRankings([]);
      setMatches([]);

      try {
        // Fetch Hub Info
        const hubRes = await fetch(`/api/faceit/hubs/${hubId}`);
        if (!hubRes.ok) {
          const errData = await hubRes.json();
          throw new Error(errData.error || "Не удалось загрузить информацию о хабе");
        }
        const hubData = await hubRes.json();
        setHubDetails(hubData);

        // Fetch Hub Members & Populate ELO Map FIRST
        const membersRes = await fetch(`/api/faceit/hubs/${hubId}/members`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          const items = membersData.items || [];
          setMembers(items);

          const eloMap: Record<string, number> = {};
          items.forEach((m: any) => {
            const elo = m.faceit_elo || m.elo || m.games?.cs2?.faceit_elo || m.games?.csgo?.faceit_elo;
            if (elo) {
              if (m.user_id) eloMap[m.user_id] = elo;
              if (m.player_id) eloMap[m.player_id] = elo;
              if (m.nickname) {
                eloMap[m.nickname] = elo;
                eloMap[m.nickname.toLowerCase()] = elo;
              }
            }
          });
          setPlayerEloMap(prev => ({ ...prev, ...eloMap }));
        }

        // Fetch Hub Leaderboards NEXT
        const leaderboardsRes = await fetch(`/api/faceit/hubs/${hubId}/leaderboards`);
        let finalLeaderboards = [{ leaderboard_id: "general", leaderboard_name: "Общий рейтинг (All-time)", status: "ACTIVE" }];
        if (leaderboardsRes.ok) {
          const lbData = await leaderboardsRes.json();
          const items = lbData.items || [];
          finalLeaderboards = [...items, ...finalLeaderboards];
        }
        setLeaderboards(finalLeaderboards);
        setSelectedLeaderboardId(finalLeaderboards[0].leaderboard_id);

        // Fetch Hub Matches
        fetchMatches();
      } catch (err: any) {
        setError(err.message || "Произошла ошибка при загрузке хаба");
      } finally {
        setIsLoadingHub(false);
      }
    };

    fetchHubData();
  }, [hubId]);

  // Fetch rankings when selected leaderboard changes
  useEffect(() => {
    if (!selectedLeaderboardId) return;

    const fetchRankings = async () => {
      setIsLoadingRankings(true);
      try {
        const endpoint = selectedLeaderboardId === "general"
          ? `/api/faceit/hubs/${hubId}/leaderboards/general?limit=50`
          : `/api/faceit/leaderboards/${selectedLeaderboardId}?limit=50`;

        const res = await fetch(endpoint);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Не удалось загрузить рейтинг");
        }
        const data = await res.json();
        setRankings(data.items || []);
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsLoadingRankings(false);
      }
    };

    fetchRankings();
  }, [selectedLeaderboardId, hubId]);

  // Fetch hub matches
  const fetchMatches = async () => {
    if (!hubId) return;
    setIsLoadingMatches(true);
    try {
      const res = await fetch(`/api/faceit/hubs/${hubId}/matches?limit=40`);
      if (res.ok) {
        const data = await res.json();
        setMatches(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load matches", err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  // Fetch hub tournaments
  const fetchTournaments = async () => {
    if (!hubId) return;
    setIsLoadingTournaments(true);
    try {
      const res = await fetch(`/api/faceit/hubs/${hubId}/tournaments`);
      if (!res.ok) {
        throw new Error("Не удалось загрузить турнирную статистику");
      }
      const data = await res.json();
      setTournaments(data.tournaments || []);
      if (data.tournaments?.length > 0 && !selectedTournamentId) {
        setSelectedTournamentId(data.tournaments[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load tournaments", err);
    } finally {
      setIsLoadingTournaments(false);
    }
  };

  // Trigger tournaments fetch when tab is active
  useEffect(() => {
    if (activeTab === "tournaments" && tournaments.length === 0) {
      fetchTournaments();
    }
  }, [activeTab, tournaments.length]);

  // Periodic background auto-refresh for live leaderboard and match updates (every 60 seconds)
  useEffect(() => {
    if (!hubId) return;

    const silentRefresh = async () => {
      try {
        const mRes = await fetch(`/api/faceit/hubs/${hubId}/matches?limit=40`);
        if (mRes.ok) {
          const data = await mRes.json();
          if (data.items) setMatches(data.items);
        }

        if (selectedLeaderboardId) {
          const endpoint = selectedLeaderboardId === "general"
            ? `/api/faceit/hubs/${hubId}/leaderboards/general?limit=50`
            : `/api/faceit/leaderboards/${selectedLeaderboardId}?limit=50`;

          const rRes = await fetch(endpoint);
          if (rRes.ok) {
            const rData = await rRes.json();
            if (rData.items) setRankings(rData.items);
          }
        }
      } catch (err) {
        console.warn("Background auto-refresh failed:", err);
      }
    };

    const interval = setInterval(silentRefresh, 60000);
    return () => clearInterval(interval);
  }, [hubId, selectedLeaderboardId]);

  // Fetch match details modal stats
  const loadMatchDetails = async (matchId: string) => {
    setSelectedMatchId(matchId);
    setIsLoadingMatchDetails(true);
    setMatchDetails(null);
    
    // Clear per-map timeline states
    setRoundHistories({});
    setLoadingMapIndexes({});
    setManualDemoUrls({});
    setSubmittingDemoUrls({});
    setSelectedRadarRoundIndexes({});
    setShowAllMatchDeathsMap({});
    
    try {
      const res = await fetch(`/api/faceit/matches/${matchId}/stats`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ошибка загрузки статистики");
      }
      const data = await res.json();
      const rounds = data.rounds || [];
      setMatchDetails(rounds);

      // Auto-load history for ALL maps simultaneously
      if (rounds.length > 0) {
        rounds.forEach((_: any, idx: number) => {
          loadRoundHistoryForMap(matchId, idx);
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingMatchDetails(false);
    }
  };

  const loadRoundHistoryForMap = async (matchId: string, mapIndex: number) => {
    setLoadingMapIndexes(prev => ({ ...prev, [mapIndex]: true }));
    try {
      const res = await fetch(`/api/faceit/matches/${matchId}/round-history?mapIndex=${mapIndex}`);
      if (res.ok) {
        const data = await res.json();
        setRoundHistories(prev => ({ ...prev, [mapIndex]: data }));
      }
    } catch (err) {
      console.error("Failed to load round history for map index " + mapIndex, err);
    } finally {
      setLoadingMapIndexes(prev => ({ ...prev, [mapIndex]: false }));
    }
  };

  const submitManualDemoUrlForMap = async (mapIndex: number, url: string) => {
    if (!selectedMatchId || !url.trim()) return;
    setSubmittingDemoUrls(prev => ({ ...prev, [mapIndex]: true }));
    setLoadingMapIndexes(prev => ({ ...prev, [mapIndex]: true }));
    try {
      const res = await fetch(`/api/faceit/matches/${selectedMatchId}/round-history?mapIndex=${mapIndex}&demoUrl=${encodeURIComponent(url.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setRoundHistories(prev => ({ ...prev, [mapIndex]: data }));
        setManualDemoUrls(prev => ({ ...prev, [mapIndex]: "" }));
        setSelectedRadarRoundIndexes(prev => ({ ...prev, [mapIndex]: null }));
        setShowAllMatchDeathsMap(prev => ({ ...prev, [mapIndex]: false }));
      } else {
        alert("Не удалось спарсить демку по этой ссылке. Пожалуйста, проверьте ссылку.");
      }
    } catch (err) {
      console.error("Failed to load manual round history", err);
      alert("Произошла ошибка при загрузке демки.");
    } finally {
      setSubmittingDemoUrls(prev => ({ ...prev, [mapIndex]: false }));
      setLoadingMapIndexes(prev => ({ ...prev, [mapIndex]: false }));
    }
  };

  const getDeathsForRound = (mapIndex: number, roundNum: number) => {
    const history = roundHistories[mapIndex];
    if (!history || !history.deaths || !history.rounds) return [];
    
    const roundIndex = roundNum - 1;
    const currentRound = history.rounds[roundIndex];
    if (!currentRound) return [];

    const endTick = currentRound.tick;
    const startTick = roundIndex > 0 ? history.rounds[roundIndex - 1].tick : 0;

    return history.deaths.filter((d: any) => d.tick > startTick && d.tick <= endTick);
  };

  const renderRadarMap = (mapIndex: number, mapName: string, t1Name: string, t2Name: string, isT1StartedCT: boolean, roundTeams?: any[]) => {
    const history = roundHistories[mapIndex];
    const selectedRadarRoundIndex = selectedRadarRoundIndexes[mapIndex];
    const showAllMatchDeaths = showAllMatchDeathsMap[mapIndex];

    if ((!selectedRadarRoundIndex && !showAllMatchDeaths) || !history) return null;
    
    const cleanMapName = getMapFileName(mapName);
    const config = MAP_CONFIGS[cleanMapName] || MAP_CONFIGS[mapName];
    if (!config) {
      return (
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1rem", textAlign: "center" }}>
          Настройки координат для карты {mapName || "неизвестно"} не найдены. Карта убийств недоступна.
        </div>
      );
    }

    const roundDeaths = showAllMatchDeaths ? (history.deaths || []) : getDeathsForRound(mapIndex, selectedRadarRoundIndex!);
    const radarUrl = `https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/${mapName}_radar_psd.png`;

    const getRoundWinnerTeam = (roundWinnerSide: string, roundIndex: number) => {
      const isFirstHalf = roundIndex < 12;
      if (isFirstHalf) {
        if (roundWinnerSide === "CT") {
          return isT1StartedCT ? 1 : 2;
        } else {
          return isT1StartedCT ? 2 : 1;
        }
      } else {
        if (roundWinnerSide === "CT") {
          return isT1StartedCT ? 2 : 1;
        } else {
          return isT1StartedCT ? 1 : 2;
        }
      }
    };

    const getPlayerSideInRound = (playerName: string, rawTeam: any) => {
      if (selectedRadarRoundIndex && history && history.rounds) {
        const rIdx = selectedRadarRoundIndex - 1;
        const isFirstHalf = rIdx < 12;
        const team1 = roundTeams?.[0];
        const team2 = roundTeams?.[1];

        const pClean = (playerName || "").toLowerCase().trim();
        const isT1 = team1?.players?.some((p: any) => {
          const nick = (p.nickname || "").toLowerCase().trim();
          return nick === pClean || (pClean && nick.includes(pClean)) || (nick && pClean.includes(nick));
        });
        const isT2 = team2?.players?.some((p: any) => {
          const nick = (p.nickname || "").toLowerCase().trim();
          return nick === pClean || (pClean && nick.includes(pClean)) || (nick && pClean.includes(nick));
        });

        if (isT1) {
          return (isFirstHalf ? isT1StartedCT : !isT1StartedCT) ? "CT" : "T";
        }
        if (isT2) {
          return (isFirstHalf ? isT1StartedCT : !isT1StartedCT) ? "T" : "CT";
        }
      }

      if (rawTeam !== null && rawTeam !== undefined) {
        const str = String(rawTeam).toUpperCase().trim();
        if (str === "CT" || str === "3" || str.includes("COUNTER") || str.includes("CT")) return "CT";
        if (str === "T" || str === "2" || str.includes("TERROR")) return "T";
      }

      return "T";
    };

    const getReasonText = (reason: string) => {
      switch (reason) {
        case "bomb_exploded": return "Взрыв бомбы";
        case "bomb_defused": return "Разминирование бомбы";
        case "time_expired": return "Время раунда истекло";
        default: return "Устранение соперников";
      }
    };

    let currentRound: any = null;
    let durationText = "";
    let winnerName = "";
    let winnerSide = "";
    if (selectedRadarRoundIndex && history.rounds) {
      const rIdx = selectedRadarRoundIndex - 1;
      currentRound = history.rounds[rIdx];
      if (currentRound) {
        winnerSide = currentRound.winner;
        const winnerTeamNum = getRoundWinnerTeam(winnerSide, rIdx);
        winnerName = winnerTeamNum === 1 ? t1Name : t2Name;

        const startTick = rIdx > 0 ? history.rounds[rIdx - 1].tick : 0;
        const durationSec = Math.round((currentRound.tick - startTick) / 64);
        if (durationSec > 0) {
          const min = Math.floor(durationSec / 60);
          const sec = durationSec % 60;
          durationText = `${min}м ${sec}с`;
        }
      }
    }

    return (
      <div style={{
        marginTop: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        background: "rgba(10, 8, 20, 0.45)",
        border: "1px solid var(--border-light)",
        borderRadius: "16px",
        padding: "1.25rem 1.5rem",
        position: "relative",
        width: "100%"
      }}>
        {/* Dedicated Header Bar with Close Button */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "0.75rem"
        }}>
          <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {showAllMatchDeaths ? "Интерактивный разбор: Тепловая карта всего матча" : `Интерактивный разбор: Раунд ${selectedRadarRoundIndex}`}
          </span>
          <button 
            onClick={() => {
              setSelectedRadarRoundIndexes(prev => ({ ...prev, [mapIndex]: null }));
              setShowAllMatchDeathsMap(prev => ({ ...prev, [mapIndex]: false }));
              setHoveredKillIdx(null);
              setSelectedKillIdx(null);
            }}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-light)",
              borderRadius: "6px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "0.75rem",
              padding: "0.35rem 0.75rem",
              fontWeight: "700",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Закрыть ✕
          </button>
        </div>

        {/* Main 2-Column Content Layout */}
        <div style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "1.5rem",
          width: "100%"
        }}>
          {/* Left Column: Radar View */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          flex: "1 1 400px",
          maxWidth: "450px",
          width: "100%"
        }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: "800", color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-cyan)" }} />
            {showAllMatchDeaths ? "Интерактивная тепловая карта смертей" : `Интерактивная карта убийств`}
          </h4>

          {/* Map Container */}
          <div style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1/1",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "#0b0c10",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
          }}>
            {/* SVG Map Overlay */}
            <svg 
              viewBox="0 0 1024 1024" 
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 10
              }}
            >
              {/* Background Map Image */}
              <image 
                href={radarUrl} 
                width="1024" 
                height="1024" 
                style={{ opacity: 0.85 }}
              />

              {showAllMatchDeaths ? (
                // Heatmap Mode: Render glowing overlapping heat spots
                roundDeaths.map((d: any, idx: number) => {
                  if (d.victimX === null) return null;
                  const vicX = (d.victimX - config.pos_x) / config.scale;
                  const vicY = (config.pos_y - d.victimY) / config.scale;
                  const isVicCT = d.victimTeam === "CT";

                  return (
                    <g key={`heat-${idx}`}>
                      {/* Glowing outer aura */}
                      <circle 
                        cx={vicX} 
                        cy={vicY} 
                        r="35" 
                        fill={isVicCT ? "rgba(0, 184, 212, 0.12)" : "rgba(255, 61, 0, 0.12)"} 
                        style={{ mixBlendMode: "screen", filter: "blur(5px)" }}
                      />
                      {/* Inner intense glow */}
                      <circle 
                        cx={vicX} 
                        cy={vicY} 
                        r="16" 
                        fill={isVicCT ? "rgba(0, 184, 212, 0.35)" : "rgba(255, 61, 0, 0.35)"} 
                        style={{ mixBlendMode: "screen", filter: "blur(2px)" }}
                      />
                      {/* Solid tiny core */}
                      <circle 
                        cx={vicX} 
                        cy={vicY} 
                        r="4" 
                        fill={isVicCT ? "#00b8d4" : "#ff3d00"} 
                        stroke="#fff"
                        strokeWidth="1.5"
                      />
                      <title>{`${d.victimName || "Игрок"} (${d.victimTeam || "?"}) погиб от ${d.weapon || "оружия"} от ${d.attackerName || "кого-то"}`}</title>
                    </g>
                  );
                })
              ) : (
                // Detailed Round Kill Map Mode
                <>
                  {/* Definitions for SVG markers (arrows) */}
                  <defs>
                    <marker id={`arrow-ct-${mapIndex}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(0, 184, 212, 0.8)" />
                    </marker>
                    <marker id={`arrow-t-${mapIndex}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(255, 61, 0, 0.8)" />
                    </marker>
                  </defs>

                  {/* Kill Lines */}
                  {roundDeaths.map((d: any, idx: number) => {
                    if (d.attackerX === null || d.victimX === null) return null;
                    
                    const atkX = (d.attackerX - config.pos_x) / config.scale;
                    const atkY = (config.pos_y - d.attackerY) / config.scale;
                    const vicX = (d.victimX - config.pos_x) / config.scale;
                    const vicY = (config.pos_y - d.victimY) / config.scale;

                    const isAtkCT = getPlayerSideInRound(d.attackerName, d.attackerTeam) === "CT";
                    const activeKillIdx = hoveredKillIdx !== null ? hoveredKillIdx : selectedKillIdx;
                    const isKillActive = activeKillIdx !== null;
                    const isThisKillActive = activeKillIdx === idx;
                    const opacity = isKillActive ? (isThisKillActive ? 1.0 : 0.15) : 1.0;
                    const strokeColor = isThisKillActive 
                      ? (isAtkCT ? "#00ffff" : "#ff1744") 
                      : (isAtkCT ? "rgba(0, 184, 212, 0.65)" : "rgba(255, 61, 0, 0.65)");
                    const markerId = isAtkCT ? `url(#arrow-ct-${mapIndex})` : `url(#arrow-t-${mapIndex})`;

                    return (
                      <g 
                        key={`line-${idx}`} 
                        style={{ opacity: opacity, transition: "all 0.2s ease", cursor: "pointer" }}
                        onMouseEnter={() => setHoveredKillIdx(idx)}
                        onMouseLeave={() => setHoveredKillIdx(null)}
                        onClick={() => setSelectedKillIdx(selectedKillIdx === idx ? null : idx)}
                      >
                        <line 
                          x1={atkX} 
                          y1={atkY} 
                          x2={vicX} 
                          y2={vicY} 
                          stroke={strokeColor} 
                          strokeWidth={isThisKillActive ? "7" : "4"} 
                          strokeDasharray={isThisKillActive ? "none" : "8,6"}
                          markerEnd={markerId}
                        />
                      </g>
                    );
                  })}

                  {/* Kill Dots */}
                  {roundDeaths.map((d: any, idx: number) => {
                    if (d.victimX === null) return null;
                    
                    const vicX = (d.victimX - config.pos_x) / config.scale;
                    const vicY = (config.pos_y - d.victimY) / config.scale;

                    const isVicCT = getPlayerSideInRound(d.victimName, d.victimTeam) === "CT";
                    const isAtkCT = getPlayerSideInRound(d.attackerName, d.attackerTeam) === "CT";
                    const activeKillIdx = hoveredKillIdx !== null ? hoveredKillIdx : selectedKillIdx;
                    const isKillActive = activeKillIdx !== null;
                    const isThisKillActive = activeKillIdx === idx;
                    const opacity = isKillActive ? (isThisKillActive ? 1.0 : 0.15) : 1.0;

                    const dotColor = isVicCT ? "rgba(0, 184, 212, 0.95)" : "rgba(255, 61, 0, 0.95)";
                    const strokeColor = "#fff";

                    const atkX = d.attackerX !== null ? (d.attackerX - config.pos_x) / config.scale : null;
                    const atkY = d.attackerY !== null ? (config.pos_y - d.attackerY) / config.scale : null;

                    return (
                      <g 
                        key={`dots-${idx}`} 
                        style={{ opacity: opacity, transition: "all 0.2s ease", cursor: "pointer" }}
                        onMouseEnter={() => setHoveredKillIdx(idx)}
                        onMouseLeave={() => setHoveredKillIdx(null)}
                        onClick={() => setSelectedKillIdx(selectedKillIdx === idx ? null : idx)}
                      >
                        {/* Attacker Dot */}
                        {atkX !== null && atkY !== null && (
                          <g>
                            {isThisKillActive && (
                              <circle 
                                cx={atkX} 
                                cy={atkY} 
                                r="18" 
                                fill={isAtkCT ? "rgba(0, 229, 255, 0.3)" : "rgba(255, 61, 0, 0.3)"} 
                                className="animate-pulse"
                              />
                            )}
                            <circle 
                              cx={atkX} 
                              cy={atkY} 
                              r={isThisKillActive ? 12 : 8} 
                              fill={isAtkCT ? "rgba(0, 184, 212, 0.95)" : "rgba(255, 61, 0, 0.95)"} 
                              stroke={strokeColor} 
                              strokeWidth={isThisKillActive ? "3" : "1.5"} 
                            />
                            <title>{`${d.attackerName || "Игрок"} (${isAtkCT ? "CT" : "T"})`}</title>
                          </g>
                        )}

                        {/* Victim Dot */}
                        <g>
                          {isThisKillActive && (
                            <circle 
                              cx={vicX} 
                              cy={vicY} 
                              r="22" 
                              fill={isVicCT ? "rgba(0, 229, 255, 0.3)" : "rgba(255, 61, 0, 0.3)"} 
                              className="animate-pulse"
                            />
                          )}
                          <circle 
                            cx={vicX} 
                            cy={vicY} 
                            r={isThisKillActive ? 15 : 11} 
                            fill={dotColor} 
                            stroke={strokeColor} 
                            strokeWidth={isThisKillActive ? "3.5" : "2"} 
                          />
                          <text 
                            x={vicX} 
                            y={vicY + (isThisKillActive ? 4.5 : 3.5)} 
                            fill="#fff" 
                            fontSize={isThisKillActive ? "13" : "10"} 
                            fontWeight="bold" 
                            textAnchor="middle"
                          >
                            ✕
                          </text>
                          <title>{`${d.victimName || "Игрок"} (${isVicCT ? "CT" : "T"}) умер от ${d.weapon || "оружия"}`}</title>
                        </g>
                      </g>
                    );
                  })}
                </>
              )}
            </svg>
          </div>

          {showAllMatchDeaths && (
            <div style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textAlign: "center",
              lineHeight: "1.4",
              background: "rgba(0,0,0,0.15)",
              padding: "0.5rem",
              borderRadius: "6px"
            }}>
              Плотность свечения показывает места наиболее частых смертей за весь матч.
            </div>
          )}
        </div>

        {/* Right Column: Detailed Stats Panel */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          flex: "1 1 300px",
          minWidth: "280px"
        }}>
          {/* Header Info */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-light)",
            borderRadius: "12px",
            padding: "1rem"
          }}>
            {showAllMatchDeaths ? (
              <div>
                <span style={{ fontSize: "1.2rem", fontWeight: "900", color: "#fff", display: "block" }}>
                  Весь матч
                </span>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", marginTop: "0.35rem", lineHeight: "1.4" }}>
                  Показываются все зафиксированные смерти за игру. Выберите конкретный раунд на временной шкале выше для пошагового анализа раундов.
                </span>
              </div>
            ) : currentRound ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "1.3rem", fontWeight: "950", color: "#fff", letterSpacing: "-0.02em" }}>
                    Раунд {selectedRadarRoundIndex}
                  </span>
                  {durationText && (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
                      ⏳ {durationText}
                    </span>
                  )}
                </div>

                {/* Winner Info Banner */}
                <div style={{
                  background: winnerSide === "CT" 
                    ? "linear-gradient(135deg, rgba(0, 184, 212, 0.15), rgba(0, 184, 212, 0.03))" 
                    : "linear-gradient(135deg, rgba(255, 61, 0, 0.15), rgba(255, 61, 0, 0.03))",
                  border: winnerSide === "CT" 
                    ? "1px solid rgba(0, 184, 212, 0.35)" 
                    : "1px solid rgba(255, 61, 0, 0.35)",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem"
                }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.05em" }}>
                    Победитель раунда
                  </div>
                  <div style={{ 
                    fontSize: "1.05rem", 
                    fontWeight: "900", 
                    color: winnerSide === "CT" ? "#00e5ff" : "#ff5252",
                    marginTop: "0.15rem"
                  }}>
                    {winnerName} <span style={{ fontSize: "0.8rem", fontWeight: "bold", color: "var(--text-muted)" }}>({winnerSide})</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Способ победы:</span>{" "}
                    <strong style={{ color: "#fff" }}>{getReasonText(currentRound.reason)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>Загрузка статистики раунда...</span>
            )}
          </div>

          {/* Kill Feed Chronological Events List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Хроника убийств (Kill Feed)
            </span>

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              maxHeight: "260px",
              overflowY: "auto",
              background: "rgba(0,0,0,0.2)",
              padding: "0.75rem",
              borderRadius: "10px",
              border: "1px solid var(--border-light)"
            }}>
              {roundDeaths.map((d: any, idx: number) => {
                const isAtkCT = getPlayerSideInRound(d.attackerName, d.attackerTeam) === "CT";
                const isVicCT = getPlayerSideInRound(d.victimName, d.victimTeam) === "CT";
                const atkColor = isAtkCT ? "#00e5ff" : "#ff5252";
                const vicColor = isVicCT ? "#00e5ff" : "#ff5252";
                const weaponIconUrl = getWeaponIconUrl(d.weapon);
                const activeKillIdx = hoveredKillIdx !== null ? hoveredKillIdx : selectedKillIdx;
                const isItemActive = activeKillIdx === idx;

                return (
                  <div 
                    key={idx} 
                    style={{
                      fontSize: "0.78rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.45rem 0.65rem",
                      background: isItemActive ? "rgba(0, 229, 255, 0.18)" : "rgba(255,255,255,0.02)",
                      border: isItemActive ? "1px solid #00e5ff" : "1px solid rgba(255,255,255,0.03)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      boxShadow: isItemActive ? "0 0 12px rgba(0, 229, 255, 0.3)" : "none",
                      transform: isItemActive ? "scale(1.02) translateX(3px)" : "scale(1)",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={() => setHoveredKillIdx(idx)}
                    onMouseLeave={() => setHoveredKillIdx(null)}
                    onClick={() => setSelectedKillIdx(selectedKillIdx === idx ? null : idx)}
                  >
                    {/* Attacker */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flex: 1, minWidth: "95px" }}>
                      {d.attackerName ? (
                        <>
                          <span style={{ color: atkColor, fontWeight: "800", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90px" }} title={`${d.attackerName} (${isAtkCT ? "CT" : "T"})`}>
                            {d.attackerName}
                          </span>
                          <span style={{ 
                            color: atkColor, 
                            fontSize: "0.55rem", 
                            fontWeight: "900", 
                            background: isAtkCT ? "rgba(0, 229, 255, 0.12)" : "rgba(255, 61, 0, 0.12)",
                            border: isAtkCT ? "1px solid rgba(0, 229, 255, 0.3)" : "1px solid rgba(255, 61, 0, 0.3)",
                            padding: "0.05rem 0.25rem",
                            borderRadius: "3px"
                          }}>
                            {isAtkCT ? "CT" : "T"}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                          Мир
                        </span>
                      )}
                    </div>
                    
                    {/* Weapon / Action */}
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "0.4rem", 
                      color: "var(--text-primary)",
                      background: "rgba(0,0,0,0.45)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      fontWeight: "700"
                    }}>
                      {weaponIconUrl ? (
                        <img 
                          src={weaponIconUrl} 
                          alt={d.weapon || "weapon"} 
                          title={d.weapon || "weapon"}
                          style={{
                            height: "16px",
                            maxHeight: "16px",
                            maxWidth: "42px",
                            filter: "brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.8))",
                            objectFit: "contain"
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "inline";
                          }}
                        />
                      ) : null}
                      <span style={{ display: weaponIconUrl ? "none" : "inline", fontSize: "0.7rem" }}>
                        {d.weapon || "suicide"}
                      </span>

                      {d.headshot && (
                        <img 
                          src="/icons/headshot.svg" 
                          alt="Headshot" 
                          title="Попадание в голову (Headshot)"
                          style={{
                            height: "15px",
                            verticalAlign: "middle"
                          }}
                        />
                      )}

                      <span style={{ color: "var(--text-muted)", marginLeft: "0.1rem" }}>➔</span>
                    </div>

                    {/* Victim */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flex: 1, minWidth: "95px", justifyContent: "flex-end", textAlign: "right" }}>
                      <span style={{ color: vicColor, fontWeight: "800", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90px" }} title={`${d.victimName} (${isVicCT ? "CT" : "T"})`}>
                        {d.victimName}
                      </span>
                      <span style={{ 
                        color: vicColor, 
                        fontSize: "0.55rem", 
                        fontWeight: "900", 
                        background: isVicCT ? "rgba(0, 229, 255, 0.12)" : "rgba(255, 61, 0, 0.12)",
                        border: isVicCT ? "1px solid rgba(0, 229, 255, 0.3)" : "1px solid rgba(255, 61, 0, 0.3)",
                        padding: "0.05rem 0.25rem",
                        borderRadius: "3px"
                      }}>
                        {isVicCT ? "CT" : "T"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {roundDeaths.length === 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem 0" }}>
                  В этом раунде нет зафиксированных смертей.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

  // Fetch player details modal stats
  const loadPlayerDetails = async (playerId: string, rankingItem?: any) => {
    setSelectedPlayerId(playerId);
    setPlayerProfile(null);
    setPlayerGameStats(null);
    setPlayerHubStats(null);
    setLeetifyStats(null);
    setPlayerSteamStats(null);
    setPlayerModalTab("general");
    setPlayerActiveLeaderboardItem(rankingItem || null);
    setIsLoadingPlayer(true);
    try {
      // 1. Fetch Profile info (avatar, nickname, Elo, level)
      const profileRes = await fetch(`/api/faceit/players/${playerId}`);
      if (!profileRes.ok) throw new Error("Ошибка загрузки профиля");
      const profileData = await profileRes.json();
      setPlayerProfile(profileData);

      // 2. Fetch game-specific statistics (e.g. for CS2 or game of the hub)
      const gameId = hubDetails?.game_id || "cs2";
      const statsRes = await fetch(`/api/faceit/players/${playerId}/stats/${gameId}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setPlayerGameStats(statsData);
      }

      // 3. Fetch Hub statistics (HLTV 2.0, streaks, recent results, map stats)
      try {
        const hubStatsRes = await fetch(`/api/faceit/players/${playerId}/hub-stats`);
        if (hubStatsRes.ok) {
          const hubStatsData = await hubStatsRes.json();
          if (hubStatsData && !hubStatsData.error) {
            setPlayerHubStats(hubStatsData);
          }
        }
      } catch (e) {
        console.warn("Hub stats fetch failed:", e);
      }

      // 4. Fetch Leetify statistics via proxy endpoint
      try {
        const leetifyRes = await fetch(`/api/faceit/players/${playerId}/leetify`);
        if (leetifyRes.ok) {
          const leetifyData = await leetifyRes.json();
          if (leetifyData && !leetifyData.error) {
            setLeetifyStats(leetifyData);
          }
        }
      } catch (e) {
        console.warn("Leetify stats fetch failed:", e);
      }

      // 5. Fetch Steam / Valve Premier statistics
      try {
        const steamRes = await fetch(`/api/faceit/players/${playerId}/steam-stats`);
        if (steamRes.ok) {
          const steamData = await steamRes.json();
          if (steamData && !steamData.error) {
            setPlayerSteamStats(steamData);
          }
        }
      } catch (e) {
        console.warn("Steam stats fetch failed:", e);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingPlayer(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hubIdInput.trim()) {
      // Extract UUID from input if it is a URL
      let cleanId = hubIdInput.trim();
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = cleanId.match(uuidRegex);
      if (match) {
        cleanId = match[0];
      }
      setHubId(cleanId);
    }
  };

  const resetSearch = () => {
    setHubId(null);
    setHubDetails(null);
    setLeaderboards([]);
    setRankings([]);
    setMatches([]);
    setMembers([]);
    setHubIdInput("");
    setError(null);
  };

  // Filters & Sorting for client-side lists
  const filteredRankings = rankings
    .filter((item) => {
      const playerInfo = item.player || (item as any).user;
      const nickname = (playerInfo?.nickname || "").toLowerCase();

      // Filter by min matches played in hub
      const matchesCount = item.played ?? (item as any).matches ?? (item as any).played_matches ?? 0;
      if (minMatchesFilter > 0 && matchesCount < minMatchesFilter) {
        return false;
      }

      return nickname.includes(playerSearchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortField === "default") return 0;

      const extractInfo = (item: any) => {
        const p = item.player || item.user || item;
        const id = p.player_id || p.user_id || p.id || item.player_id || item.user_id || item.id || "";
        const nick = p.nickname || item.nickname || "";
        const elo = (item.player as any)?.faceit_elo || (item as any).elo || (item.player as any)?.elo || p.faceit_elo || p.elo || item.faceit_elo;
        const hubStats = item.hubStats || (item.player as any)?.hubStats;
        return { id, nick, elo, hubStats };
      };

      const itemA = extractInfo(a);
      const itemB = extractInfo(b);

      let valA = 0;
      let valB = 0;

      if (sortField === "skill") {
        const skA = getPlayerSkillInfo(itemA.id, itemA.nick, itemA.elo, undefined, itemA.hubStats);
        const skB = getPlayerSkillInfo(itemB.id, itemB.nick, itemB.elo, undefined, itemB.hubStats);
        valA = skA.score;
        valB = skB.score;
      } else if (sortField === "points") {
        valA = a.points ?? (a as any).score ?? 0;
        valB = b.points ?? (b as any).score ?? 0;
      } else if (sortField === "matches") {
        valA = a.played ?? (a as any).matches ?? (a as any).played_matches ?? 0;
        valB = b.played ?? (b as any).matches ?? (b as any).played_matches ?? 0;
      } else if (sortField === "winrate") {
        const wA = (a as any).win_rate !== undefined ? parseFloat(String((a as any).win_rate)) : (a.won && a.played ? (a.won / a.played) * 100 : 0);
        const wB = (b as any).win_rate !== undefined ? parseFloat(String((b as any).win_rate)) : (b.won && b.played ? (b.won / b.played) * 100 : 0);
        valA = isNaN(wA) ? 0 : wA;
        valB = isNaN(wB) ? 0 : wB;
      } else if (sortField === "kd") {
        valA = (a as any).hubStats?.kd ?? 0;
        valB = (b as any).hubStats?.kd ?? 0;
      } else if (sortField === "avg") {
        valA = (a as any).hubStats?.avgKills ?? 0;
        valB = (b as any).hubStats?.avgKills ?? 0;
      } else if (sortField === "adr") {
        valA = (a as any).hubStats?.adr ?? 0;
        valB = (b as any).hubStats?.adr ?? 0;
      } else if (sortField === "hs") {
        valA = (a as any).hubStats?.hsPct ?? 0;
        valB = (b as any).hubStats?.hsPct ?? 0;
      } else if (sortField === "hltv") {
        valA = (a as any).hubStats?.hltv ?? 0;
        valB = (b as any).hubStats?.hltv ?? 0;
      }

      if (valA === valB) return 0;
      return sortOrder === "desc" ? (valB - valA) : (valA - valB);
    });

  const filteredMatches = matches.filter((match) => {
    if (filterMatchStatus === "all") return true;
    if (filterMatchStatus === "ongoing") return match.status === "CHECK-IN" || match.status === "ONGOING" || match.status === "LIVE" || match.status === "READY";
    if (filterMatchStatus === "past") return match.status === "FINISHED" || match.status === "CANCELLED";
    return true;
  });

  // Normalize map name to match public/maps/ file names (e.g. Mirage -> de_mirage)
  const getMapFileName = (mapNameStr: string) => {
    if (!mapNameStr) return "default";
    const clean = mapNameStr.toLowerCase().trim();
    if (clean === "dust2" || clean === "dust 2") return "de_dust2";
    if (clean === "mirage") return "de_mirage";
    if (clean === "inferno") return "de_inferno";
    if (clean === "nuke") return "de_nuke";
    if (clean === "ancient") return "de_ancient";
    if (clean === "anubis") return "de_anubis";
    if (clean === "overpass") return "de_overpass";
    if (clean === "vertigo") return "de_vertigo";
    if (clean === "cache") return "de_cache";
    return clean;
  };
  const getMapImageUrl = (mapNameStr: string) => {
    const filename = getMapFileName(mapNameStr);
    const mapping: Record<string, string> = {
      de_dust2: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/7c17caa9-64a6-4496-8a0b-885e0f038d79_1695819126962.jpeg",
      de_mirage: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/7fb7d725-e44d-4e3c-b557-e1d19b260ab8_1695819144685.jpeg",
      de_nuke: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/7197a969-81e4-4fef-8764-55f46c7cec6e_1695819158849.jpeg",
      de_inferno: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/993380de-bb5b-4aa1-ada9-a0c1741dc475_1695819220797.jpeg",
      de_ancient: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/5b844241-5b15-45bf-a304-ad6df63b5ce5_1695819190976.jpeg",
      de_anubis: "https://assets.faceit-cdn.net/third_party/games/ce652bd4-0abb-4c90-9936-1133965ca38b/assets/votables/31f01daf-e531-43cf-b949-c094ebc9b3ea_1695819235255.jpeg",
      de_cache: "/maps/de_cache.webp"
    };
    return mapping[filename] || `/maps/${filename}.webp`;
  };
  const isCTSide = (team: any) => {
    if (!team) return false;
    const str = String(team).toUpperCase().trim();
    return str === "CT" || str === "3" || str === "COUNTER-TERRORIST" || str === "COUNTERTERRORIST";
  };

  const getWeaponIconUrl = (rawWeapon: string) => {
    if (!rawWeapon) return null;
    let w = rawWeapon.toLowerCase().trim().replace(/^weapon_/, "");
    if (w === "m4a1_s" || w === "m4a1-s") w = "m4a1_silencer";
    if (w === "usp_s" || w === "usp-s") w = "usp_silencer";
    if (w === "galil" || w === "galilar") w = "galilar";
    if (w === "scout") w = "ssg08";
    if (w === "sg553") w = "sg556";
    if (w === "cz75-auto") w = "cz75a";
    if (w === "incgrenade" || w === "molotov") w = "inferno";
    if (w.startsWith("knife") || w.startsWith("bayonet")) w = "knife";
    
    return `https://raw.githubusercontent.com/ChetdeJong/cs2-killfeed-generator/master/public/weapons/${w}.svg`;
  };

  const getInitial = (name: string) => {
    if (!name) return "";
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)",
      "linear-gradient(135deg, #1fa2ff 0%, #12d8fa 100%)",
      "linear-gradient(135deg, #f9d423 0%, #ff4e50 100%)",
      "linear-gradient(135deg, #b3ffab 0%, #12fff7 100%)",
      "linear-gradient(135deg, #8a2387 0%, #e94057 100%)"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  const getPlayerAvatar = (playerId: string) => {
    const member = members.find((m) => m.user_id === playerId);
    return member?.avatar || null;
  };

  // Level badge styling for Faceit Levels (1 to 10)
  const getLevelBadgeStyle = (level: number) => {
    const baseStyle = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "26px",
      height: "26px",
      borderRadius: "4px",
      fontWeight: "800",
      fontSize: "0.85rem",
      color: "#fff"
    };

    switch (level) {
      case 1: return { ...baseStyle, backgroundColor: "#EEEEEE", color: "#111" };
      case 2:
      case 3: return { ...baseStyle, backgroundColor: "#02E152" };
      case 4:
      case 5:
      case 6:
      case 7: return { ...baseStyle, backgroundColor: "#FFC800", color: "#111" };
      case 8:
      case 9: return { ...baseStyle, backgroundColor: "#FF5E00" };
      case 10: return {
        ...baseStyle,
        backgroundColor: "#FF0000",
        boxShadow: "0 0 10px rgba(255, 0, 0, 0.6)"
      };
      default: return { ...baseStyle, backgroundColor: "#555" };
    }
  };

  // If missing API Key, show setup instructions
  if (error === "API_KEY_MISSING") {
    return (
      <div className="container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <div className="glass-card animate-fade-in" style={{ maxWidth: "600px", width: "100%", padding: "2.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: "700", padding: "0.3rem 0.85rem", borderRadius: "6px", background: "rgba(255, 23, 68, 0.15)", border: "1px solid var(--danger)", color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Внимание</span>
            <h2 className="glow-text-purple" style={{ marginTop: "1rem", fontSize: "1.75rem" }}>Не настроен API Ключ FACEIT</h2>
            <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>Для отправки запросов к платформе FACEIT необходим API-ключ.</p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
              <h4 style={{ color: "#fff", marginBottom: "0.5rem" }}>Шаг 1: Получите ключ</h4>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                Зарегистрируйте аккаунт разработчика на портале{" "}
                <a href="https://developers.faceit.com/" target="_blank" rel="noreferrer" style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}>
                  FACEIT Developers
                </a>
                , создайте тестовое приложение и сгенерируйте <strong>Server-side API Key</strong>.
              </p>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
              <h4 style={{ color: "#fff", marginBottom: "0.5rem" }}>Шаг 2: Создайте файл настроек</h4>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                В корневой папке этого проекта (<code>d:\sigma-faceit</code>) создайте файл с именем <code>.env.local</code>.
              </p>
              <pre style={{
                fontFamily: "var(--font-mono)",
                background: "#08070d",
                padding: "0.75rem",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.05)",
                fontSize: "0.85rem",
                color: "var(--accent-cyan)"
              }}>
                FACEIT_API_KEY=ваш_секретный_ключ
              </pre>
            </div>

            <div style={{ background: "rgba(0,0,0,0.3)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--border-light)" }}>
              <h4 style={{ color: "#fff", marginBottom: "0.5rem" }}>Шаг 3: Перезапустите приложение</h4>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                Остановите сервер в консоли и запустите его снова, чтобы Next.js подтянул новые переменные окружения.
              </p>
            </div>

            <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ marginTop: "1rem" }}>
              Проверить готовность / Обновить
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      {/* HEADER SECTION */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
        marginBottom: "2.5rem",
        borderBottom: "1px solid var(--border-light)",
        paddingBottom: "1.5rem"
      }}>
        <div>
          <h1 className="glow-text-cyan" style={{ fontSize: "2rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{
              background: "linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: "900"
            }}>
              СИГМА КИБЕР КЛУБ
            </span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: "700" }}>
            Чем труднее битва - тем слаще победа
          </p>
        </div>

        {/* Centered Unified Header Navigation Buttons */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.65rem",
          flexWrap: "wrap",
          width: "100%",
          marginTop: "1rem"
        }}>
          <button 
            onClick={() => setShowDraftModal(true)}
            style={{
              height: "38px",
              padding: "0 1.1rem",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: "700",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0, 229, 255, 0.1)",
              border: "1px solid rgba(0, 229, 255, 0.4)",
              color: "#00e5ff",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              boxShadow: "0 0 12px rgba(0, 229, 255, 0.15)"
            }}
          >
            Captain's Draft
          </button>

          <button 
            onClick={() => { setTourStep(0); setShowTourModal(true); }}
            style={{
              height: "38px",
              padding: "0 1.1rem",
              borderRadius: "10px",
              fontSize: "0.82rem",
              fontWeight: "700",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border-light)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.2s ease-in-out"
            }}
          >
            О сервисе
          </button>

          {userRole === "ADMIN" && (
            <>
              <button 
                onClick={() => { setCsSubmitMsg(""); setShowCybershokeModal(true); }}
                style={{
                  height: "38px",
                  padding: "0 1.1rem",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: "700",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255, 145, 0, 0.12)",
                  border: "1px solid rgba(255, 145, 0, 0.5)",
                  color: "#ff9100",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out"
                }}
              >
                Добавить матч Cybershoke
              </button>
              <button 
                onClick={() => { 
                  setBatchSaveMsg(""); 
                  const initialPts: Record<string, string> = {};
                  const initialScore: Record<string, string> = {};
                  (rankings || []).forEach((item: any) => {
                    const nick = item.nickname || item.player?.nickname;
                    const pId = item.player_id || item.player?.player_id;
                    const ov = (pId && playerOverridesMap[pId]) || (nick && playerOverridesMap[nick]) || {};
                    if (nick) {
                      initialPts[nick] = ov.csRating !== undefined ? ov.csRating.toString() : "";
                      initialScore[nick] = ov.customSkillScore !== undefined ? ov.customSkillScore.toString() : "";
                    }
                  });
                  setBatchPtsMap(initialPts);
                  setBatchScoreMap(initialScore);
                  setShowBatchPtsModal(true); 
                }}
                style={{
                  height: "38px",
                  padding: "0 1.1rem",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: "700",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0, 229, 255, 0.12)",
                  border: "1px solid rgba(0, 229, 255, 0.5)",
                  color: "var(--accent-cyan)",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out"
                }}
              >
                Массовое редактирование PTS и Скилла
              </button>
            </>
          )}

          {userRole !== "GUEST" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ 
                height: "38px",
                padding: "0 1rem",
                borderRadius: "10px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: userRole === "EVENT_MAKER" ? "rgba(124, 77, 255, 0.2)" : "rgba(255, 145, 0, 0.2)", 
                border: userRole === "EVENT_MAKER" ? "1px solid #7c4dff" : "1px solid #ff9100",
                color: userRole === "EVENT_MAKER" ? "#b388ff" : "#ffb74d", 
                fontWeight: "700",
                fontSize: "0.82rem"
              }}>
                {userRole === "EVENT_MAKER" ? "EVENT MAKER: Mr.Chillout" : "ADMIN"}
              </span>

              {(userRole === "EVENT_MAKER" || userRole === "ADMIN") && (
                <button 
                  onClick={() => { setEventAnnMsg(""); setShowEventModal(true); }}
                  style={{
                    height: "38px",
                    padding: "0 1.1rem",
                    borderRadius: "10px",
                    fontSize: "0.82rem",
                    fontWeight: "700",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(124, 77, 255, 0.15)",
                    border: "1px solid #7c4dff",
                    color: "#b388ff",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out"
                  }}
                >
                  Добавить Event
                </button>
              )}

              <button 
                onClick={() => {
                  localStorage.removeItem("sigma_user_role");
                  localStorage.removeItem("sigma_user_name");
                  setUserRole("GUEST");
                  setUserName("");
                }}
                style={{
                  height: "38px",
                  padding: "0 1.1rem",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: "700",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255, 73, 73, 0.12)",
                  border: "1px solid rgba(255, 73, 73, 0.4)",
                  color: "#ff7b7b",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out"
                }}
              >
                Выйти
              </button>
            </div>
          ) : null}

          {/* STEAM OPENID AUTH / USER PROFILE WIDGET */}
          {currentUser ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-light)",
              padding: "0.2rem 0.6rem 0.2rem 0.4rem",
              borderRadius: "12px",
              height: "38px"
            }}>
              <img 
                src={currentUser.faceit?.avatar || currentUser.steamAvatar || "/default-avatar.png"} 
                alt="Avatar" 
                style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--accent-cyan)" }}
              />
              <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "#fff", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser.faceit?.nickname || currentUser.steamName}
              </span>

              {currentUser.faceit?.elo && (
                <span style={{
                  fontSize: "0.72rem",
                  fontWeight: "800",
                  padding: "0.15rem 0.45rem",
                  borderRadius: "6px",
                  background: "rgba(0, 229, 255, 0.15)",
                  color: "var(--accent-cyan)",
                  border: "1px solid rgba(0, 229, 255, 0.3)"
                }}>
                  {(currentUser.faceit?.playerId && playerEloMap[currentUser.faceit.playerId]) || (currentUser.faceit?.nickname && playerEloMap[currentUser.faceit.nickname.toLowerCase()]) || currentUser.faceit.elo} ELO
                </span>
              )}

              <button
                onClick={() => {
                  if (currentUser.faceit?.playerId) {
                    loadPlayerDetails(currentUser.faceit.playerId);
                  } else {
                    window.open(currentUser.profileUrl, "_blank");
                  }
                }}
                style={{
                  background: "rgba(0, 229, 255, 0.12)",
                  border: "1px solid var(--accent-cyan)",
                  color: "var(--accent-cyan)",
                  padding: "0.25rem 0.55rem",
                  borderRadius: "8px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Мой профиль
              </button>

              <button
                onClick={async () => {
                  await fetch("/api/auth/steam/logout", { method: "POST" });
                  setCurrentUser(null);
                }}
                title="Выйти из Steam"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  padding: "0 0.2rem",
                  marginLeft: "0.1rem"
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/steam/login"
              style={{
                height: "38px",
                padding: "0 1.1rem",
                borderRadius: "10px",
                fontSize: "0.82rem",
                fontWeight: "700",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                justifyContent: "center",
                background: "linear-gradient(135deg, rgba(23, 26, 33, 0.95), rgba(42, 71, 94, 0.8))",
                border: "1px solid #66c0f4",
                color: "#c7d5e0",
                textDecoration: "none",
                cursor: "pointer",
                boxShadow: "0 0 15px rgba(102, 192, 244, 0.2)",
                transition: "all 0.2s ease-in-out"
              }}
            >
              <img 
                src="/steam-logo.svg" 
                alt="Steam" 
                style={{ width: "20px", height: "20px", objectFit: "contain" }} 
              />
              Войти через Steam
            </a>
          )}
        </div>
      </header>

      {/* HUB SELECTION SCREEN / LOADER */}
      {isLoadingHub ? (
        <div style={{ textAlign: "center", padding: "5rem", maxWidth: "800px", margin: "4rem auto 0 auto" }} className="glass-card">
          <div className="glow-text-cyan animate-pulse" style={{ fontSize: "1.5rem", fontWeight: "700" }}>
            Загрузка хаба...
          </div>
          <div style={{ marginTop: "1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Пожалуйста, подождите, идет получение данных с FACEIT
          </div>
        </div>
      ) : !hubDetails ? (
        <div style={{ maxWidth: "800px", margin: "4rem auto 0 auto" }}>
          <div className="glass-card" style={{ padding: "2.5rem", textAlign: "center", marginBottom: "2rem" }}>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.5rem" }}>Просмотр статистики хаба</h2>
            <form onSubmit={handleSearchSubmit} className="search-form">
              <div className="input-group" style={{ textAlign: "left" }}>
                <label className="input-label" htmlFor="hub-id-input">ID Хаба FACEIT или URL ссылка</label>
                <input
                  id="hub-id-input"
                  type="text"
                  placeholder="Например: e1a5330e-5415-467b-b5d1-137a1c1d0fb9"
                  className="input-field"
                  value={hubIdInput}
                  onChange={(e) => setHubIdInput(e.target.value)}
                  style={{ fontSize: "1.05rem", padding: "0.85rem 1.25rem" }}
                  disabled={isLoadingHub}
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary search-form-btn" 
                disabled={isLoadingHub || !hubIdInput.trim()}
              >
                {isLoadingHub ? "Загрузка…" : "Получить статистику"}
              </button>
            </form>

            {error && (
              <div style={{
                marginTop: "1.5rem",
                padding: "1rem",
                borderRadius: "10px",
                backgroundColor: "rgba(255, 23, 68, 0.1)",
                border: "1px solid rgba(255, 23, 68, 0.3)",
                color: "var(--danger)",
                textAlign: "left",
                fontSize: "0.95rem"
              }}>
                <strong>Ошибка:</strong> {error}
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Убедитесь, что ID хаба правильный, и ваш API ключ FACEIT настроен корректно.
                </p>
              </div>
            )}

            <div style={{ marginTop: "2rem", borderTop: "1px solid var(--border-light)", paddingTop: "1.5rem", textAlign: "left" }}>
              <h4 style={{ color: "#fff", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Где найти ID хаба?</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                Откройте страницу хаба на сайте FACEIT. Его URL-адрес выглядит как: <br />
                <code style={{ color: "var(--accent-cyan)" }}>
                  https://www.faceit.com/ru/hub/<strong>[ID_ХАБА]</strong>/название-хаба
                </code>
                <br />
                Скопируйте длинный код (UUID) или вставьте ссылку полностью в форму выше.
              </p>
            </div>
          </div>

          {/* Quick selects */}
          <div>
            <h3 style={{ fontSize: "0.92rem", marginBottom: "1rem", color: "var(--text-secondary)" }}>Быстрый выбор для тестирования:</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              {POPULAR_HUBS.map((hub) => (
                <div 
                  key={hub.id} 
                  className="glass-card" 
                  style={{ cursor: "pointer", padding: "1.25rem" }}
                  onClick={() => {
                    setHubIdInput(hub.id);
                    setHubId(hub.id);
                  }}
                >
                  <h4 style={{ color: "var(--accent-cyan)", marginBottom: "0.25rem" }}>{hub.name}</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{hub.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* HUB DASHBOARD VIEW */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* ACTIVE EVENT ANNOUNCEMENT BANNER */}
          {eventAnnouncement && (
            <div className="glass-card animate-fade-in" style={{
              width: "100%",
              padding: "1.25rem 2rem",
              borderRadius: "20px",
              background: "linear-gradient(135deg, rgba(124, 77, 255, 0.18), rgba(0, 229, 255, 0.18))",
              border: "1.5px solid rgba(0, 229, 255, 0.4)",
              boxShadow: "0 0 35px rgba(0, 229, 255, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                <div style={{
                  fontSize: "1.5rem",
                  background: "rgba(124, 77, 255, 0.25)",
                  padding: "0.5rem 0.8rem",
                  borderRadius: "16px",
                  border: "1px solid rgba(124, 77, 255, 0.5)",
                  boxShadow: "0 0 20px rgba(124, 77, 255, 0.3)"
                }}>
                  🔪
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: "800",
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: "#00e5ff",
                      background: "rgba(0, 229, 255, 0.15)",
                      padding: "0.2rem 0.65rem",
                      borderRadius: "6px",
                      border: "1px solid rgba(0, 229, 255, 0.4)"
                    }}>
                      АКТИВНЫЙ EVENT СИГМА ХАБА
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Опубликовал {eventAnnouncement.author || "Администратор"}
                    </span>
                  </div>
                  <div style={{ fontSize: "1.15rem", fontWeight: "700", color: "#fff", lineHeight: "1.3" }}>
                    {eventAnnouncement.text}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                {eventAnnouncement.prize && (
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    background: "rgba(124, 77, 255, 0.2)",
                    border: "1px solid rgba(179, 136, 255, 0.5)",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "14px",
                    boxShadow: "0 0 20px rgba(124, 77, 255, 0.2)"
                  }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: "700", letterSpacing: "0.04em", lineHeight: "1", display: "inline-flex", alignItems: "center" }}>
                      НАГРАДА / ПРИЗ:
                    </span>
                    <span style={{ fontSize: "0.95rem", fontWeight: "900", color: "#b388ff", lineHeight: "1", display: "inline-flex", alignItems: "center" }}>
                      {eventAnnouncement.prize}
                    </span>
                  </div>
                )}

                {(userRole === "ADMIN" || userRole === "EVENT_MAKER") && (
                  <button
                    onClick={async () => {
                      if (confirm("Вы точно хотите удалить этот Event?")) {
                        const passcode = userRole === "EVENT_MAKER" ? "chillout" : "demon323161";
                        await fetch(`/api/events/announcement?passcode=${passcode}`, { method: "DELETE" });
                        setEventAnnouncement(null);
                      }
                    }}
                    style={{
                      background: "rgba(255, 73, 73, 0.15)",
                      border: "1px solid rgba(255, 73, 73, 0.4)",
                      color: "#ff4949",
                      borderRadius: "12px",
                      padding: "0.6rem 1rem",
                      fontSize: "0.82rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    🗑 Удалить Event
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Hub Profile Banner / Card */}
          <div className="glass-card" style={{
            padding: "1.5rem 2rem",
            overflow: "hidden",
            position: "relative"
          }}>

            {/* Profile info section */}
            <div style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1.5rem"
            }}>
              {/* Avatar image */}
              <div style={{
                width: "110px",
                height: "110px",
                borderRadius: "16px",
                overflow: "hidden",
                border: "4px solid #0f0d1a",
                background: "#08070d",
                boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
                position: "relative"
              }}>
                <img src="/sigma-logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>

              {/* Title & Desc */}
              <div style={{ flex: "1", minWidth: "250px", paddingBottom: "0.25rem" }}>
                <h2 style={{ fontSize: "1.85rem", color: "#fff", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {hubDetails.name}
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.5rem", lineHeight: "1.4", maxWidth: "800px" }}>
                  {hubDetails.description || "FACEIT HUB"}
                </p>
              </div>

              {/* Tournament countdown widget (Option 2) */}
              {fantasyTour?.startTime && (
                <div 
                  onClick={() => setActiveTab("fantasy")}
                  style={{
                    background: "linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(255, 145, 0, 0.03) 100%)",
                    border: "1px solid rgba(255, 215, 0, 0.35)",
                    borderRadius: "12px",
                    padding: "0.75rem 1.35rem",
                    textAlign: "center",
                    minWidth: "160px",
                    cursor: "pointer",
                    boxShadow: "0 0 25px rgba(255, 215, 0, 0.12)",
                    transition: "all 0.2s ease",
                    userSelect: "none"
                  }}
                  title="Нажмите, чтобы перейти в Fantasy League"
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem" }}>
                    <span style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#ffd700",
                      boxShadow: "0 0 8px #ffd700",
                      display: "inline-block"
                    }} />
                    <span style={{ fontSize: "0.72rem", color: "#ffd700", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.05em" }}>
                      {fantasyTour.status === "LIVE" ? "ТУРНИР" : "ДО ТУРНИРА"}
                    </span>
                  </div>
                  <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#fff", marginTop: "0.15rem", letterSpacing: "0.02em" }}>
                    {(() => {
                      const diff = new Date(fantasyTour.startTime).getTime() - Date.now();
                      if (diff <= 0) return fantasyTour.status === "LIVE" ? "ИДЕТ СЕЙЧАС" : "СКОРО СТАРТ";
                      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                      const mins = Math.floor((diff / (1000 * 60)) % 60);
                      return `${days > 0 ? `${days}д ` : ''}${hours}ч ${mins}м`;
                    })()}
                  </div>
                </div>
              )}

              {/* Members stats widget */}
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border-light)",
                borderRadius: "12px",
                padding: "0.75rem 1.25rem",
                textAlign: "center",
                minWidth: "150px"
              }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Участников хаба
                </span>
                <div style={{ fontSize: "1.75rem", fontWeight: "700", color: "var(--accent-cyan)", marginTop: "0.15rem" }}>
                  {Math.max(hubDetails?.players_number ?? 0, members.length).toLocaleString("ru-RU")}
                </div>
              </div>
            </div>
          </div>

          {/* MAIN PANELS: TABS & CONTENTS */}
          <div style={{ width: "100%" }}>

            {/* Main Tabs content */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
              
              {/* Tab headers */}
              <div className="tabs-container">
                <button 
                  className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('leaderboard')}
                >
                  Список игроков
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                  onClick={() => setActiveTab('matches')}
                >
                  История игр
                </button>
                {/* Hidden tab: Участники */}
                {/* 
                <button 
                  className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
                  onClick={() => setActiveTab('members')}
                >
                  Участники ({members.length})
                </button>
                */}
                <button 
                  className={`tab-btn ${activeTab === 'tournaments' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tournaments')}
                >
                  Турниры ({tournaments.length || "…"})
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
                  onClick={() => setActiveTab('compare')}
                >
                  Сравнение игроков
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'fantasy' ? 'active' : ''}`}
                  onClick={() => setActiveTab('fantasy')}
                  style={{
                    borderColor: activeTab === 'fantasy' ? '#b388ff' : undefined,
                    color: activeTab === 'fantasy' ? '#b388ff' : undefined
                  }}
                >
                  Fantasy League
                </button>
              </div>



              {/* TAB CONTENT: LEADERBOARD */}
              {activeTab === 'leaderboard' && (
                <div className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  {/* Search and Filters */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", flex: 1 }}>
                      <div className="input-group" style={{ maxWidth: "280px" }}>
                        <input
                          type="text"
                          placeholder="Поиск игрока по никнейму…"
                          className="input-field"
                          value={playerSearchQuery}
                          onChange={(e) => setPlayerSearchQuery(e.target.value)}
                        />
                      </div>

                      {/* Filter by Min Matches */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.25rem 0.5rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "600", whiteSpace: "nowrap" }}>Матчи:</span>
                        {[0, 3, 5, 10, 20].map((m) => (
                          <button
                            key={m}
                            onClick={() => setMinMatchesFilter(m)}
                            style={{
                              background: minMatchesFilter === m ? "linear-gradient(135deg, #7c3aed, #06b6d4)" : "transparent",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.2rem 0.55rem",
                              color: minMatchesFilter === m ? "#fff" : "var(--text-secondary)",
                              fontSize: "0.75rem",
                              fontWeight: minMatchesFilter === m ? "700" : "500",
                              cursor: "pointer",
                              transition: "all 0.15s"
                            }}
                          >
                            {m === 0 ? "Все" : `${m}+`}
                          </button>
                        ))}
                      </div>

                      {/* Reset sort button */}
                      {sortField !== "default" && (
                        <button
                          onClick={() => { setSortField("default"); setSortOrder("desc"); }}
                          style={{
                            background: "rgba(168, 85, 247, 0.15)",
                            border: "1px solid rgba(168, 85, 247, 0.4)",
                            borderRadius: "6px",
                            padding: "0.3rem 0.65rem",
                            color: "#c084fc",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          Сбросить ✕
                        </button>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        Показано: {filteredRankings.length}
                      </div>
                    </div>
                  </div>

                  {/* Leaderboard Table */}
                  {isLoadingRankings ? (
                    <div style={{ textAlign: "center", padding: "3rem" }}>
                      <div className="glow-text-cyan" style={{ fontSize: "1.2rem", animation: "pulse 1.5s infinite" }}>Загрузка таблицы лидеров...</div>
                    </div>
                  ) : filteredRankings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", borderRadius: "12px" }}>
                      Игроки не найдены.
                    </div>
                  ) : (
                    <div className="custom-table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th style={{ width: "50px", textAlign: "center", whiteSpace: "nowrap" }}>#</th>
                            <th style={{ whiteSpace: "nowrap" }}>Игрок</th>
                            <th
                              onClick={() => handleSort("skill")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "skill" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по скиллу"
                            >
                              Скилл {sortField === "skill" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th
                              onClick={() => handleSort("points")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "points" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по очкам"
                            >
                              Очки {sortField === "points" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th
                              onClick={() => handleSort("matches")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "matches" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по матчам"
                            >
                              Матчи {sortField === "matches" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>В / П</th>
                            <th
                              onClick={() => handleSort("kd")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "kd" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по K/D"
                            >
                              K/D {sortField === "kd" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th
                              onClick={() => handleSort("avg")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "avg" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по AVG Kills"
                            >
                              AVG {sortField === "avg" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th
                              onClick={() => handleSort("adr")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "adr" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по ADR"
                            >
                              ADR {sortField === "adr" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th
                              onClick={() => handleSort("hs")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "hs" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по % Headshots"
                            >
                              HS% {sortField === "hs" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th
                              onClick={() => handleSort("hltv")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "hltv" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по HLTV 2.0 Rating"
                            >
                              HLTV 2.0 {sortField === "hltv" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th
                              onClick={() => handleSort("winrate")}
                              style={{ textAlign: "center", cursor: "pointer", userSelect: "none", color: sortField === "winrate" ? "var(--accent-cyan)" : undefined, whiteSpace: "nowrap" }}
                              title="Нажмите для сортировки по Win Rate"
                            >
                              Win Rate {sortField === "winrate" ? (sortOrder === "desc" ? "▼" : "▲") : "⇅"}
                            </th>
                            <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Стрик</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRankings.map((item, idx) => {
                            const playerInfo = (item.player || (item as any).user) as any;
                            const playerId = playerInfo?.player_id || playerInfo?.user_id || playerInfo?.id || "";
                            const nickname = playerInfo?.nickname || "Игрок";
                            const avatar = playerInfo?.avatar || "";
                            const country = playerInfo?.country || "";
                            const winRate = (item.played && item.played > 0) ? ((item.won / item.played) * 100).toFixed(1) : null;
                            const played = item.played ?? "-";
                            const won = item.won ?? "-";
                            const lost = item.lost ?? "-";
                            const points = item.points ?? (item as any).elo ?? "-";
                            const currentStreak = item.current_streak;
                            const displayRank = idx + 1;

                            return (
                              <tr key={playerId || idx}>
                                <td style={{ textAlign: "center", fontWeight: "700", color: displayRank <= 3 ? "var(--accent-cyan)" : "var(--text-primary)" }}>
                                  {displayRank === 1 && <span className="rank-badge gold">1</span>}
                                  {displayRank === 2 && <span className="rank-badge silver">2</span>}
                                  {displayRank === 3 && <span className="rank-badge bronze">3</span>}
                                  {displayRank > 3 && displayRank}
                                </td>
                                <td>
                                  <div 
                                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}
                                    onClick={() => playerId && loadPlayerDetails(playerId)}
                                  >
                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", overflow: "hidden", background: "#1c1829", border: "1px solid var(--border-light)" }}>
                                      {avatar ? (
                                        <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      ) : (
                                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)" }}>
                                          {nickname.substring(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <span style={{ fontWeight: "600", color: "var(--accent-cyan)" }} className="hover-underline">
                                      {nickname}
                                    </span>
                                    {country && (
                                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        [{country.toUpperCase()}]
                                      </span>
                                    )}
                                    {/* Mini Achievement Badges */}
                                    {(() => {
                                      const st = (item as any).hubStats;
                                      if (!st) return null;
                                      const badges = [];
                                      if (st.hsPct >= 55) badges.push({ text: "HS", color: "#ff4b4b", bg: "rgba(255,75,75,0.15)", border: "rgba(255,75,75,0.35)", title: `Охотник за головами: ${st.hsPct}%` });
                                      if (st.hltv >= 1.20) badges.push({ text: "CARRY", color: "#00e5ff", bg: "rgba(0,229,255,0.15)", border: "rgba(0,229,255,0.35)", title: `Самый ценный игрок: ${st.hltv} HLTV` });
                                      if (st.streak >= 5) badges.push({ text: `${st.streak}W`, color: "#00e676", bg: "rgba(0,230,118,0.15)", border: "rgba(0,230,118,0.35)", title: `Победитель по жизни: ${st.streak} побед подряд` });
                                      if (st.kd >= 1.30) badges.push({ text: "K/D", color: "#ff9100", bg: "rgba(255,145,0,0.15)", border: "rgba(255,145,0,0.35)", title: `Серийный убийца: ${st.kd} KD` });
                                      if (badges.length === 0) return null;
                                      return (
                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginLeft: "0.25rem" }}>
                                          {badges.slice(0, 2).map((b, bi) => (
                                            <span
                                              key={bi}
                                              title={b.title}
                                              style={{
                                                fontSize: "0.62rem",
                                                fontWeight: "800",
                                                padding: "0.08rem 0.35rem",
                                                borderRadius: "4px",
                                                color: b.color,
                                                background: b.bg,
                                                border: `1px solid ${b.border}`,
                                                letterSpacing: "0.03em"
                                              }}
                                            >
                                              {b.text}
                                            </span>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  {(() => {
                                    const sk = getPlayerSkillInfo(
                                      playerId,
                                      nickname,
                                      (item.player as any)?.faceit_elo || (item as any).elo || (item.player as any)?.elo,
                                      undefined,
                                      (item as any).hubStats
                                    );
                                    const wRecord = (playerId && weeklySkillMap[playerId]) || 
                                                    (nickname && weeklySkillMap[nickname.toLowerCase()]) || 
                                                    (nickname && weeklySkillMap[nickname]);
                                    const delta = wRecord?.weeklyDelta;
                                    return (
                                      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                                        <span 
                                          className="badge" 
                                          style={{ 
                                            fontSize: "0.78rem", 
                                            fontWeight: "800", 
                                            background: sk.bg, 
                                            border: `1px solid ${sk.border}`, 
                                            color: sk.color,
                                            padding: "0.25rem 0.6rem",
                                            borderRadius: "6px"
                                          }}
                                          title={`Рейтинг скилла (Пересчет каждую неделю)\nCS2 Premier: ${(sk?.csRating ?? 0).toLocaleString('ru-RU')}${delta !== undefined && delta !== 0 ? `\nДинамика за неделю: ${delta > 0 ? `+${delta}` : delta} очков` : ''}`}
                                        >
                                          {sk.score} / 100
                                        </span>
                                        {delta !== undefined && delta !== 0 && (
                                          <span 
                                            style={{
                                              fontSize: "0.68rem",
                                              fontWeight: "800",
                                              color: delta > 0 ? "var(--success)" : "var(--danger)",
                                              background: delta > 0 ? "rgba(0, 230, 118, 0.14)" : "rgba(255, 77, 77, 0.14)",
                                              padding: "0.15rem 0.35rem",
                                              borderRadius: "4px",
                                              border: `1px solid ${delta > 0 ? "rgba(0, 230, 118, 0.35)" : "rgba(255, 77, 77, 0.35)"}`,
                                              lineHeight: 1
                                            }}
                                            title={`Изменение за неделю: ${delta > 0 ? `+${delta}` : delta} очков`}
                                          >
                                            {delta > 0 ? `▲+${delta}` : `▼${delta}`}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td style={{ textAlign: "center", fontWeight: "700", color: "#fff" }}>
                                  {points}
                                </td>
                                <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                                  {played}
                                </td>
                                <td style={{ textAlign: "center", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                                  {item.played !== undefined ? (
                                    <>
                                      <span style={{ color: "var(--success)" }}>{won}</span>
                                      <span style={{ color: "var(--text-muted)" }}> / </span>
                                      <span style={{ color: "var(--danger)" }}>{lost}</span>
                                    </>
                                  ) : (
                                    <span style={{ color: "var(--text-muted)" }}>-</span>
                                  )}
                                </td>

                                {/* K/D */}
                                <td style={{ textAlign: "center", fontWeight: "700" }}>
                                  {(item as any).hubStats?.kd !== undefined ? (
                                    <span style={{ color: (item as any).hubStats.kd >= 1.0 ? "#4caf50" : "#f44336" }}>
                                      {(item as any).hubStats.kd.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--text-muted)" }}>—</span>
                                  )}
                                </td>

                                {/* AVG */}
                                <td style={{ textAlign: "center", color: "#e0e0e0", fontWeight: "600", fontSize: "0.88rem" }}>
                                  {(item as any).hubStats?.avgKills !== undefined ? (item as any).hubStats.avgKills.toFixed(1) : "—"}
                                </td>

                                {/* ADR */}
                                <td style={{ textAlign: "center", color: "var(--text-secondary)", fontWeight: "600", fontSize: "0.88rem" }}>
                                  {(item as any).hubStats?.adr !== undefined ? (item as any).hubStats.adr.toFixed(1) : "—"}
                                </td>

                                {/* HS% */}
                                <td style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                  {(item as any).hubStats?.hsPct !== undefined ? `${(item as any).hubStats.hsPct}%` : "—"}
                                </td>

                                {/* HLTV 2.0 Rating */}
                                <td style={{ textAlign: "center" }}>
                                  {(item as any).hubStats?.hltv !== undefined ? (
                                    <span 
                                      style={{
                                        fontSize: "0.82rem",
                                        fontWeight: "800",
                                        padding: "0.2rem 0.5rem",
                                        borderRadius: "6px",
                                        background: (item as any).hubStats.hltv >= 1.20 
                                          ? "rgba(255, 215, 0, 0.15)" 
                                          : (item as any).hubStats.hltv >= 1.05 
                                          ? "rgba(76, 175, 80, 0.15)" 
                                          : (item as any).hubStats.hltv >= 0.95 
                                          ? "rgba(0, 229, 255, 0.15)" 
                                          : "rgba(255, 255, 255, 0.05)",
                                        border: (item as any).hubStats.hltv >= 1.20 
                                          ? "1px solid rgba(255, 215, 0, 0.4)" 
                                          : (item as any).hubStats.hltv >= 1.05 
                                          ? "1px solid rgba(76, 175, 80, 0.4)" 
                                          : (item as any).hubStats.hltv >= 0.95 
                                          ? "1px solid rgba(0, 229, 255, 0.4)" 
                                          : "1px solid var(--border-light)",
                                        color: (item as any).hubStats.hltv >= 1.20 
                                          ? "#ffd700" 
                                          : (item as any).hubStats.hltv >= 1.05 
                                          ? "#4caf50" 
                                          : (item as any).hubStats.hltv >= 0.95 
                                          ? "#00e5ff" 
                                          : "var(--text-muted)"
                                      }}
                                    >
                                      {(item as any).hubStats.hltv.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--text-muted)" }}>—</span>
                                  )}
                                </td>

                                <td style={{ textAlign: "center", fontWeight: "600" }}>
                                  {winRate ? (
                                    <span className={parseFloat(winRate) >= 55 ? "badge badge-success" : parseFloat(winRate) < 48 ? "badge badge-danger" : "badge badge-warning"}>
                                      {winRate}%
                                    </span>
                                  ) : (
                                    <span style={{ color: "var(--text-muted)" }}>-</span>
                                  )}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  {currentStreak !== undefined ? (
                                    currentStreak > 0 ? (
                                      <span style={{ color: "var(--success)", fontWeight: "600" }}>+{currentStreak}</span>
                                    ) : currentStreak < 0 ? (
                                      <span style={{ color: "var(--danger)" }}>{currentStreak}</span>
                                    ) : (
                                      <span style={{ color: "var(--text-muted)" }}>0</span>
                                    )
                                  ) : (
                                    <span style={{ color: "var(--text-muted)" }}>0</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )}

              {/* TAB CONTENT: MATCHES */}
              {activeTab === 'matches' && (
                <div className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  {/* Filters Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button 
                        className={`btn ${filterMatchStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", borderRadius: "8px" }}
                        onClick={() => setFilterMatchStatus('all')}
                      >
                        Все матчи
                      </button>
                      <button 
                        className={`btn ${filterMatchStatus === 'ongoing' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", borderRadius: "8px", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                        onClick={() => setFilterMatchStatus('ongoing')}
                      >
                        <span className="live-dot" style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--danger)", borderRadius: "50%" }}></span>
                        В процессе
                      </button>
                      <button 
                        className={`btn ${filterMatchStatus === 'past' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", borderRadius: "8px" }}
                        onClick={() => setFilterMatchStatus('past')}
                      >
                        Завершенные
                      </button>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.8rem", borderRadius: "8px" }} onClick={fetchMatches}>
                      Обновить
                    </button>
                  </div>

                  {/* FACEIT DOWNTIME NOTICE BANNER (AUTO-EXPIRES IN 2 WEEKS: AUG 19 2026) */}
                  {Date.now() < new Date('2026-08-19T23:59:59Z').getTime() && (
                    <div style={{
                      background: "rgba(255, 145, 0, 0.1)",
                      border: "1px solid rgba(255, 145, 0, 0.35)",
                      borderRadius: "12px",
                      padding: "0.85rem 1.25rem",
                      color: "#ffb74d",
                      fontSize: "0.88rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem"
                    }}>
                      <span style={{ fontWeight: "700", color: "#ff9100", fontSize: "0.95rem" }}>Информация:</span>
                      <span>
                        Данные по прошедшему турниру неполные, так как на платформе FACEIT произошли технические неполадки. Недостающие матчи сведены вручную с Cybershoke.
                      </span>
                    </div>
                  )}

                  {isLoadingMatches ? (
                    <div style={{ textAlign: "center", padding: "3rem" }}>
                      <div className="glow-text-cyan" style={{ fontSize: "1.2rem" }}>Загрузка истории матчей...</div>
                    </div>
                  ) : filteredMatches.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", borderRadius: "12px" }}>
                      Матчи в данной категории отсутствуют.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
                      {filteredMatches.map((match) => {
                        const isFinished = match.status === "FINISHED";
                        const isLive = match.status === "ONGOING" || match.status === "LIVE";
                        const isCustom = (match as any).source === "Cybershoke" || match.match_id.startsWith("cs_");
                        const mapName = match.voting?.map?.entities?.[0]?.name || "Голосование...";
                        const matchDate = new Date(match.finished_at ? match.finished_at * 1000 : match.started_at * 1000).toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        });
                        const matchMaps = match.maps || [mapName];

                        return (
                          <div 
                            key={match.match_id} 
                            className="glass-card" 
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "1.25rem 1.5rem",
                              borderRadius: "16px",
                              border: isCustom ? "1.5px solid rgba(255, 145, 0, 0.4)" : "1px solid var(--border-light)",
                              position: "relative",
                              overflow: "hidden",
                              boxShadow: isCustom ? "0 0 25px rgba(255, 145, 0, 0.15)" : "none",
                              gap: "1.5rem",
                              flexWrap: "wrap"
                            }}
                          >
                            {/* Card Map Background */}
                            <div style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              pointerEvents: "none",
                              zIndex: 1
                            }}>
                              {matchMaps.length > 1 ? (
                                <>
                                  <div style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "55%",
                                    height: "100%",
                                    background: `url(${getMapImageUrl(matchMaps[0])}) center/cover no-repeat`,
                                    clipPath: "polygon(0 0, 100% 0, 80% 100%, 0 100%)"
                                  }} />
                                  <div style={{
                                    position: "absolute",
                                    top: 0,
                                    right: 0,
                                    width: "55%",
                                    height: "100%",
                                    background: `url(${getMapImageUrl(matchMaps[1])}) center/cover no-repeat`,
                                    clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0 100%)"
                                  }} />
                                  <div style={{
                                    position: "absolute",
                                    top: 0,
                                    bottom: 0,
                                    width: "3px",
                                    background: "linear-gradient(to bottom, #00e5ff, #7c4dff)",
                                    left: "50%",
                                    transform: "translateX(-50%) skewX(-4deg)",
                                    zIndex: 1
                                  }} />
                                </>
                              ) : (
                                <div style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  height: "100%",
                                  background: `url(${getMapImageUrl(matchMaps[0])}) center/cover no-repeat, var(--bg-card)`
                                }} />
                              )}
                              {/* Dark Overlay */}
                              <div style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: "linear-gradient(rgba(10, 7, 18, 0.88), rgba(10, 7, 18, 0.95))",
                                zIndex: 2
                              }} />
                            </div>

                            {/* Match state & game info */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", position: "relative", zIndex: 3 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {isFinished ? (
                                  <span className="badge badge-success">Завершен</span>
                                ) : isLive ? (
                                  <span className="badge badge-info animate-pulse" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                    <span style={{ display: "inline-block", width: "6px", height: "6px", background: "#fff", borderRadius: "50%" }} />
                                    В эфире
                                  </span>
                                ) : (
                                  <span className="badge badge-danger">{match.status}</span>
                                )}
                                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{matchDate}</span>
                              </div>
                              <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: "500", marginTop: "0.25rem" }}>
                                {matchMaps.length > 1 ? "Карты: " : "Карта: "}
                                <strong style={{ color: "var(--accent-cyan)" }}>
                                  {matchMaps.map((m: string) => getMapFileName(m).replace("de_", "").toUpperCase()).join(" и ")}
                                </strong>
                              </span>
                            </div>

                            {/* Teams scores layout */}
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1.5rem",
                              background: "rgba(0,0,0,0.2)",
                              padding: "0.5rem 1.5rem",
                              borderRadius: "10px",
                              border: "1px solid var(--border-light)",
                              position: "relative",
                              zIndex: 3
                            }}>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem" }}>{match.teams.faction1.name}</div>
                              </div>
                              
                              <div style={{
                                fontSize: "1.35rem",
                                fontWeight: "800",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                color: isFinished ? "#fff" : "var(--accent-cyan)"
                              }}>
                                <span>{match.results?.score?.faction1 ?? match.teams.faction1.score ?? "-"}</span>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>:</span>
                                <span>{match.results?.score?.faction2 ?? match.teams.faction2.score ?? "-"}</span>
                              </div>

                              <div style={{ textAlign: "left" }}>
                                <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem" }}>{match.teams.faction2.name}</div>
                              </div>
                            </div>

                            {/* Actions button */}
                            <div style={{ position: "relative", zIndex: 3 }}>
                              {isFinished ? (
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", borderRadius: "8px" }}
                                  onClick={() => loadMatchDetails(match.match_id)}
                                >
                                  Статистика матча
                                </button>
                              ) : (
                                <a 
                                  href={`https://www.faceit.com/ru/championship/${match.match_id}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="btn btn-glow-cyan"
                                  style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", borderRadius: "8px" }}
                                >
                                  Комната матча
                                </a>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

              {/* TAB CONTENT: MEMBERS */}
              {activeTab === 'members' && (
                <div className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <h3 style={{ fontSize: "0.92rem", color: "#fff", marginBottom: "0.5rem" }}>
                    Участники клуба ({members.length})
                  </h3>
                  
                  {members.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", borderRadius: "12px" }}>
                      Список участников пуст.
                    </div>
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: "1rem"
                    }}>
                      {members.map((member) => {
                        const isOwner = member.roles?.includes("owner");
                        const isAdmin = member.roles?.includes("admin") || member.roles?.includes("moderator");
                        
                        return (
                          <div 
                            key={member.user_id} 
                            className="glass-card" 
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                              padding: "1rem",
                              background: "rgba(255, 255, 255, 0.01)",
                              border: isOwner ? "1px solid rgba(255, 213, 79, 0.3)" : isAdmin ? "1px solid rgba(0, 242, 254, 0.3)" : "1px solid var(--border-light)"
                            }}
                          >
                            <div style={{ width: "42px", height: "42px", borderRadius: "50%", overflow: "hidden", background: "#1c1829", border: "1px solid var(--border-light)" }}>
                              {member.avatar ? (
                                <img src={member.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", fontWeight: "700", color: "var(--text-muted)" }}>
                                  {member.nickname.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", overflow: "hidden" }}>
                              <span 
                                style={{ fontWeight: "600", color: isOwner ? "#ffd54f" : "#fff", cursor: "pointer", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}
                                className="hover-underline"
                                onClick={() => loadPlayerDetails(member.user_id)}
                                title={member.nickname}
                              >
                                {member.nickname}
                              </span>
                              <div style={{ display: "flex", gap: "0.25rem" }}>
                                {member.nickname === "XZiBiTuM" ? (
                                  <span className="badge" style={{ fontSize: "0.6rem", padding: "0.05rem 0.35rem", background: "rgba(0, 229, 255, 0.15)", border: "1px solid var(--accent-cyan)", color: "var(--accent-cyan)", fontWeight: "800" }}>Разработчик</span>
                                ) : (
                                  <>
                                    {isOwner && <span className="badge badge-warning" style={{ fontSize: "0.6rem", padding: "0.05rem 0.3rem" }}>Создатель</span>}
                                    {isAdmin && <span className="badge badge-info" style={{ fontSize: "0.6rem", padding: "0.05rem 0.3rem" }}>Админ</span>}
                                    {!isOwner && !isAdmin && <span className="badge" style={{ fontSize: "0.6rem", padding: "0.05rem 0.3rem", background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>Игрок</span>}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: TOURNAMENTS */}
              {activeTab === 'tournaments' && (
                <div className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <h3 style={{ fontSize: "1.25rem", color: "#fff" }}>
                        Турнирная статистика хаба
                      </h3>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        Турниры автоматически выявляются как связки по 6 завершенных матчей
                      </p>
                    </div>

                    {/* Tournament Selector Dropdown */}
                    {tournaments.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Выбрать турнир:</span>
                        <select 
                          value={selectedTournamentId} 
                          onChange={(e) => setSelectedTournamentId(e.target.value)}
                          className="input-field"
                          style={{
                            padding: "0.5rem 1rem",
                            fontSize: "0.9rem",
                            borderRadius: "8px",
                            background: "var(--bg-primary)",
                            border: "1px solid var(--border-light)",
                            color: "#fff",
                            cursor: "pointer",
                            width: "auto"
                          }}
                        >
                          {tournaments.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.startDate} - {t.endDate})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {isLoadingTournaments ? (
                    <div style={{ textAlign: "center", padding: "5rem" }}>
                      <div className="glow-text-cyan animate-pulse" style={{ fontSize: "1.25rem" }}>
                        Анализ матчей и расчет турнирной статистики...
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                        Это может занять несколько секунд при первом запуске (кэширование данных)
                      </p>
                    </div>
                  ) : tournaments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", borderRadius: "12px" }}>
                      Не удалось загрузить данные турниров.
                    </div>
                  ) : (() => {
                    const currentTournament = tournaments.find(t => t.id === selectedTournamentId) || tournaments[0];
                    if (!currentTournament) return null;

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                        
                        {/* Tournament Summary Widgets */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                          
                          {/* Tournament MVP Widget */}
                          {currentTournament.mvp && (() => {
                            const mvpAvatar = getPlayerAvatar(currentTournament.mvp.playerId);
                            return (
                              <div className="glass-card" style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "1.5rem",
                                border: "1px solid rgba(255, 198, 25, 0.25)",
                                padding: "1.5rem",
                                position: "relative",
                                overflow: "hidden",
                                borderRadius: "12px"
                              }}>
                                <div style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "4px",
                                  height: "100%",
                                  background: "linear-gradient(to bottom, var(--accent-yellow), var(--accent-purple))"
                                }} />

                                {/* Avatar */}
                                <div style={{
                                  width: "72px",
                                  height: "72px",
                                  borderRadius: "50%",
                                  background: getAvatarColor(currentTournament.mvp.nickname),
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "1.5rem",
                                  fontWeight: "800",
                                  color: "#fff",
                                  border: "2px solid var(--accent-yellow)",
                                  boxShadow: "0 0 12px rgba(255, 198, 25, 0.15)",
                                  overflow: "hidden",
                                  flexShrink: 0
                                }}>
                                  {mvpAvatar ? (
                                    <img src={mvpAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : (
                                    getInitial(currentTournament.mvp.nickname)
                                  )}
                                </div>

                                <div>
                                  <span style={{
                                    background: "linear-gradient(90deg, #ffe082, #ffb300)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    fontWeight: "900",
                                    fontSize: "0.8rem",
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase"
                                  }}>
                                    ★ MVP ТУРНИРА
                                  </span>
                                  <div 
                                    style={{ fontSize: "1.35rem", fontWeight: "800", color: "#fff", marginTop: "0.15rem", cursor: "pointer" }} 
                                    className="hover-underline"
                                    onClick={() => loadPlayerDetails(currentTournament.mvp.playerId)}
                                  >
                                    {currentTournament.mvp.nickname}
                                  </div>
                                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                                    K/D: <strong style={{ color: "var(--accent-cyan)" }}>{currentTournament.mvp.avgKd}</strong> &nbsp;|&nbsp;
                                    Winrate: <strong style={{ color: "var(--success)" }}>{currentTournament.mvp.winRate}%</strong> &nbsp;|&nbsp;
                                    Матчи: <strong>{currentTournament.mvp.played}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Tournament Popular Map Widget */}
                          {(() => {
                            const mapNameClean = (currentTournament.popularMap || "").replace("de_", "").toUpperCase();
                            const bgFileName = getMapFileName(currentTournament.popularMap || "de_mirage");

                            return (
                              <div className="glass-card" style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "1.5rem",
                                padding: "1.5rem",
                                position: "relative",
                                overflow: "hidden",
                                borderRadius: "12px",
                                background: `linear-gradient(to right, rgba(13, 12, 16, 0.95) 45%, rgba(13, 12, 16, 0.5) 100%), url(/maps/${bgFileName}.webp) center/cover no-repeat`,
                                border: "1px solid var(--border-light)"
                              }}>
                                <div style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "4px",
                                  height: "100%",
                                  background: "linear-gradient(to bottom, var(--accent-purple), var(--accent-cyan))"
                                }} />

                                <div>
                                  <span style={{
                                    background: "linear-gradient(90deg, #c084fc, #818cf8)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    fontWeight: "900",
                                    fontSize: "0.8rem",
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase"
                                  }}>
                                     САМАЯ ПОПУЛЯРНАЯ КАРТА
                                  </span>
                                  <div style={{ fontSize: "1.35rem", fontWeight: "800", color: "#fff", marginTop: "0.15rem" }}>
                                    {mapNameClean}
                                  </div>
                                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                                    Сыграна: <strong>{currentTournament.maxMapCount}</strong> раз(а) &nbsp;|&nbsp; Всего матчей: <strong>{currentTournament.matchesCount}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                        </div>

                        {/* Tournament Leaderboard Table */}
                        <div>
                          <h4 style={{ fontSize: "0.92rem", color: "#fff", marginBottom: "1rem" }}>
                            Рейтинг участников турнира
                          </h4>
                          <div className="custom-table-container">
                            <table className="custom-table">
                              <thead>
                                <tr>
                                  <th style={{ width: "60px", textAlign: "center" }}>Место</th>
                                  <th>Игрок</th>
                                  <th style={{ textAlign: "center" }}>K/D</th>
                                  <th style={{ textAlign: "center" }}>Winrate</th>
                                  <th style={{ textAlign: "center" }}>Игр</th>
                                  <th style={{ textAlign: "center" }}>W/L</th>
                                  <th style={{ textAlign: "center" }}>Убийства (К)</th>
                                  <th style={{ textAlign: "center" }}>Смерти (D)</th>
                                  <th style={{ textAlign: "center" }}>Ассисты (A)</th>
                                  <th style={{ textAlign: "center" }}>MVP</th>
                                </tr>
                              </thead>
                              <tbody>
                                {currentTournament.players.map((p: any, index: number) => {
                                  const kdVal = parseFloat(p.avgKd);
                                  return (
                                    <tr key={p.playerId} style={{ background: index === 0 ? "rgba(255, 198, 25, 0.03)" : "none" }}>
                                      <td style={{ textAlign: "center", fontWeight: "700" }}>
                                        {index === 0 ? <span className="rank-badge gold">1</span> : index === 1 ? <span className="rank-badge silver">2</span> : index === 2 ? <span className="rank-badge bronze">3</span> : index + 1}
                                      </td>
                                      <td>
                                        <span 
                                          style={{ fontWeight: "600", color: index === 0 ? "var(--accent-cyan)" : "#fff", cursor: "pointer" }}
                                          className="hover-underline"
                                          onClick={() => loadPlayerDetails(p.playerId)}
                                        >
                                          {p.nickname}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: "center", fontWeight: "700" }}>
                                        <span style={{ color: kdVal >= 1.2 ? "var(--success)" : kdVal < 0.95 ? "var(--danger)" : "var(--text-primary)" }}>
                                          {p.avgKd}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: "center", fontWeight: "600", color: "var(--success)" }}>
                                        {p.winRate}%
                                      </td>
                                      <td style={{ textAlign: "center" }}>{p.played}</td>
                                      <td style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                        {p.wins} / {p.losses}
                                      </td>
                                      <td style={{ textAlign: "center" }}>{p.kills}</td>
                                      <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.deaths}</td>
                                      <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.assists}</td>
                                      <td style={{ textAlign: "center", color: "var(--warning)", fontWeight: "600" }}>{p.mvps}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Tournament Matches */}
                        <div>
                          <h4 style={{ fontSize: "0.92rem", color: "#fff", marginBottom: "1rem" }}>
                            Сыгранные матчи ({currentTournament.matchesCount})
                          </h4>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.75rem" }}>
                            {currentTournament.matches.map((m: any) => {
                              const tMatchMaps = m.maps || [m.map];
                              return (
                                <div 
                                  key={m.match_id} 
                                  className="glass-card" 
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "1rem 1.25rem",
                                    border: "1px solid var(--border-light)",
                                    fontSize: "0.88rem",
                                    position: "relative",
                                    overflow: "hidden"
                                  }}
                                >
                                  {/* Dynamic Maps Background */}
                                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: "hidden", borderRadius: "inherit" }}>
                                    {tMatchMaps.length > 1 ? (
                                      <>
                                        <div style={{
                                          position: "absolute",
                                          top: 0,
                                          left: 0,
                                          width: "100%",
                                          height: "100%",
                                          background: `url(${getMapImageUrl(tMatchMaps[0])}) center/cover no-repeat, var(--bg-card)`,
                                          clipPath: "polygon(0 0, 52% 0, 48% 100%, 0 100%)"
                                        }} />
                                        <div style={{
                                          position: "absolute",
                                          top: 0,
                                          left: 0,
                                          width: "100%",
                                          height: "100%",
                                          background: `url(/maps/${getMapFileName(tMatchMaps[1])}.webp) center/cover no-repeat, var(--bg-card)`,
                                          clipPath: "polygon(52% 0, 100% 0, 100% 100%, 48% 100%)"
                                        }} />
                                        <div style={{
                                          position: "absolute",
                                          top: 0,
                                          bottom: 0,
                                          background: "rgba(255, 198, 25, 0.4)",
                                          width: "1.5px",
                                          left: "50%",
                                          transform: "translateX(-50%) skewX(-4deg)",
                                          zIndex: 1
                                        }} />
                                      </>
                                    ) : (
                                      <div style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        height: "100%",
                                        background: `url(/maps/${getMapFileName(tMatchMaps[0])}.webp) center/cover no-repeat, var(--bg-card)`
                                      }} />
                                    )}
                                    {/* Dark Overlay */}
                                    <div style={{
                                      position: "absolute",
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      background: "linear-gradient(rgba(10, 7, 18, 0.88), rgba(10, 7, 18, 0.95))",
                                      zIndex: 2
                                    }} />
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", position: "relative", zIndex: 3 }}>
                                    <span style={{ fontWeight: "700", color: "#fff" }}>{m.teams.faction1.name}</span>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                      {tMatchMaps.length > 1 ? "Карты: " : "Карта: "}
                                      {tMatchMaps.map((mapNameStr: string) => getMapFileName(mapNameStr).replace("de_", "").toUpperCase()).join(" и ")}
                                    </span>
                                  </div>

                                  <div style={{
                                    fontSize: "1.15rem",
                                    fontWeight: "800",
                                    background: "rgba(0,0,0,0.15)",
                                    padding: "0.25rem 0.75rem",
                                    borderRadius: "6px",
                                    color: "var(--accent-cyan)",
                                    position: "relative",
                                    zIndex: 3
                                  }}>
                                    {m.teams.faction1.score} : {m.teams.faction2.score}
                                  </div>

                                  <div style={{ textAlign: "right", position: "relative", zIndex: 3 }}>
                                    <span style={{ fontWeight: "700", color: "#fff" }}>{m.teams.faction2.name}</span>
                                    <button 
                                      className="hover-underline" 
                                      style={{
                                        background: "none",
                                        border: "none",
                                        color: "var(--text-secondary)",
                                        fontSize: "0.72rem",
                                        cursor: "pointer",
                                        marginTop: "0.2rem",
                                        display: "block",
                                        width: "100%",
                                        textAlign: "right"
                                      }}
                                      onClick={() => loadMatchDetails(m.match_id)}
                                    >
                                      Статистика
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB CONTENT: COMPARE */}

              {/* TAB CONTENT: FANTASY LEAGUE */}
              {activeTab === 'fantasy' && (() => {
                const tourStatus = fantasyTour?.status || "DRAFT_OPEN";
                const isDraftOpen = tourStatus === "DRAFT_OPEN";
                const winnerNick = fantasyTour?.winnerNickname || "";

                // Calculate countdown
                let countdownStr = "Скоро старт";
                if (fantasyTour?.startTime) {
                  const diff = new Date(fantasyTour.startTime).getTime() - Date.now();
                  if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                    const mins = Math.floor((diff / (1000 * 60)) % 60);
                    countdownStr = `${days}д ${hours}ч ${mins}м до старта`;
                  } else {
                    countdownStr = "Турнир начался";
                  }
                }

                // Available hub players with robust ID extraction
                const allPlayersList = [...(rankings || [])].map((item: any) => {
                  const p = item.player || item.user || item;
                  const pId = p.player_id || p.user_id || p.id || p.nickname || item.player_id || item.user_id || item.nickname || "";
                  const nick = p.nickname || item.nickname || "Player";
                  const ov = (pId && playerOverridesMap[pId]) || (nick && playerOverridesMap[nick]) || (nick.toLowerCase() && playerOverridesMap[nick.toLowerCase()]) || {};
                  const skill = ov.customSkillScore || 50;
                  const avatar = p.avatar || item.avatar || "";
                  return { playerId: pId, nickname: nick, skillScore: skill, avatar };
                }).filter(p => p.playerId && p.nickname !== "Player").sort((a, b) => a.nickname.localeCompare(b.nickname));

                const handleSaveFantasyPick = async () => {
                  if (!currentUser) {
                    window.location.href = "/api/auth/steam/login";
                    return;
                  }
                  if (!draftSniper || !draftSupport || !draftDarkHorse) {
                    setFantasySaveMsg("Пожалуйста, выберите игроков для всех 3 ролей!");
                    return;
                  }
                  if (draftSniper.playerId === draftSupport.playerId || 
                      draftSniper.playerId === draftDarkHorse.playerId || 
                      draftSupport.playerId === draftDarkHorse.playerId) {
                    setFantasySaveMsg("Нельзя выбирать одного и того же игрока на несколько ролей!");
                    return;
                  }

                  setIsSavingFantasy(true);
                  setFantasySaveMsg("");
                  try {
                    const res = await fetch("/api/fantasy/picks", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userId: currentUser.steamId,
                        userName: currentUser.steamName,
                        avatar: currentUser.steamAvatar || currentUser.faceit?.avatar,
                        faceitNickname: currentUser.faceit?.nickname,
                        sniper: draftSniper,
                        support: draftSupport,
                        darkHorse: draftDarkHorse
                      })
                    });
                    const d = await res.json();
                    if (res.ok) {
                      setFantasySaveMsg("Ваш состав на Fantasy League успешно сохранен!");
                      setUserFantasyPick(d.pick);
                      // Refresh leaderboard
                      fetch("/api/fantasy/leaderboard")
                        .then(r => r.json())
                        .then(ld => { if (ld?.leaderboard) setFantasyLeaderboard(ld.leaderboard); });
                    } else {
                      setFantasySaveMsg(d.error || "Ошибка сохранения состава");
                    }
                  } catch (e: any) {
                    setFantasySaveMsg(`Ошибка сети: ${e.message}`);
                  } finally {
                    setIsSavingFantasy(false);
                  }
                };

                const darkMultiplier = draftDarkHorse 
                  ? (1.0 + ((100 - Math.min(100, Math.max(10, draftDarkHorse.skillScore || 50))) / 100) * 0.40).toFixed(2)
                  : "1.20";

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2rem", width: "100%" }}>
                    
                    {/* FANTASY HERO BANNER */}
                    <div className="glass-card animate-fade-in" style={{
                      padding: "2rem 2.5rem",
                      borderRadius: "24px",
                      background: "linear-gradient(135deg, rgba(124, 77, 255, 0.15) 0%, rgba(0, 229, 255, 0.08) 50%, rgba(6, 5, 12, 0.95) 100%)",
                      border: "1.5px solid rgba(179, 136, 255, 0.4)",
                      boxShadow: "0 0 50px rgba(124, 77, 255, 0.15)",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1.5rem"
                    }}>
                      <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.8rem", borderRadius: "20px", background: "rgba(179, 136, 255, 0.2)", border: "1px solid #b388ff", color: "#d1c4e9", fontSize: "0.78rem", fontWeight: "800", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                          SIGMA FANTASY LEAGUE
                        </div>
                        <h2 className="glow-text-purple" style={{ fontSize: "1.85rem", fontWeight: "900", margin: "0 0 0.5rem 0", color: "#fff" }}>
                          {fantasyTour?.title || "Sigma Cup: Season 3"}
                        </h2>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0, maxWidth: "600px", lineHeight: "1.5" }}>
                          Собери свою команду из 3 ролей на турнир. Победитель фентези получает статус <strong style={{ color: "#ffd700" }}>«Фантазер»</strong> и золотую рамку на сайте.
                        </p>
                      </div>

                      <div style={{
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "18px",
                        padding: "1rem 1.5rem",
                        textAlign: "center",
                        minWidth: "200px"
                      }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700", marginBottom: "0.35rem" }}>
                          Статус драфта
                        </div>
                        <div style={{
                          fontSize: "0.95rem",
                          fontWeight: "800",
                          color: tourStatus === "DRAFT_OPEN" ? "#00e5ff" : tourStatus === "LIVE" ? "#ffb74d" : "#ff5252",
                          marginBottom: "0.5rem"
                        }}>
                          {tourStatus === "DRAFT_OPEN" ? "СБОР СОСТАВОВ ОТКРЫТ" : tourStatus === "LIVE" ? "ТУРНИР В ПРОЦЕССЕ" : "ТУРНИР ЗАВЕРШЕН"}
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "#fff", background: "rgba(255, 255, 255, 0.06)", padding: "0.3rem 0.6rem", borderRadius: "8px", fontWeight: "600" }}>
                          {countdownStr}
                        </div>
                      </div>
                    </div>

                    {/* CURRENT CHAMPION (IF ANY) */}
                    {winnerNick && (
                      <div className="glass-card" style={{
                        padding: "1.25rem 2rem",
                        borderRadius: "18px",
                        background: "linear-gradient(135deg, rgba(255, 215, 0, 0.12) 0%, rgba(12, 10, 23, 0.95) 100%)",
                        border: "1.5px solid rgba(255, 215, 0, 0.5)",
                        boxShadow: "0 0 30px rgba(255, 215, 0, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        gap: "1.25rem"
                      }}>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#ffd700", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Текущий Чемпион Fantasy League
                          </div>
                          <div style={{ fontSize: "1.3rem", fontWeight: "900", color: "#fff", display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.2rem" }}>
                            {winnerNick}
                            <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "10px", background: "linear-gradient(135deg, #ffd700, #ff9100)", color: "#000", fontWeight: "900" }}>
                              ФАНТАЗЕР
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DRAFT PICKING SECTION */}
                    <div className="glass-card" style={{ padding: "2rem", borderRadius: "24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                        <div>
                          <h3 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#fff", margin: "0 0 0.3rem 0" }}>
                            Твой состав на турнир (3 слота)
                          </h3>
                          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                            Выбери по одному игроку на каждую роль. Очки начисляются автоматически по итогам матчей.
                          </p>
                        </div>

                        {!currentUser && (
                          <a
                            href="/api/auth/steam/login"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.6rem 1.25rem",
                              borderRadius: "12px",
                              background: "linear-gradient(135deg, #171a21, #2a475e)",
                              border: "1px solid #66c0f4",
                              color: "#fff",
                              fontWeight: "700",
                              fontSize: "0.85rem",
                              textDecoration: "none",
                              boxShadow: "0 0 20px rgba(102, 192, 244, 0.25)"
                            }}
                          >
                            <img src="/steam-logo.svg" alt="" style={{ width: "18px", height: "18px" }} />
                            Войти через Steam для участия
                          </a>
                        )}
                      </div>

                      {/* 3 CYBER ROLE CARDS */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "1.5rem",
                        marginBottom: "2rem"
                      }}>
                        
                        {/* SLOT 1: SNIPER */}
                        <div style={{
                          background: "rgba(255, 73, 73, 0.04)",
                          border: draftSniper ? "1.5px solid #ff5252" : "1px solid rgba(255, 73, 73, 0.3)",
                          borderRadius: "18px",
                          padding: "1.5rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                          boxShadow: draftSniper ? "0 0 25px rgba(255, 82, 82, 0.15)" : "none",
                          transition: "all 0.2s ease"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#ff7b7b" }}>Снайпер</div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Фраги (+2.5), Entry (+2.0), HS (+1.0)</div>
                            </div>
                            <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "0.2rem 0.5rem", borderRadius: "6px", background: "rgba(255, 82, 82, 0.15)", color: "#ff8a80" }}>
                              СЛОТ 1
                            </span>
                          </div>

                          {/* Player selector */}
                          <div>
                            <select
                              value={draftSniper?.nickname || draftSniper?.playerId || ""}
                              onChange={e => {
                                const val = e.target.value;
                                const found = allPlayersList.find(p => p.nickname === val || p.playerId === val);
                                setDraftSniper(found || null);
                              }}
                              disabled={!isDraftOpen}
                              style={{
                                width: "100%",
                                padding: "0.75rem 1rem",
                                borderRadius: "12px",
                                background: "#06050c",
                                border: "1px solid rgba(255, 82, 82, 0.4)",
                                color: "#fff",
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                cursor: isDraftOpen ? "pointer" : "not-allowed"
                              }}
                            >
                              <option value="">-- Выбери Снайпера --</option>
                              {allPlayersList.map(p => {
                                const isUsedInOtherSlot = (draftSupport && (draftSupport.nickname === p.nickname || draftSupport.playerId === p.playerId)) ||
                                                          (draftDarkHorse && (draftDarkHorse.nickname === p.nickname || draftDarkHorse.playerId === p.playerId));
                                return (
                                  <option key={p.playerId || p.nickname} value={p.nickname} disabled={isUsedInOtherSlot}>
                                    {p.nickname} (Скилл: {p.skillScore})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {draftSniper && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "0.6rem 0.8rem", borderRadius: "12px" }}>
                              {draftSniper.avatar ? (
                                <img src={draftSniper.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                              ) : (
                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255, 82, 82, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "700", color: "#ff8a80" }}>
                                  {draftSniper.nickname?.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>{draftSniper.nickname}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Скилл: <strong style={{ color: "#ff7b7b" }}>{draftSniper.skillScore}</strong></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* SLOT 2: SUPPORT */}
                        <div style={{
                          background: "rgba(0, 229, 255, 0.04)",
                          border: draftSupport ? "1.5px solid var(--accent-cyan)" : "1px solid rgba(0, 229, 255, 0.3)",
                          borderRadius: "18px",
                          padding: "1.5rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                          boxShadow: draftSupport ? "0 0 25px rgba(0, 229, 255, 0.15)" : "none",
                          transition: "all 0.2s ease"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--accent-cyan)" }}>Саппорт</div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Ассисты (+3.0), Гранаты / Флешки (+0.5), Дефьюз (+2.5)</div>
                            </div>
                            <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "0.2rem 0.5rem", borderRadius: "6px", background: "rgba(0, 229, 255, 0.15)", color: "var(--accent-cyan)" }}>
                              СЛОТ 2
                            </span>
                          </div>

                          {/* Player selector */}
                          <div>
                            <select
                              value={draftSupport?.nickname || draftSupport?.playerId || ""}
                              onChange={e => {
                                const val = e.target.value;
                                const found = allPlayersList.find(p => p.nickname === val || p.playerId === val);
                                setDraftSupport(found || null);
                              }}
                              disabled={!isDraftOpen}
                              style={{
                                width: "100%",
                                padding: "0.75rem 1rem",
                                borderRadius: "12px",
                                background: "#06050c",
                                border: "1px solid rgba(0, 229, 255, 0.4)",
                                color: "#fff",
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                cursor: isDraftOpen ? "pointer" : "not-allowed"
                              }}
                            >
                              <option value="">-- Выбери Саппорта --</option>
                              {allPlayersList.map(p => {
                                const isUsedInOtherSlot = (draftSniper && (draftSniper.nickname === p.nickname || draftSniper.playerId === p.playerId)) ||
                                                          (draftDarkHorse && (draftDarkHorse.nickname === p.nickname || draftDarkHorse.playerId === p.playerId));
                                return (
                                  <option key={p.playerId || p.nickname} value={p.nickname} disabled={isUsedInOtherSlot}>
                                    {p.nickname} (Скилл: {p.skillScore})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {draftSupport && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "0.6rem 0.8rem", borderRadius: "12px" }}>
                              {draftSupport.avatar ? (
                                <img src={draftSupport.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                              ) : (
                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(0, 229, 255, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "700", color: "var(--accent-cyan)" }}>
                                  {draftSupport.nickname?.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>{draftSupport.nickname}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Скилл: <strong style={{ color: "var(--accent-cyan)" }}>{draftSupport.skillScore}</strong></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* SLOT 3: DARK HORSE */}
                        <div style={{
                          background: "rgba(255, 215, 0, 0.04)",
                          border: draftDarkHorse ? "1.5px solid #ffd700" : "1px solid rgba(255, 215, 0, 0.3)",
                          borderRadius: "18px",
                          padding: "1.5rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                          boxShadow: draftDarkHorse ? "0 0 25px rgba(255, 215, 0, 0.15)" : "none",
                          transition: "all 0.2s ease"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#ffd700" }}>Темная лошадка</div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Динамический множитель очков</div>
                            </div>
                            <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "0.2rem 0.5rem", borderRadius: "6px", background: "rgba(255, 215, 0, 0.15)", color: "#ffd700" }}>
                              БОНУС x{darkMultiplier}
                            </span>
                          </div>

                          {/* Player selector */}
                          <div>
                            <select
                              value={draftDarkHorse?.nickname || draftDarkHorse?.playerId || ""}
                              onChange={e => {
                                const val = e.target.value;
                                const found = allPlayersList.find(p => p.nickname === val || p.playerId === val);
                                setDraftDarkHorse(found || null);
                              }}
                              disabled={!isDraftOpen}
                              style={{
                                width: "100%",
                                padding: "0.75rem 1rem",
                                borderRadius: "12px",
                                background: "#06050c",
                                border: "1px solid rgba(255, 215, 0, 0.4)",
                                color: "#fff",
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                cursor: isDraftOpen ? "pointer" : "not-allowed"
                              }}
                            >
                              <option value="">-- Выбери Темную лошадку --</option>
                              {allPlayersList.map(p => {
                                const isUsedInOtherSlot = (draftSniper && (draftSniper.nickname === p.nickname || draftSniper.playerId === p.playerId)) ||
                                                          (draftSupport && (draftSupport.nickname === p.nickname || draftSupport.playerId === p.playerId));
                                const mult = (1.0 + ((100 - Math.min(100, Math.max(10, p.skillScore || 50))) / 100) * 0.40).toFixed(2);
                                return (
                                  <option key={p.playerId || p.nickname} value={p.nickname} disabled={isUsedInOtherSlot}>
                                    {p.nickname} (Скилл: {p.skillScore} ➔ БОНУС x{mult})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {draftDarkHorse && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(0,0,0,0.3)", padding: "0.6rem 0.8rem", borderRadius: "12px" }}>
                              {draftDarkHorse.avatar ? (
                                <img src={draftDarkHorse.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                              ) : (
                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255, 215, 0, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "700", color: "#ffd700" }}>
                                  {draftDarkHorse.nickname?.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#fff" }}>{draftDarkHorse.nickname}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Скилл: <strong style={{ color: "#ffd700" }}>{draftDarkHorse.skillScore}</strong></div>
                              </div>
                              <span style={{ fontSize: "0.78rem", fontWeight: "900", color: "#000", background: "#ffd700", padding: "0.2rem 0.5rem", borderRadius: "8px" }}>
                                x{darkMultiplier}
                              </span>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* SAVE ACTION & NOTIFICATION */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                        <div>
                          {fantasySaveMsg && (
                            <div style={{ fontSize: "0.9rem", fontWeight: "700", color: fantasySaveMsg.includes("успешно") ? "#00e5ff" : "#ff5252" }}>
                              {fantasySaveMsg}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleSaveFantasyPick}
                          disabled={isSavingFantasy || !isDraftOpen}
                          style={{
                            padding: "0.85rem 2rem",
                            borderRadius: "14px",
                            background: isDraftOpen ? "linear-gradient(135deg, #b388ff, #00e5ff)" : "rgba(255,255,255,0.1)",
                            border: "none",
                            color: isDraftOpen ? "#000" : "var(--text-muted)",
                            fontSize: "0.95rem",
                            fontWeight: "800",
                            cursor: isDraftOpen ? "pointer" : "not-allowed",
                            boxShadow: isDraftOpen ? "0 0 25px rgba(179, 136, 255, 0.4)" : "none",
                            transition: "all 0.2s ease"
                          }}
                        >
                          {isSavingFantasy ? "Сохранение..." : isDraftOpen ? "Сохранить состав на турнир" : "Сбор составов закрыт"}
                        </button>
                      </div>
                    </div>

                    {/* FANTASY LEAGUE LEADERBOARD */}
                    <div className="glass-card" style={{ padding: "2rem", borderRadius: "24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                        <div>
                          <h3 style={{ fontSize: "1.35rem", fontWeight: "800", color: "#fff", margin: "0 0 0.3rem 0" }}>
                            Таблица лидеров Fantasy League
                          </h3>
                          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                            Рейтинг участников и набранные очки за текущий турнир
                          </p>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "0.3rem 0.8rem", borderRadius: "10px" }}>
                          Участников: {fantasyLeaderboard.length}
                        </span>
                      </div>

                      {fantasyLeaderboard.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", border: "1px dashed var(--border-light)", borderRadius: "16px" }}>
                          Пока никто не сохранил свой прогноз. Стань первым!
                        </div>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)", fontSize: "0.8rem", textTransform: "uppercase" }}>
                                <th style={{ padding: "0.75rem 1rem" }}>#</th>
                                <th style={{ padding: "0.75rem 1rem" }}>Участник</th>
                                <th style={{ padding: "0.75rem 1rem" }}>Снайпер</th>
                                <th style={{ padding: "0.75rem 1rem" }}>Саппорт</th>
                                <th style={{ padding: "0.75rem 1rem" }}>Темная лошадка</th>
                                <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Всего очков</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fantasyLeaderboard.map((item: any, idx: number) => {
                                const isFirst = idx === 0;
                                return (
                                  <tr
                                    key={item.userId || idx}
                                    style={{
                                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                                      background: isFirst ? "rgba(255, 215, 0, 0.05)" : "transparent"
                                    }}
                                  >
                                    <td style={{ padding: "1rem", fontWeight: "900", color: isFirst ? "#ffd700" : "var(--text-muted)" }}>
                                      {idx + 1}
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <img src={item.avatar} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%", border: isFirst ? "2px solid #ffd700" : "1px solid var(--border-light)" }} />
                                        <div>
                                          <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.92rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                            {item.userName}
                                            {item.totalPoints > 0 && tourStatus !== "DRAFT_OPEN" && isFirst ? (
                                              <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", borderRadius: "6px", background: "#ffd700", color: "#000", fontWeight: "900" }}>
                                                TOP 1
                                              </span>
                                            ) : (
                                              <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", borderRadius: "6px", background: "rgba(0, 229, 255, 0.15)", color: "var(--accent-cyan)", fontWeight: "700" }}>
                                                ГОТОВ
                                              </span>
                                            )}
                                          </div>
                                          {item.faceitNickname && (
                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>FACEIT: {item.faceitNickname}</div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                      <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#ff8a80" }}>{item.sniper?.nickname || "—"}</div>
                                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.sniper?.points} pts</div>
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                      <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--accent-cyan)" }}>{item.support?.nickname || "—"}</div>
                                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.support?.points} pts</div>
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                      <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#ffd700", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        {item.darkHorse?.nickname || "—"}
                                        <span style={{ fontSize: "0.68rem", background: "rgba(255,215,0,0.2)", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                                          x{item.darkHorse?.multiplier}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.darkHorse?.points} pts</div>
                                    </td>
                                    <td style={{ padding: "1rem", textAlign: "right" }}>
                                      <span style={{ fontSize: "1.15rem", fontWeight: "900", color: isFirst ? "#ffd700" : "var(--accent-cyan)" }}>
                                        {item.totalPoints}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}
              
{activeTab === 'compare' && (() => {
                const DEFAULT_AVATAR = "https://assets.faceit-cdn.net/avatars/default_avatar.jpg";
                const getItemId = (r: any) => r.player?.player_id || r.player?.user_id || r.user?.player_id || r.user?.user_id || r.player_id || r.user_id || "";
                const getItemNick = (r: any) => r.player?.nickname || r.user?.nickname || r.nickname || "";
                const getItemAvatar = (r: any) => r.player?.avatar || r.user?.avatar || r.avatar || DEFAULT_AVATAR;
                const p1 = rankings.find((r: any) => getItemId(r) === comparePlayer1Id);
                const p2 = rankings.find((r: any) => getItemId(r) === comparePlayer2Id);
                const sk1 = p1 ? getPlayerSkillInfo(getItemId(p1), getItemNick(p1)) : null;
                const sk2 = p2 ? getPlayerSkillInfo(getItemId(p2), getItemNick(p2)) : null;

                const filteredPlayers1 = (rankings as any[]).filter(r => {
                  const nick = getItemNick(r).toLowerCase();
                  return getItemId(r) !== comparePlayer2Id && nick.includes(compareSearchQuery1.toLowerCase());
                });
                const filteredPlayers2 = (rankings as any[]).filter(r => {
                  const nick = getItemNick(r).toLowerCase();
                  return getItemId(r) !== comparePlayer1Id && nick.includes(compareSearchQuery2.toLowerCase());
                });

                const statRow = (label: string, val1: React.ReactNode, val2: React.ReactNode, higherIsBetter = true) => {
                  const n1 = typeof val1 === 'number' ? val1 : parseFloat(String(val1));
                  const n2 = typeof val2 === 'number' ? val2 : parseFloat(String(val2));
                  const p1Wins = !isNaN(n1) && !isNaN(n2) && (higherIsBetter ? n1 > n2 : n1 < n2);
                  const p2Wins = !isNaN(n1) && !isNaN(n2) && (higherIsBetter ? n2 > n1 : n2 < n1);
                  return (
                    <tr key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "0.7rem 1rem", color: p1Wins ? "#4ade80" : p2Wins ? "var(--text-secondary)" : "var(--text-primary)", fontWeight: p1Wins ? "700" : "500", textAlign: "right", fontSize: "0.9rem" }}>
                        {val1 ?? "—"}
                        {p1Wins && <span style={{ marginLeft: "0.35rem", color: "#4ade80" }}>◀</span>}
                      </td>
                      <td style={{ padding: "0.7rem 0.5rem", color: "var(--text-muted)", fontSize: "0.78rem", textAlign: "center", whiteSpace: "nowrap", fontWeight: "600" }}>{label}</td>
                      <td style={{ padding: "0.7rem 1rem", color: p2Wins ? "#4ade80" : p1Wins ? "var(--text-secondary)" : "var(--text-primary)", fontWeight: p2Wins ? "700" : "500", textAlign: "left", fontSize: "0.9rem" }}>
                        {p2Wins && <span style={{ marginRight: "0.35rem", color: "#4ade80" }}>▶</span>}
                        {val2 ?? "—"}
                      </td>
                    </tr>
                  );
                };

                return (
                  <div className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div>
                      <h3 style={{ fontSize: "1.2rem", color: "#fff", marginBottom: "0.25rem" }}>Сравнение игроков</h3>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Выбери двух игроков из таблицы лидеров хаба — сравним их по ключевым показателям</p>
                    </div>

                    {/* Player selectors */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1.5rem", alignItems: "start" }}>
                      {/* Player 1 selector */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Игрок 1</div>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Поиск по нику…"
                          value={compareSearchQuery1}
                          onChange={e => setCompareSearchQuery1(e.target.value)}
                          style={{ fontSize: "0.85rem" }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "250px", overflowY: "auto" }}>
                          {filteredPlayers1.map(r => (
                            <button
                              key={getItemId(r)}
                              onClick={() => { setComparePlayer1Id(getItemId(r)); setCompareSearchQuery1(""); }}
                              style={{
                                display: "flex", alignItems: "center", gap: "0.6rem",
                                background: comparePlayer1Id === getItemId(r) ? "rgba(0, 229, 255, 0.12)" : "rgba(255,255,255,0.03)",
                                border: comparePlayer1Id === getItemId(r) ? "1px solid rgba(0,229,255,0.4)" : "1px solid transparent",
                                borderRadius: "8px", padding: "0.45rem 0.75rem",
                                cursor: "pointer", textAlign: "left"
                              }}
                            >
                              <img src={getItemAvatar(r)} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                              <span style={{ fontSize: "0.85rem", color: comparePlayer1Id === getItemId(r) ? "var(--accent-cyan)" : "var(--text-primary)", fontWeight: "600" }}>{getItemNick(r)}</span>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>#{r.position}</span>
                            </button>
                          ))}
                        </div>
                        {p1 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.25)", borderRadius: "12px", padding: "0.75rem 1rem" }}>
                            {getItemAvatar(p1) && <img src={getItemAvatar(p1)} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(0,229,255,0.4)" }} />}
                            <div>
                              <div style={{ fontWeight: "700", fontSize: "0.85rem", color: "#fff" }}>{getItemNick(p1)}</div>
                              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>#{p1.position} в хабе</div>
                            </div>
                            {sk1 && <span style={{ marginLeft: "auto", background: sk1.bg, color: sk1.color, border: `1px solid ${sk1.border}`, borderRadius: "6px", padding: "0.2rem 0.55rem", fontSize: "0.8rem", fontWeight: "700", boxShadow: sk1.glow || undefined }}>{sk1.score}/100</span>}
                          </div>
                        )}
                      </div>

                      {/* VS divider */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "3rem" }}>
                        <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "var(--text-muted)", letterSpacing: "0.1em", opacity: 0.5 }}>VS</div>
                      </div>

                      {/* Player 2 selector */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Игрок 2</div>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Поиск по нику…"
                          value={compareSearchQuery2}
                          onChange={e => setCompareSearchQuery2(e.target.value)}
                          style={{ fontSize: "0.85rem" }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "250px", overflowY: "auto" }}>
                          {filteredPlayers2.map(r => (
                            <button
                              key={getItemId(r)}
                              onClick={() => { setComparePlayer2Id(getItemId(r)); setCompareSearchQuery2(""); }}
                              style={{
                                display: "flex", alignItems: "center", gap: "0.6rem",
                                background: comparePlayer2Id === getItemId(r) ? "rgba(168, 85, 247, 0.12)" : "rgba(255,255,255,0.03)",
                                border: comparePlayer2Id === getItemId(r) ? "1px solid rgba(168,85,247,0.4)" : "1px solid transparent",
                                borderRadius: "8px", padding: "0.45rem 0.75rem",
                                cursor: "pointer", textAlign: "left"
                              }}
                            >
                              <img src={getItemAvatar(r)} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                              <span style={{ fontSize: "0.85rem", color: comparePlayer2Id === getItemId(r) ? "#c084fc" : "var(--text-primary)", fontWeight: "600" }}>{getItemNick(r)}</span>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>#{r.position}</span>
                            </button>
                          ))}
                        </div>
                        {p2 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: "12px", padding: "0.75rem 1rem" }}>
                            {getItemAvatar(p2) && <img src={getItemAvatar(p2)} alt="" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(168,85,247,0.4)" }} />}
                            <div>
                              <div style={{ fontWeight: "700", fontSize: "0.85rem", color: "#fff" }}>{getItemNick(p2)}</div>
                              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>#{p2.position} в хабе</div>
                            </div>
                            {sk2 && <span style={{ marginLeft: "auto", background: sk2.bg, color: sk2.color, border: `1px solid ${sk2.border}`, borderRadius: "6px", padding: "0.2rem 0.55rem", fontSize: "0.8rem", fontWeight: "700", boxShadow: sk2.glow || undefined }}>{sk2.score}/100</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats comparison table */}
                    {p1 && p2 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "16px", overflow: "hidden" }}>
                          {/* Header */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", background: "rgba(255,255,255,0.04)", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}>
                              {getItemAvatar(p1) && <img src={getItemAvatar(p1)} alt="" style={{ width: "22px", height: "22px", borderRadius: "50%" }} />}
                              <span style={{ fontWeight: "700", color: "var(--accent-cyan)", fontSize: "0.9rem" }}>{getItemNick(p1)}</span>
                            </div>
                            <div style={{ padding: "0 1.5rem", color: "var(--text-muted)", fontSize: "0.75rem", textAlign: "center", fontWeight: "600" }}>ПОКАЗАТЕЛЬ</div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {getItemAvatar(p2) && <img src={getItemAvatar(p2)} alt="" style={{ width: "22px", height: "22px", borderRadius: "50%" }} />}
                              <span style={{ fontWeight: "700", color: "#c084fc", fontSize: "0.9rem" }}>{getItemNick(p2)}</span>
                            </div>
                          </div>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                              {sk1 && sk2 && statRow("Скилл (1–100)", sk1.score, sk2.score)}
                              {statRow("HLTV 2.0 Rating", (p1 as any).hubStats?.hltv ?? "—", (p2 as any).hubStats?.hltv ?? "—")}
                              {statRow("K/D Ratio", (p1 as any).hubStats?.kd ?? "—", (p2 as any).hubStats?.kd ?? "—")}
                              {statRow("AVG Kills", (p1 as any).hubStats?.avgKills ?? "—", (p2 as any).hubStats?.avgKills ?? "—")}
                              {statRow("ADR (Damage)", (p1 as any).hubStats?.adr ?? "—", (p2 as any).hubStats?.adr ?? "—")}
                              {statRow("HS% (Headshots)", (p1 as any).hubStats?.hsPct !== undefined ? `${(p1 as any).hubStats.hsPct}%` : "—", (p2 as any).hubStats?.hsPct !== undefined ? `${(p2 as any).hubStats.hsPct}%` : "—")}
                              {statRow("Очки в хабе", p1.points, p2.points)}
                              {statRow("Матчи в хабе", p1.played, p2.played)}
                              {statRow("Победы", p1.won, p2.won)}
                              {statRow("Поражения", p1.lost, p2.lost, false)}
                              {statRow("Win Rate", p1.played > 0 ? parseFloat(((p1.won / p1.played) * 100).toFixed(1)) : 0, p2.played > 0 ? parseFloat(((p2.won / p2.played) * 100).toFixed(1)) : 0)}
                              {statRow("Текущий стрик", p1.current_streak, p2.current_streak)}
                              {statRow("Место в хабе", p1.position, p2.position, false)}
                            </tbody>
                          </table>
                        </div>

                        {/* H2H & Teammate Chemistry Analysis */}
                        {(() => {
                          const nick1 = (getItemNick(p1) || "").toLowerCase();
                          const nick2 = (getItemNick(p2) || "").toLowerCase();
                          const id1 = ((p1.player?.player_id || (p1 as any).user_id || (p1 as any).player_id) || "").toLowerCase();
                          const id2 = ((p2.player?.player_id || (p2 as any).user_id || (p2 as any).player_id) || "").toLowerCase();

                          let rivalsCount = 0;
                          let p1RivalWins = 0;
                          let p2RivalWins = 0;

                          let teammateCount = 0;
                          let teamWins = 0;
                          let teamLosses = 0;

                          matches.forEach((m: any) => {
                            const rounds = (m._rounds || (m.stats && m.stats.rounds) || (m as any).rounds) as any[] | undefined;
                            if (!rounds || !Array.isArray(rounds)) return;

                            rounds.forEach((r: any) => {
                              const roundWinner = r.round_stats?.Winner;
                              let t1 = null;
                              let t2 = null;

                              (r.teams || []).forEach((team: any) => {
                                (team.players || []).forEach((player: any) => {
                                  const pn = (player.nickname || "").toLowerCase();
                                  const pid = (player.player_id || "").toLowerCase();
                                  if (pn === nick1 || (id1 && pid === id1)) t1 = team.team_id;
                                  if (pn === nick2 || (id2 && pid === id2)) t2 = team.team_id;
                                });
                              });

                              if (t1 && t2) {
                                if (t1 === t2) {
                                  teammateCount++;
                                  if (roundWinner && t1 === roundWinner) teamWins++;
                                  else teamLosses++;
                                } else {
                                  rivalsCount++;
                                  if (roundWinner === t1) p1RivalWins++;
                                  else if (roundWinner === t2) p2RivalWins++;
                                }
                              }
                            });
                          });

                          const totalTogether = rivalsCount + teammateCount;
                          const duoWinRate = teammateCount > 0 ? ((teamWins / teammateCount) * 100).toFixed(1) : "0.0";

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                              <h4 style={{ fontSize: "0.92rem", color: "#fff", fontWeight: "800", margin: 0 }}>
                                Совместная история в матчах хаба
                              </h4>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                                
                                {/* CARD 1: RIVALS (HEAD TO HEAD) */}
                                <div style={{
                                  background: "rgba(255, 73, 73, 0.05)",
                                  border: "1px solid rgba(255, 73, 73, 0.25)",
                                  borderRadius: "14px",
                                  padding: "1.25rem"
                                }}>
                                  <div style={{ fontSize: "0.75rem", color: "#ff8a80", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Личные встречи (Друг против друга)
                                  </div>
                                  <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#fff", marginTop: "0.4rem", display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                                    <span style={{ color: p1RivalWins > p2RivalWins ? "var(--success)" : "#fff" }}>{p1RivalWins}</span>
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>:</span>
                                    <span style={{ color: p2RivalWins > p1RivalWins ? "var(--success)" : "#fff" }}>{p2RivalWins}</span>
                                  </div>
                                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                                    Всего матчей соперниками: <strong>{rivalsCount}</strong>
                                  </div>
                                </div>

                                {/* CARD 2: TEAMMATES (IN SAME TEAM) */}
                                <div style={{
                                  background: "rgba(0, 229, 255, 0.05)",
                                  border: "1px solid rgba(0, 229, 255, 0.25)",
                                  borderRadius: "14px",
                                  padding: "1.25rem"
                                }}>
                                  <div style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    В одной команде (Тиммейты)
                                  </div>
                                  <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#fff", marginTop: "0.4rem", display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                                    <span>{duoWinRate}%</span>
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "600" }}>({teamWins}W / {teamLosses}L)</span>
                                  </div>
                                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                                    Матчей в одном составе: <strong>{teammateCount}</strong>
                                  </div>
                                </div>

                                {/* CARD 3: TOTAL HUB SHARED MATCHES */}
                                <div style={{
                                  background: "rgba(255, 255, 255, 0.03)",
                                  border: "1px solid var(--border-light)",
                                  borderRadius: "14px",
                                  padding: "1.25rem"
                                }}>
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Всего совместных игр на сервере
                                  </div>
                                  <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#fff", marginTop: "0.4rem" }}>
                                    {totalTogether}
                                  </div>
                                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                                    Матчей в хабе сыграно вместе
                                  </div>
                                </div>

                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "3rem", border: "1px dashed var(--border-light)", borderRadius: "16px", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: "2rem", fontWeight: "900", color: "var(--accent-cyan)", marginBottom: "0.75rem" }}>VS</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>Выбери двух игроков выше</div>
                        <div style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>Кликни на ники в списке — сравним их по скиллу, Win Rate, матчам и месту в хабе</div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

          </div>

        </div>
      )}

      {/* BASE FOOTER */}
      <footer style={{
        marginTop: "4rem",
        borderTop: "1px solid var(--border-light)",
        padding: "2rem 1.5rem",
        textAlign: "center",
        background: "rgba(10, 8, 20, 0.6)",
        backdropFilter: "blur(12px)",
        color: "var(--text-muted)",
        fontSize: "0.85rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem"
      }}>
        <div style={{ fontWeight: "900", color: "#fff", letterSpacing: "0.05em" }}>
          СИГМА КИБЕР КЛУБ &copy; {new Date().getFullYear()}
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          Powered by <span style={{ color: "var(--accent-cyan)", fontWeight: "800" }}>XZiBiTuM</span>
        </div>
      </footer>

      {/* MODAL: MATCH DETAILS STATS */}
      {selectedMatchId && (
        <div className="modal-overlay" onClick={() => setSelectedMatchId(null)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0, 0, 0, 0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999999, padding: "1rem" }}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "1000px", width: "100%", padding: "2.5rem 2rem 2rem 2rem", position: "relative" }}>
            <span className="modal-close-btn" onClick={() => setSelectedMatchId(null)}>✕</span>
            <ErrorBoundary>

            {isLoadingMatchDetails ? (
              <div style={{ textAlign: "center", padding: "5rem" }}>
                <div className="glow-text-cyan" style={{ fontSize: "1.2rem" }}>Загрузка статистики матча…</div>
              </div>
            ) : !matchDetails || matchDetails.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <h3 style={{ color: "var(--danger)" }}>Статистика матча недоступна</h3>
                <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>Платформа FACEIT еще не обработала статистику этой игры.</p>
              </div>
            ) : (
              <div>
                {(selectedMatchId?.startsWith("cs_") ||
                  (matches.find((m) => m.match_id === selectedMatchId) as any)?.source === "Cybershoke" ||
                  matches.find((m) => m.match_id === selectedMatchId)?.match_id?.startsWith("cs_") ||
                  matchDetails?.some((m: any) => m.isCustom || m.source === "Cybershoke" || (m as any).match_id?.startsWith("cs_"))) && (
                  <div style={{
                    background: "rgba(255, 171, 0, 0.1)",
                    border: "1px solid rgba(255, 171, 0, 0.4)",
                    borderRadius: "12px",
                    padding: "0.85rem 1.25rem",
                    marginBottom: "1.5rem",
                    color: "#ffca28",
                    fontSize: "0.88rem",
                    lineHeight: "1.5",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontWeight: "500"
                  }}>
                    <span style={{ fontSize: "1.3rem" }}>⚠️</span>
                    <div>
                      Этот матч был сыгран вне платформы FACEIT — информация по игре является неполноценной и может быть неточной.
                    </div>
                  </div>
                )}
                {[...matchDetails].reverse().map((round, rIndex) => {
                  const winnerTeamId = round.round_stats?.Winner;
                  const winnerTeam = round.teams?.find((t) => t.team_id === winnerTeamId);
                  const winnerName = winnerTeam?.team_stats?.Team || winnerTeamId || "Неизвестно";

                  const allPlayers = round.teams?.flatMap((t) => t.players || []) || [];
                  const mvpPlayer = [...allPlayers].sort((a, b) => {
                    const killsA = parseInt(a.player_stats?.Kills || "0", 10);
                    const killsB = parseInt(b.player_stats?.Kills || "0", 10);
                    if (killsB !== killsA) return killsB - killsA;
                    const adrA = parseFloat(a.player_stats?.ADR || "0");
                    const adrB = parseFloat(b.player_stats?.ADR || "0");
                    return adrB - adrA;
                  })[0];

                  const mvpKills = mvpPlayer?.player_stats?.Kills || "0";
                  const mvpDeaths = mvpPlayer?.player_stats?.Deaths || "0";
                  const mvpAssists = mvpPlayer?.player_stats?.Assists || "0";
                  const mvpKd = parseFloat(mvpPlayer?.player_stats?.["K/D Ratio"] || "0").toFixed(2);
                  const mvpAdr = parseFloat(mvpPlayer?.player_stats?.ADR || "75").toFixed(0);
                  const mvpHsPercent = mvpPlayer?.player_stats?.["Headshots %"] || "0";
                  
                  const doubleK = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["Double Kills"] || "0", 10) : 0;
                  const tripleK = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["Triple Kills"] || "0", 10) : 0;
                  const quadK = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["Quadro Kills"] || "0", 10) : 0;
                  const pentaK = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["Penta Kills"] || "0", 10) : 0;

                  const entryKills = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["First Kills"] || mvpPlayer.player_stats?.["Entry Wins"] || "0", 10) : 0;
                  const clutches1v1 = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["1v1Wins"] || "0", 10) : 0;
                  const clutches1v2 = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["1v2Wins"] || "0", 10) : 0;

                  const grenadeDmg = mvpPlayer ? parseFloat(mvpPlayer.player_stats?.["Utility Damage"] || "0").toFixed(0) : "0";
                  const flashedEnemies = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["Enemies Flashed"] || "0", 10) : 0;
                  const sniperKills = mvpPlayer ? parseInt(mvpPlayer.player_stats?.["Sniper Kills"] || "0", 10) : 0;


                  const leaderKills = [...allPlayers].sort((a, b) => {
                    return parseInt(b.player_stats?.Kills || "0", 10) - parseInt(a.player_stats?.Kills || "0", 10);
                  })[0];

                  const leaderDamage = [...allPlayers].sort((a, b) => {
                    return parseInt(b.player_stats?.Damage || "0", 10) - parseInt(a.player_stats?.Damage || "0", 10);
                  })[0];

                  const leaderFirstKills = [...allPlayers].sort((a, b) => {
                    const fkA = parseInt(a.player_stats?.["First Kills"] || a.player_stats?.["Entry Wins"] || "0", 10);
                    const fkB = parseInt(b.player_stats?.["First Kills"] || b.player_stats?.["Entry Wins"] || "0", 10);
                    return fkB - fkA;
                  })[0];

                  const leaderAssists = [...allPlayers].sort((a, b) => {
                    return parseInt(b.player_stats?.Assists || "0", 10) - parseInt(a.player_stats?.Assists || "0", 10);
                  })[0];

                  const leaderHS = [...allPlayers].sort((a, b) => {
                    const hsA = parseInt(a.player_stats?.["Headshots %"] || "0", 10);
                    const hsB = parseInt(b.player_stats?.["Headshots %"] || "0", 10);
                    return hsB - hsA;
                  })[0];


                  return (
                    <div 
                      key={rIndex} 
                      style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "1.5rem",
                        marginTop: rIndex > 0 ? "3rem" : "0",
                        paddingTop: rIndex > 0 ? "2.5rem" : "0",
                        borderTop: rIndex > 0 ? "1px solid rgba(255, 255, 255, 0.08)" : "none"
                      }}
                    >
                      
                      {/* Round general metadata */}
                      <div style={{
                        textAlign: "center",
                        borderBottom: "1px solid var(--border-light)",
                        paddingBottom: "1rem",
                        marginBottom: "1rem"
                      }}>
                        <span className="badge badge-info" style={{ marginBottom: "0.5rem" }}>
                          Карта: {round.round_stats?.Map || "Неизвестно"}
                        </span>
                        <h2 style={{ fontSize: "1.5rem", color: "#fff" }}>
                          Победитель: <span style={{ color: "var(--success)" }}>{winnerName}</span>
                        </h2>
                      </div>

                      {/* Highlights section */}
                      {mvpPlayer && (
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1.5rem",
                          marginBottom: "1.5rem"
                        }}>
                          {/* Left: MVP Card */}
                          <div className="glass-card" style={{
                            padding: "1.5rem",
                            display: "flex",
                            gap: "1.5rem",
                            alignItems: "center",
                            border: "1px solid var(--border-light)",
                            background: "rgba(255, 255, 255, 0.01)",
                            borderRadius: "12px",
                            position: "relative",
                            overflow: "hidden"
                          }}>
                            {/* Decorative gradient overlay */}
                            <div style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "4px",
                              height: "100%",
                              background: "linear-gradient(to bottom, var(--accent-yellow), var(--accent-purple))"
                            }} />

                            {/* Avatar column */}
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "0.5rem"
                            }}>
                              <div style={{
                                width: "80px",
                                height: "80px",
                                borderRadius: "50%",
                                background: getAvatarColor(mvpPlayer.nickname),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1.80rem",
                                fontWeight: "800",
                                color: "#fff",
                                border: "2px solid var(--accent-yellow)",
                                boxShadow: "0 0 15px rgba(255, 198, 25, 0.15)",
                                overflow: "hidden"
                              }}>
                                {getPlayerAvatar(mvpPlayer.player_id) ? (
                                  <img src={getPlayerAvatar(mvpPlayer.player_id) || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  getInitial(mvpPlayer.nickname)
                                )}
                              </div>
                              <span style={{ fontWeight: "800", color: "#fff", fontSize: "1.05rem", textAlign: "center", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {mvpPlayer.nickname}
                              </span>
                            </div>

                            {/* MVP stats column */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                              <span style={{
                                background: "linear-gradient(90deg, #ffe082, #ffb300)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                fontWeight: "900",
                                fontSize: "0.92rem",
                                letterSpacing: "0.05em"
                              }}>
                                ★ MVP МАТЧА
                              </span>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
                                {/* Row 1: Core Stats */}
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>K / D / A</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{mvpKills}/{mvpDeaths}/{mvpAssists}</div>
                                  <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>K/D: {mvpKd}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>ADR</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{mvpAdr}</div>
                                  <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>Всего: {mvpPlayer.player_stats?.Damage || "0"}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>HS</div>
                                  <div style={{ fontWeight: "700", color: "var(--accent-cyan)", fontSize: "0.9rem" }}>{mvpHsPercent}%</div>
                                  <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>Количество: {mvpPlayer.player_stats?.Headshots || "0"}</div>
                                </div>

                                {/* Row 2: Performance */}
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>МУЛЬТИ-КИЛЛЫ</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.85rem", marginTop: "0.1rem" }}>
                                    {doubleK + tripleK + quadK + pentaK > 0 ? (
                                      <span>{doubleK + tripleK + quadK + pentaK} {(() => {
                                        const cnt = doubleK + tripleK + quadK + pentaK;
                                        if (cnt === 1) return "раунд";
                                        if (cnt >= 2 && cnt <= 4) return "раунда";
                                        return "раундов";
                                      })()}</span>
                                    ) : (
                                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Нет</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-secondary)" }}>
                                    {(() => {
                                      const list = [];
                                      if (doubleK > 0) list.push(`2K: ${doubleK}`);
                                      if (tripleK > 0) list.push(`3K: ${tripleK}`);
                                      if (quadK > 0) list.push(`4K: ${quadK}`);
                                      if (pentaK > 0) list.push(`ACE: ${pentaK}`);
                                      return list.length > 0 ? list.join(" | ") : "0 мультикиллов";
                                    })()}
                                  </div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Клатчи</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.85rem", marginTop: "0.1rem" }}>
                                    {clutches1v1 > 0 || clutches1v2 > 0 ? (
                                      <span style={{ color: "#fff" }}>
                                        {clutches1v1 > 0 && `1v1: ${clutches1v1}`}
                                        {clutches1v1 > 0 && clutches1v2 > 0 && ", "}
                                        {clutches1v2 > 0 && `1v2: ${clutches1v2}`}
                                      </span>
                                    ) : (
                                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>0 побед</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>Попыток: {parseInt(mvpPlayer.player_stats?.["1v1Count"] || "0") + parseInt(mvpPlayer.player_stats?.["1v2Count"] || "0")}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Первые убийства</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{entryKills}</div>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>Попыток: {mvpPlayer.player_stats?.["Entry Count"] || "0"}</div>
                                </div>

                                {/* Row 3: Utility & Sniper */}
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Урон гранатами</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{grenadeDmg} HP</div>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>Попаданий: {mvpPlayer.player_stats?.["Utility Successes"] || "0"}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Ослеплено врагов</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{flashedEnemies} человек</div>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>Флешек: {mvpPlayer.player_stats?.["Flash Count"] || "0"}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Из снайперских винтовок</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{sniperKills} убийств</div>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>Процент: {Math.round(parseFloat(mvpPlayer.player_stats?.["Sniper Kill Rate per Match"] || "0") * 100)}%</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Bottom: Leaders List */}
                          <div style={{ 
                            display: "flex", 
                            flexDirection: "column", 
                            gap: "0.5rem",
                            width: "100%"
                          }}>
                            {/* Leader Kills */}
                            {leaderKills && (
                              <div className="glass-card" style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0.75rem",
                                border: "1px solid var(--border-light)",
                                background: "rgba(255, 255, 255, 0.01)",
                                borderRadius: "8px"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    background: getAvatarColor(leaderKills.nickname),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.75rem",
                                    fontWeight: "800",
                                    color: "#fff",
                                    overflow: "hidden"
                                  }}>
                                    {getPlayerAvatar(leaderKills.player_id) ? (
                                      <img src={getPlayerAvatar(leaderKills.player_id) || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      getInitial(leaderKills.nickname)
                                    )}
                                  </div>
                                  <span style={{ fontWeight: "600", color: "#fff", fontSize: "0.9rem" }}>{leaderKills.nickname}</span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "0.85rem" }}>
                                    {leaderKills.player_stats?.Kills}
                                  </div>
                                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Наибольшее кол-во убийств</div>
                                </div>
                              </div>
                            )}

                            {/* Leader Damage */}
                            {leaderDamage && (
                              <div className="glass-card" style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0.75rem",
                                border: "1px solid var(--border-light)",
                                background: "rgba(255, 255, 255, 0.01)",
                                borderRadius: "8px"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    background: getAvatarColor(leaderDamage.nickname),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.75rem",
                                    fontWeight: "800",
                                    color: "#fff",
                                    overflow: "hidden"
                                  }}>
                                    {getPlayerAvatar(leaderDamage.player_id) ? (
                                      <img src={getPlayerAvatar(leaderDamage.player_id) || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      getInitial(leaderDamage.nickname)
                                    )}
                                  </div>
                                  <span style={{ fontWeight: "600", color: "#fff", fontSize: "0.9rem" }}>{leaderDamage.nickname}</span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "0.85rem" }}>
                                    {leaderDamage.player_stats?.Damage}
                                  </div>
                                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Наибольший урон</div>
                                </div>
                              </div>
                            )}

                            {/* Leader First Kills */}
                            {leaderFirstKills && (
                              <div className="glass-card" style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0.75rem",
                                border: "1px solid var(--border-light)",
                                background: "rgba(255, 255, 255, 0.01)",
                                borderRadius: "8px"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    background: getAvatarColor(leaderFirstKills.nickname),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.75rem",
                                    fontWeight: "800",
                                    color: "#fff",
                                    overflow: "hidden"
                                  }}>
                                    {getPlayerAvatar(leaderFirstKills.player_id) ? (
                                      <img src={getPlayerAvatar(leaderFirstKills.player_id) || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      getInitial(leaderFirstKills.nickname)
                                    )}
                                  </div>
                                  <span style={{ fontWeight: "600", color: "#fff", fontSize: "0.9rem" }}>{leaderFirstKills.nickname}</span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "0.85rem" }}>
                                    {leaderFirstKills.player_stats?.["First Kills"] || leaderFirstKills.player_stats?.["Entry Wins"] || "0"}
                                  </div>
                                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Первые убийства</div>
                                </div>
                              </div>
                            )}

                            {/* Leader Assists */}
                            {leaderAssists && (
                              <div className="glass-card" style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0.75rem",
                                border: "1px solid var(--border-light)",
                                background: "rgba(255, 255, 255, 0.01)",
                                borderRadius: "8px"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    background: getAvatarColor(leaderAssists.nickname),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.75rem",
                                    fontWeight: "800",
                                    color: "#fff",
                                    overflow: "hidden"
                                  }}>
                                    {getPlayerAvatar(leaderAssists.player_id) ? (
                                      <img src={getPlayerAvatar(leaderAssists.player_id) || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      getInitial(leaderAssists.nickname)
                                    )}
                                  </div>
                                  <span style={{ fontWeight: "600", color: "#fff", fontSize: "0.9rem" }}>{leaderAssists.nickname}</span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "0.85rem" }}>
                                    {leaderAssists.player_stats?.Assists}
                                  </div>
                                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Наибольшее кол-во ассистов</div>
                                </div>
                              </div>
                            )}

                            {/* Leader HS% */}
                            {leaderHS && (
                              <div className="glass-card" style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.5rem 0.75rem",
                                border: "1px solid var(--border-light)",
                                background: "rgba(255, 255, 255, 0.01)",
                                borderRadius: "8px"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <div style={{
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "50%",
                                    background: getAvatarColor(leaderHS.nickname),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.75rem",
                                    fontWeight: "800",
                                    color: "#fff",
                                    overflow: "hidden"
                                  }}>
                                    {getPlayerAvatar(leaderHS.player_id) ? (
                                      <img src={getPlayerAvatar(leaderHS.player_id) || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      getInitial(leaderHS.nickname)
                                    )}
                                  </div>
                                  <span style={{ fontWeight: "600", color: "#fff", fontSize: "0.9rem" }}>{leaderHS.nickname}</span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "0.85rem" }}>
                                    {leaderHS.player_stats?.["Headshots %"]}%
                                  </div>
                                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Наибольший % хедшотов</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Half Scores Breakdown */}
                      {(() => {
                        const team1 = round.teams?.[0];
                        const team2 = round.teams?.[1];
                        if (!team1 || !team2) return null;

                        const t1Stats = team1.team_stats;
                        const t2Stats = team2.team_stats;

                        const t1Score1 = t1Stats?.["First Half Score"] || "0";
                        const t2Score1 = t2Stats?.["First Half Score"] || "0";

                        const t1Score2 = t1Stats?.["Second Half Score"] || "0";
                        const t2Score2 = t2Stats?.["Second Half Score"] || "0";

                        const t1ScoreOt = parseInt(t1Stats?.["Overtime score"] || "0", 10);
                        const t2ScoreOt = parseInt(t2Stats?.["Overtime score"] || "0", 10);
                        const hasOt = t1ScoreOt > 0 || t2ScoreOt > 0;

                        return (
                          <div className="glass-card" style={{
                            padding: "0.85rem 1.25rem",
                            background: "rgba(255, 255, 255, 0.01)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "10px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "0.5rem",
                            margin: "1rem 0 1.5rem 0",
                            position: "relative",
                            overflow: "hidden"
                          }}>
                            {/* Accent line */}
                            <div style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              height: "100%",
                              width: "3px",
                              background: "linear-gradient(to bottom, var(--accent-cyan), var(--accent-purple))"
                            }} />

                            <span style={{
                              fontSize: "0.7rem",
                              color: "var(--text-secondary)",
                              textTransform: "uppercase",
                              fontWeight: "800",
                              letterSpacing: "0.08em"
                            }}>
                              ХОД ИГРЫ ПО ПОЛОВИНАМ
                            </span>

                            <div style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              gap: "1.25rem",
                              flexWrap: "wrap",
                              width: "100%"
                            }}>
                              {/* 1st Half */}
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>1-я половина:</span>
                                <div style={{
                                  background: "rgba(255, 255, 255, 0.03)",
                                  padding: "0.2rem 0.6rem",
                                  borderRadius: "4px",
                                  border: "1px solid rgba(255, 255, 255, 0.05)",
                                  fontWeight: "800",
                                  fontSize: "0.95rem",
                                  color: "#fff"
                                }}>
                                  <span style={{ color: parseInt(t1Score1) > parseInt(t2Score1) ? "var(--success)" : "inherit" }}>{t1Score1}</span>
                                  <span style={{ color: "var(--text-muted)", margin: "0 0.2rem" }}>:</span>
                                  <span style={{ color: parseInt(t2Score1) > parseInt(t1Score1) ? "var(--success)" : "inherit" }}>{t2Score1}</span>
                                </div>
                              </div>

                              <div style={{ width: "1px", height: "12px", background: "rgba(255, 255, 255, 0.08)" }} />

                              {/* 2nd Half */}
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>2-я половина:</span>
                                <div style={{
                                  background: "rgba(255, 255, 255, 0.03)",
                                  padding: "0.2rem 0.6rem",
                                  borderRadius: "4px",
                                  border: "1px solid rgba(255, 255, 255, 0.05)",
                                  fontWeight: "800",
                                  fontSize: "0.95rem",
                                  color: "#fff"
                                }}>
                                  <span style={{ color: parseInt(t1Score2) > parseInt(t2Score2) ? "var(--success)" : "inherit" }}>{t1Score2}</span>
                                  <span style={{ color: "var(--text-muted)", margin: "0 0.2rem" }}>:</span>
                                  <span style={{ color: parseInt(t2Score2) > parseInt(t1Score2) ? "var(--success)" : "inherit" }}>{t2Score2}</span>
                                </div>
                              </div>

                              {hasOt && (
                                <>
                                  <div style={{ width: "1px", height: "12px", background: "rgba(255, 255, 255, 0.08)" }} />
                                  {/* Overtime */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Овертайм:</span>
                                    <div style={{
                                      background: "rgba(255, 198, 25, 0.04)",
                                      padding: "0.2rem 0.6rem",
                                      borderRadius: "4px",
                                      border: "1px solid rgba(255, 198, 25, 0.12)",
                                      fontWeight: "800",
                                      fontSize: "0.95rem",
                                      color: "var(--accent-yellow)"
                                    }}>
                                      <span style={{ color: t1ScoreOt > t2ScoreOt ? "var(--success)" : "inherit" }}>{t1ScoreOt}</span>
                                      <span style={{ color: "rgba(255, 198, 25, 0.3)", margin: "0 0.2rem" }}>:</span>
                                      <span style={{ color: t2ScoreOt > t1ScoreOt ? "var(--success)" : "inherit" }}>{t2ScoreOt}</span>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Round-by-Round Timeline */}
                      {(() => {
                        const team1 = round.teams?.[0];
                        const team2 = round.teams?.[1];
                        if (!team1 || !team2) return null;

                        const t1Stats = team1.team_stats;
                        const t2Stats = team2.team_stats;
                        const t1Name = t1Stats?.Team || "Команда 1";
                        const t2Name = t2Stats?.Team || "Команда 2";

                        const originalMapIndex = matchDetails.length - 1 - rIndex;
                        const roundHistory = roundHistories[originalMapIndex];
                        const isLoadingRoundHistory = loadingMapIndexes[originalMapIndex] || false;
                        const isSubmittingDemoUrl = submittingDemoUrls[originalMapIndex] || false;
                        const manualDemoUrl = manualDemoUrls[originalMapIndex] || "";
                        const setManualDemoUrl = (val: string) => setManualDemoUrls(prev => ({ ...prev, [originalMapIndex]: val }));
                        const selectedRadarRoundIndex = selectedRadarRoundIndexes[originalMapIndex] || null;
                        const setSelectedRadarRoundIndex = (val: number | null) => {
                          setSelectedRadarRoundIndexes(prev => ({ ...prev, [originalMapIndex]: val }));
                          setShowAllMatchDeathsMap(prev => ({ ...prev, [originalMapIndex]: false }));
                          setHoveredKillIdx(null);
                          setSelectedKillIdx(null);
                        };
                        const showAllMatchDeaths = showAllMatchDeathsMap[originalMapIndex] || false;
                        const setShowAllMatchDeaths = (val: boolean) => {
                          setShowAllMatchDeathsMap(prev => ({ ...prev, [originalMapIndex]: val }));
                          if (val) {
                            setSelectedRadarRoundIndexes(prev => ({ ...prev, [originalMapIndex]: null }));
                          }
                          setHoveredKillIdx(null);
                          setSelectedKillIdx(null);
                        };

                        // Helper to get emoji/icon for win reason
                        const getReasonIcon = (reason: string) => {
                          let src = "/icons/elimination.webp";
                          let alt = "Убийства";
                          if (reason === "bomb_exploded") {
                            src = "/icons/bomb_exploded.webp";
                            alt = "Взрыв";
                          } else if (reason === "bomb_defused") {
                            src = "/icons/bomb_defused.webp";
                            alt = "Дефуз";
                          } else if (reason === "time_expired") {
                            src = "/icons/time_expired.webp";
                            alt = "Время";
                          }

                          return (
                            <img 
                              src={src} 
                              alt={alt} 
                              style={{ 
                                width: "16px", 
                                height: "16px", 
                                objectFit: "contain",
                                filter: "invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
                              }} 
                            />
                          );
                        };

                        const getReasonTooltip = (reason: string, winner: string) => {
                          const side = winner === "CT" ? "Спецназ" : "Террористы";
                          switch (reason) {
                            case "bomb_exploded": return `Взрыв бомбы (${side})`;
                            case "bomb_defused": return `Разминирование (${side})`;
                            case "time_expired": return `Время вышло (${side})`;
                            default: return `Уничтожение противника (${side})`;
                          }
                        };

                        // Decide which team started CT and which T based on first-half score
                        const t1Score1 = parseInt(t1Stats?.["First Half Score"] || "0", 10);
                        const t2Score1 = parseInt(t2Stats?.["First Half Score"] || "0", 10);

                        let isT1StartedCT = true;
                        if (roundHistory && roundHistory.rounds && roundHistory.rounds.length > 0) {
                          const firstHalfRounds = roundHistory.rounds.slice(0, 12);
                          const ctWins = firstHalfRounds.filter((r: any) => r.winner === "CT").length;
                          const tWins = firstHalfRounds.filter((r: any) => r.winner === "T").length;

                          if (t1Score1 === ctWins) {
                            isT1StartedCT = true;
                          } else if (t1Score1 === tWins) {
                            isT1StartedCT = false;
                          }
                        }

                        const getRoundWinnerTeam = (roundWinnerSide: string, roundIndex: number) => {
                          const isFirstHalf = roundIndex < 12;
                          if (isFirstHalf) {
                            if (roundWinnerSide === "CT") {
                              return isT1StartedCT ? 1 : 2;
                            } else {
                              return isT1StartedCT ? 2 : 1;
                            }
                          } else {
                            if (roundWinnerSide === "CT") {
                              return isT1StartedCT ? 2 : 1;
                            } else {
                              return isT1StartedCT ? 1 : 2;
                            }
                          }
                        };

                        // Check if we have timeline data
                        const hasRounds = roundHistory && roundHistory.rounds && roundHistory.rounds.length > 0;

                        // Only show loading if we are fetching and have no cached data yet
                        if (isLoadingRoundHistory && !hasRounds) {
                          return (
                            <div className="glass-card" style={{
                              padding: "1rem 1.25rem",
                              background: "rgba(255, 255, 255, 0.01)",
                              border: "1px solid var(--border-light)",
                              borderRadius: "10px",
                              marginBottom: "1.5rem",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.5rem",
                              position: "relative",
                              overflow: "hidden"
                            }}>
                              <div style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                height: "100%",
                                width: "3px",
                                background: "linear-gradient(to bottom, var(--accent-purple), var(--accent-yellow))"
                              }} />
                              <div className="animate-pulse" style={{ fontSize: "0.85rem", color: "var(--accent-yellow)", fontWeight: "600" }}>
                                Скачивание и анализ записи игры (демки) с FACEIT...
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                                Это происходит только один раз при первом просмотре матча и занимает около 10-15 сек.
                              </div>
                            </div>
                          );
                        }

                        if (!hasRounds) {
                          return (
                            <div className="glass-card" style={{
                              padding: "1.25rem",
                              background: "rgba(255, 255, 255, 0.01)",
                              border: "1px solid var(--border-light)",
                              borderRadius: "10px",
                              marginBottom: "1.5rem",
                              position: "relative",
                              overflow: "hidden"
                            }}>
                              <div style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                height: "100%",
                                width: "3px",
                                background: "var(--accent-purple)"
                              }} />
                              <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                                Ход матча по раундам недоступен автоматически
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: "1.4" }}>
                                Faceit скрыл прямые ссылки на скачивание записей (они требуют временной подписи). Чтобы отобразить таймлайн раундов: кликни по кнопке «Скачать демо» на Faceit, скопируй ссылку из списка загрузок твоего браузера (Ctrl+J) и вставь её ниже:
                              </div>
                              {roundHistory && roundHistory.source === "error" && (
                                <div style={{
                                  background: "rgba(255, 61, 0, 0.05)",
                                  border: "1px solid rgba(255, 61, 0, 0.15)",
                                  borderRadius: "6px",
                                  padding: "0.5rem 0.75rem",
                                  color: "#ff5252",
                                  fontSize: "0.7rem",
                                  marginBottom: "1rem"
                                }}>
                                  Ошибка анализа: {roundHistory.error || "Не удалось скачать или распаковать демку."}
                                </div>
                              )}
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <input
                                  type="text"
                                  placeholder="Вставь ссылку на скачивание (.dem.zst / .dem.gz)..."
                                  value={manualDemoUrl}
                                  onChange={(e) => setManualDemoUrl(e.target.value)}
                                  disabled={isSubmittingDemoUrl}
                                  style={{
                                    flex: 1,
                                    background: "rgba(0, 0, 0, 0.3)",
                                    border: "1px solid var(--border-light)",
                                    borderRadius: "6px",
                                    padding: "0.4rem 0.75rem",
                                    color: "#fff",
                                    fontSize: "0.75rem",
                                    outline: "none"
                                  }}
                                />
                                <button
                                  onClick={() => submitManualDemoUrlForMap(originalMapIndex, manualDemoUrl)}
                                  disabled={isSubmittingDemoUrl || !manualDemoUrl.trim()}
                                  style={{
                                    background: "linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    padding: "0.4rem 1rem",
                                    fontSize: "0.75rem",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    transition: "opacity 0.2s"
                                  }}
                                >
                                  {isSubmittingDemoUrl ? "Загрузка..." : "Анализировать"}
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="glass-card" style={{
                            padding: "1rem 1.25rem",
                            background: "rgba(255, 255, 255, 0.01)",
                            border: "1px solid var(--border-light)",
                            borderRadius: "10px",
                            marginBottom: "1.5rem",
                            position: "relative",
                            overflow: "hidden"
                          }}>
                            {/* Left accent line */}
                            <div style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              height: "100%",
                              width: "3px",
                              background: "linear-gradient(to bottom, var(--accent-purple), var(--accent-yellow))"
                            }} />

                            <div style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "1rem"
                            }}>
                              <span style={{
                                fontSize: "0.7rem",
                                color: "var(--text-secondary)",
                                textTransform: "uppercase",
                                fontWeight: "800",
                                letterSpacing: "0.08em"
                              }}>
                                ХОД МАТЧА ПО РАУНДАМ (HUD CS2)
                              </span>
                            </div>

                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.85rem"
                            }}>
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                gap: "0.35rem",
                                flexWrap: "wrap",
                                background: "rgba(0,0,0,0.2)",
                                padding: "0.75rem",
                                borderRadius: "8px",
                                border: "1px solid rgba(255,255,255,0.02)"
                              }}>
                                {roundHistory.rounds.map((r: any, idx: number) => {
                                  const winnerTeamNum = getRoundWinnerTeam(r.winner, idx);
                                  const isCTWinner = r.winner === "CT";
                                  const winnerBg = isCTWinner ? "rgba(0, 184, 212, 0.08)" : "rgba(255, 61, 0, 0.08)";
                                  const winnerBorder = isCTWinner ? "rgba(0, 184, 212, 0.25)" : "rgba(255, 61, 0, 0.25)";
                                  const teamLabel = winnerTeamNum === 1 ? t1Name : t2Name;

                                  return (
                                    <div key={r.round} style={{ display: "flex", alignItems: "center" }}>
                                      <div 
                                        onClick={() => setSelectedRadarRoundIndex(selectedRadarRoundIndex === r.round ? null : r.round)}
                                        title={`Раунд ${r.round}: победили ${teamLabel}\nСпособ: ${getReasonTooltip(r.reason, r.winner)}\nНажми, чтобы открыть карту убийств`}
                                        style={{
                                          width: "36px",
                                          height: "36px",
                                          borderRadius: "6px",
                                          background: winnerBg,
                                          border: selectedRadarRoundIndex === r.round 
                                            ? "2px solid #fff" 
                                            : `1px solid ${winnerBorder}`,
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          position: "relative",
                                          cursor: "pointer",
                                          boxShadow: selectedRadarRoundIndex === r.round 
                                            ? "0 0 8px #fff" 
                                            : `0 0 6px ${isCTWinner ? "rgba(0,184,212,0.05)" : "rgba(255,61,0,0.05)"}`,
                                          transform: selectedRadarRoundIndex === r.round ? "scale(1.05)" : "scale(1)",
                                          transition: "all 0.15s ease"
                                        }}
                                      >
                                        <span style={{
                                          fontSize: "0.55rem",
                                          color: "var(--text-muted)",
                                          position: "absolute",
                                          top: "2px",
                                          fontWeight: "700"
                                        }}>
                                          {r.round}
                                        </span>
                                        <span style={{
                                          fontSize: "0.9rem",
                                          marginTop: "8px",
                                          display: "block"
                                        }}>
                                          {getReasonIcon(r.reason)}
                                        </span>
                                      </div>
                                      {/* Half-time switch visual divider after round 12 */}
                                      {idx === 11 && roundHistory.rounds.length > 12 && (
                                        <div style={{
                                          width: "2px",
                                          height: "30px",
                                          background: "rgba(255,255,255,0.15)",
                                          margin: "0 0.4rem",
                                          borderRadius: "1px"
                                        }} title="Смена сторон" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Legend/Keys */}
                              <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "1rem",
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                padding: "0 0.25rem"
                              }}>
                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <span style={{ color: "rgba(0, 184, 212, 1)" }}>●</span> Спецназ (CT)
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <span style={{ color: "rgba(255, 61, 0, 1)" }}>●</span> Террористы (T)
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    setSelectedRadarRoundIndex(null);
                                    setShowAllMatchDeaths(!showAllMatchDeaths);
                                  }}
                                  style={{
                                    background: showAllMatchDeaths 
                                      ? "rgba(255, 61, 0, 0.15)" 
                                      : "rgba(255,255,255,0.03)",
                                    border: showAllMatchDeaths 
                                      ? "1px solid rgba(255, 61, 0, 0.4)" 
                                      : "1px solid var(--border-light)",
                                    borderRadius: "6px",
                                    padding: "0.25rem 0.6rem",
                                    color: showAllMatchDeaths ? "#ff5252" : "#fff",
                                    fontSize: "0.65rem",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                  }}
                                >
                                  {showAllMatchDeaths ? "Скрыть тепловую карту" : "Тепловая карта всего матча"}
                                </button>

                                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <img src="/icons/elimination.webp" alt="Убийства" style={{ width: "12px", height: "12px", objectFit: "contain", filter: "invert(1)" }} /> Убийства
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <img src="/icons/bomb_exploded.webp" alt="Взрыв" style={{ width: "12px", height: "12px", objectFit: "contain", filter: "invert(1)" }} /> Взрыв
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <img src="/icons/bomb_defused.webp" alt="Дефуз" style={{ width: "12px", height: "12px", objectFit: "contain", filter: "invert(1)" }} /> Дефуз
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <img src="/icons/time_expired.webp" alt="Время" style={{ width: "12px", height: "12px", objectFit: "contain", filter: "invert(1)" }} /> Время
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Kill Map Radar */}
                              {renderRadarMap(originalMapIndex, round.round_stats.Map, t1Name, t2Name, isT1StartedCT, round.teams)}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Team scoreboards */}
                      {round.teams?.map((team) => {
                        const teamScore = team.team_stats?.["Final Score"] || team.team_stats?.Score || "-";
                        return (
                          <div key={team.team_id} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            <div style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "rgba(255,255,255,0.02)",
                              padding: "0.5rem 1rem",
                              borderRadius: "8px",
                              border: "1px solid var(--border-light)"
                            }}>
                              <span style={{ fontWeight: "700", color: "var(--accent-cyan)", fontSize: "1.05rem" }}>
                                {team.team_stats?.Team || "Команда"}
                              </span>
                              <span style={{ fontSize: "1.15rem", fontWeight: "800", color: "#fff" }}>
                                Раунды: {teamScore}
                              </span>
                            </div>

                            {/* Players stats table */}
                            <div className="custom-table-container">
                              <table className="custom-table">
                                <thead>
                                  <tr>
                                    <th>Игрок</th>
                                    <th style={{ textAlign: "center" }}>K</th>
                                    <th style={{ textAlign: "center" }}>D</th>
                                    <th style={{ textAlign: "center" }}>A</th>
                                    <th style={{ textAlign: "center" }}>K/D</th>
                                    <th style={{ textAlign: "center" }}>ADR</th>
                                    <th style={{ textAlign: "center" }}>HS%</th>
                                    <th style={{ textAlign: "center" }}>Rating</th>
                                    <th style={{ textAlign: "center" }}>MVP</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...(team.players || [])]
                                    .sort((a, b) => {
                                      const killsA = parseInt(a.player_stats?.Kills || "0", 10);
                                      const killsB = parseInt(b.player_stats?.Kills || "0", 10);
                                      if (killsB !== killsA) return killsB - killsA;
                                      const kdRatioA = parseFloat(a.player_stats?.["K/D Ratio"] || "0");
                                      const kdRatioB = parseFloat(b.player_stats?.["K/D Ratio"] || "0");
                                      return kdRatioB - kdRatioA;
                                    })
                                    .map((p) => {
                                      const kd = parseFloat(p.player_stats?.["K/D Ratio"] || "0");
                                      const isMVP = parseInt(p.player_stats?.MVPs || "0") >= 3;
                                      const cleanAdr = parseFloat(p.player_stats?.ADR || "75");

                                      // Calculate HLTV 2.0 Rating for each player in this match
                                      const kills = parseInt(p.player_stats?.Kills || "0", 10);
                                      const deaths = parseInt(p.player_stats?.Deaths || "0", 10);
                                      const assists = parseInt(p.player_stats?.Assists || "0", 10);
                                      const rounds = parseInt(round.round_stats?.Rounds || "24", 10);
                                      const kpr = rounds > 0 ? kills / rounds : 0;
                                      const dpr = rounds > 0 ? deaths / rounds : 0;
                                      const apr = rounds > 0 ? assists / rounds : 0;
                                      const hltv2 = (0.36 * kpr) - (0.53 * dpr) + (0.1 * apr) + (0.003 * cleanAdr) + 0.85;
                                      const ratingStr = Math.max(0.1, hltv2).toFixed(2);

                                      return (
                                        <tr key={p.player_id}>
                                          <td>
                                            <span 
                                              style={{ fontWeight: "600", color: "#fff", cursor: "pointer" }} 
                                              className="hover-underline"
                                              onClick={() => {
                                                setSelectedMatchId(null); // Close match modal
                                                loadPlayerDetails(p.player_id); // Open player modal
                                              }}
                                            >
                                              {p.nickname}
                                            </span>
                                          </td>
                                          <td style={{ textAlign: "center", fontWeight: "700", color: "#fff" }}>{p.player_stats?.Kills || "0"}</td>
                                          <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{p.player_stats?.Deaths || "0"}</td>
                                          <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>{p.player_stats?.Assists || "0"}</td>
                                          <td style={{ textAlign: "center", fontWeight: "600" }}>
                                            <span style={{ color: kd >= 1.2 ? "var(--success)" : kd < 0.95 ? "var(--danger)" : "var(--text-primary)" }}>
                                              {kd.toFixed(2)}
                                            </span>
                                          </td>
                                          <td style={{ textAlign: "center", fontWeight: "500", color: "#fff" }}>
                                            {cleanAdr.toFixed(0)}
                                          </td>
                                          <td style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                            {p.player_stats?.["Headshots %"] || "0"}%
                                          </td>
                                          <td style={{ textAlign: "center", fontWeight: "700", color: parseFloat(ratingStr) >= 1.2 ? "var(--success)" : parseFloat(ratingStr) < 0.95 ? "var(--danger)" : "var(--accent-cyan)" }}>
                                            {ratingStr}
                                          </td>
                                          <td style={{ textAlign: "center" }}>
                                            {isMVP ? (
                                              <span className="badge badge-warning" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem", fontWeight: "600" }}>
                                                {p.player_stats?.MVPs || "0"}
                                              </span>
                                            ) : (p.player_stats?.MVPs && p.player_stats.MVPs !== "0") ? (
                                              p.player_stats.MVPs
                                            ) : (
                                              <span style={{ color: "var(--text-muted)" }}>-</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}

                    </div>
                  );
                })}
              </div>
            )}
            </ErrorBoundary>
          </div>
        </div>
      )}


            {/* MODAL: PLAYER STATS */}
      {selectedPlayerId && (
        <div className="modal-overlay" onClick={() => setSelectedPlayerId(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", background: "rgba(0, 0, 0, 0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999999, padding: "1rem", boxSizing: "border-box" }}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "680px", maxHeight: "85vh", overflowY: "auto", padding: "2.5rem 2rem 2rem 2rem", margin: "auto", position: "relative", boxSizing: "border-box" }}>
            <span className="modal-close-btn" onClick={() => setSelectedPlayerId(null)} style={{ top: "1.5rem", right: "1.5rem" }}>✕</span>
            <ErrorBoundary>

            {isLoadingPlayer ? (
              <div style={{ textAlign: "center", padding: "5rem" }}>
                <div className="glow-text-cyan" style={{ fontSize: "1.2rem" }}>Загрузка профиля игрока...</div>
              </div>
            ) : !playerProfile ? (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <h3 style={{ color: "var(--danger)" }}>Профиль не найден</h3>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                
                {/* Profile header */}
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "1.5rem", paddingTop: "0.5rem", paddingRight: "2.5rem" }}>
                  <div style={{ width: "70px", height: "70px", borderRadius: "12px", overflow: "hidden", background: "#1c1829", border: "1px solid var(--border-light)" }}>
                    {playerProfile.avatar ? (
                      <img src={playerProfile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.35rem", fontWeight: "700", color: "var(--text-muted)" }}>
                        {playerProfile.nickname.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1.35rem", color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {playerProfile.nickname}
                    </h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                      {playerProfile.country && (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                          Страна: {playerProfile.country.toUpperCase()}
                        </span>
                      )}
                      {(playerProfile.steam_id_64 || playerProfile.platforms?.steam) && (
                        <a 
                          href={`https://steamcommunity.com/profiles/${playerProfile.steam_id_64 || playerProfile.platforms?.steam}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--accent-cyan)", fontSize: "0.78rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                        >
                          <img src="/icons/steam.png" alt="" style={{ width: "12px", height: "12px", objectFit: "contain" }} />
                          <span>Steam Profile ↗</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Level, Elo & HLTV 2.0 display */}
                  {(() => {
                    const gameId = hubDetails?.game_id || "cs2";
                    const gameInfo = playerProfile.games?.[gameId];
                    if (!gameInfo) return null;
                    return (
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
                        {playerHubStats?.hltvRating !== undefined && (
                          <div style={{ textAlign: "right", paddingRight: "0.75rem", borderRight: "1px solid var(--border-light)" }}>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>HLTV 2.0</span>
                            <span className="glow-text-cyan" style={{ fontWeight: "900", color: "var(--accent-cyan)", fontSize: "0.85rem" }}>
                              {playerHubStats.hltvRating.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>ELO</span>
                          <span style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem" }}>{gameInfo.faceit_elo}</span>
                        </div>
                        <img 
                          src={`/icons/faceit_level_${gameInfo.skill_level}.svg`} 
                          alt={`Level ${gameInfo.skill_level}`} 
                          style={{ width: "28px", height: "28px", objectFit: "contain", display: "block" }} 
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Skill Rating & Premier CS Rating Dedicated Block */}
                {(() => {
                  const realPremier = playerSteamStats?.premierRating;
                  const eloVal = playerProfile.games?.cs2?.faceit_elo || playerProfile.games?.csgo?.faceit_elo;
                  const combatStats = playerHubStats || (playerProfile?.lifetime ? {
                    kd: playerProfile.lifetime["Average K/D Ratio"],
                    hsPct: playerProfile.lifetime["Average Headshots %"],
                    winrate: playerProfile.lifetime["Win Rate %"],
                    avgKills: playerProfile.lifetime["Average Kills"]
                  } : null);
                  const faceitMatches = (playerProfile.games?.cs2 as any)?.matches || (playerProfile?.lifetime as any)?.Matches || 500;
                  const premierMatches = playerSteamStats?.premierMatches || 0;
                  const sk = getPlayerSkillInfo(playerProfile.player_id, playerProfile.nickname, eloVal, realPremier, combatStats, faceitMatches, premierMatches);
                  return (
                    <div className="glass-card" style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "1rem 1.35rem",
                      borderRadius: "12px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-light)",
                      gap: "1rem",
                      marginTop: "0.75rem",
                      marginBottom: "0.5rem"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span 
                          style={{
                            fontSize: "1.2rem",
                            fontWeight: "900",
                            background: sk.bg,
                            border: `1px solid ${sk.border}`,
                            color: sk.color,
                            padding: "0.35rem 0.85rem",
                            borderRadius: "10px"
                          }}
                        >
                          {sk.score} / 100
                        </span>
                        <div>
                          <span style={{ fontSize: "0.88rem", fontWeight: "800", color: sk.color }}>
                            {sk.tier} — Оценка скилла
                          </span>
                          <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "block", marginTop: "0.1rem" }}>
                            Premier CS Rating {sk.isRealPremier ? "" : "(расчетный)"}: <strong style={{ color: "#fff" }}>{(sk?.csRating ?? 0).toLocaleString("ru-RU")}</strong>
                          </span>
                          {!sk.isRealPremier && (
                            <span style={{ fontSize: "0.68rem", color: "#ffb74d", display: "block", marginTop: "0.2rem" }}>
                              ⚠️ Значение может быть неточным: игрок не отдает статистику через официальный API Valve.
                            </span>
                          )}
                        </div>
                      </div>

                      {userRole === "ADMIN" && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.78rem", padding: "0.45rem 0.9rem", borderRadius: "8px" }}
                          onClick={() => {
                            setAdminEditingPlayer(playerProfile);
                            setAdminCsRatingInput(sk.csRating.toString());
                            setAdminCustomEloInput(sk.override?.customElo !== undefined ? sk.override.customElo.toString() : "");
                            setAdminCustomScoreInput(sk.override?.customSkillScore !== undefined ? sk.override.customSkillScore.toString() : "");
                            setAdminEditMsg("");
                            setShowAdminPlayerEditModal(true);
                          }}
                        >
                          Редактировать инфу
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Tabs Menu */}
                <div style={{
                  display: "flex",
                  borderBottom: "1px solid var(--border-light)",
                  gap: "0.5rem",
                  paddingBottom: "2px",
                  marginTop: "0.75rem",
                  marginBottom: "0.75rem"
                }}>
                  {[
                    { id: "general", label: "Статистика (хаб)" },
                    { id: "tactical", label: "Статистика (все игры)" },
                    { id: "maps", label: "Статистика по картам" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setPlayerModalTab(tab.id as any)}
                      style={{
                        background: "none",
                        border: "none",
                        color: playerModalTab === tab.id ? "var(--accent-cyan)" : "var(--text-secondary)",
                        padding: "0.5rem 1rem",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        borderBottom: playerModalTab === tab.id ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                        transition: "all 0.2s"
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB CONTENT: GENERAL (HUB STATS) */}
                {playerModalTab === "general" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    {!playerGameStats && !playerHubStats ? (
                      <div style={{
                        padding: "2rem",
                        textAlign: "center",
                        color: "var(--text-muted)",
                        background: "rgba(0,0,0,0.15)",
                        borderRadius: "10px",
                        border: "1px dashed var(--border-light)",
                        fontSize: "0.85rem"
                      }}>
                        Игрок еще не сыграл ни одного матча или его статистика приватна.
                      </div>
                    ) : (
                      <>
                        {/* Lifetime Grid */}
                        {(() => {
                          const lbPlayed = playerActiveLeaderboardItem?.played;
                          const lbWon = playerActiveLeaderboardItem?.won;
                          const lbWinRate = (lbPlayed && lbWon !== undefined) 
                            ? ((lbWon / lbPlayed) * 100).toFixed(1) 
                            : (playerActiveLeaderboardItem?.win_rate || null);

                          const matchesVal = (lbPlayed !== undefined && lbPlayed !== null)
                            ? (playerHubStats?.matchesCount && playerHubStats.matchesCount !== lbPlayed 
                                ? `${lbPlayed} (всего: ${playerHubStats.matchesCount})` 
                                : `${lbPlayed}`)
                            : `${playerHubStats?.matchesCount ?? playerGameStats?.lifetime.Matches ?? 0}`;

                          const winrateVal = (lbWinRate !== null && lbWinRate !== undefined)
                            ? (playerHubStats?.winrate && Math.round(playerHubStats.winrate) !== Math.round(parseFloat(String(lbWinRate))) 
                                ? `${lbWinRate}% (всего: ${playerHubStats.winrate}%)` 
                                : `${lbWinRate}%`)
                            : `${playerHubStats?.winrate ?? playerGameStats?.lifetime["Win Rate %"] ?? 0}%`;

                          return (
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(4, 1fr)",
                              gap: "0.75rem"
                            }}>
                              {[
                                { label: lbPlayed !== undefined ? "Матчей (в сезоне)" : "Всего матчей", val: matchesVal, color: "#fff" },
                                { label: lbWinRate !== null ? "Win Rate (в сезоне)" : "Процент побед", val: winrateVal, color: "var(--success)" },
                                { label: "Средний K/D", val: (playerHubStats?.kd ?? parseFloat(playerGameStats?.lifetime["Average K/D Ratio"] || "0")).toFixed(2), color: "var(--accent-cyan)" },
                                { label: "Средний HS%", val: `${playerHubStats?.hsPct ?? playerGameStats?.lifetime["Average Headshots %"] ?? 0}%`, color: "#fff" }
                              ].map((item, idx) => (
                                <div key={idx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.6rem 0.85rem" }}>
                                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "block" }}>{item.label}</span>
                                  <span style={{ fontSize: "0.85rem", fontWeight: "700", color: item.color, display: "block", marginTop: "0.15rem" }}>
                                    {item.val}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Form and Streaks */}
                        <div style={{ display: "flex", gap: "1rem" }}>
                          <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.75rem 1rem" }}>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>Текущая форма (Последние 5 игр)</span>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              {(() => {
                                const recentList = playerHubStats?.recentResults || playerGameStats?.lifetime["Recent Results"] || [];
                                if (!Array.isArray(recentList) || recentList.length === 0) {
                                  return <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>—</span>;
                                }
                                return recentList.map((res: string, i: number) => {
                                  const isWin = res === "1";
                                  return (
                                    <div 
                                      key={i} 
                                      style={{
                                        width: "24px", height: "24px",
                                        borderRadius: "50%",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "0.7rem", fontWeight: "800",
                                        background: isWin ? "rgba(76, 175, 80, 0.15)" : "rgba(244, 67, 54, 0.15)",
                                        border: isWin ? "1px solid rgba(76, 175, 80, 0.3)" : "1px solid rgba(244, 67, 54, 0.3)",
                                        color: isWin ? "#4caf50" : "#f44336"
                                      }}
                                    >
                                      {isWin ? "W" : "L"}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.75rem 1rem", minWidth: "180px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                              <span>Текущий стрик:</span>
                              <span style={{ fontWeight: "700", color: "var(--success)" }}>
                                {(playerHubStats?.streaks?.current ?? playerGameStats?.lifetime["Current Win Streak"] ?? 0) > 0 ? `+${playerHubStats?.streaks?.current ?? playerGameStats?.lifetime["Current Win Streak"]} побед` : "0 побед"}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                              <span>Макс. стрик:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>
                                {playerHubStats?.streaks?.longest ?? playerGameStats?.lifetime["Longest Win Streak"] ?? 0} побед
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sniper / Weapon Info */}
                        {((playerHubStats?.sniper?.kills || 0) > 0 || (playerGameStats?.lifetime["Total Sniper Kills"] && parseInt(playerGameStats?.lifetime["Total Sniper Kills"]) > 0)) && (
                          <div style={{ background: "rgba(255,255,255,0.01)", border: "1px dashed var(--border-light)", borderRadius: "8px", padding: "0.75rem 1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <span style={{ fontSize: "0.78rem", fontWeight: "600", color: "#fff", display: "block" }}>Снайперская роль (AWP)</span>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Убийств со снайперских винтовок</span>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: "0.92rem", fontWeight: "700", color: "var(--accent-yellow)", display: "block" }}>
                                  {playerHubStats?.sniper?.kills ?? playerGameStats?.lifetime["Total Sniper Kills"]}
                                </span>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                  {playerHubStats?.sniper?.rate ?? Math.round(parseFloat(playerGameStats?.lifetime["Sniper Kill Rate"] || "0") * 100)}% от всех убийств
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* TAB CONTENT: TACTICAL (ALL GAMES STATS & LEETIFY) */}
                {playerModalTab === "tactical" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    
                    {/* Leetify Section */}
                    {leetifyStats ? (
                      <div style={{
                        background: "linear-gradient(135deg, rgba(30, 215, 96, 0.05) 0%, rgba(20, 20, 30, 0.4) 100%)",
                        border: "1px solid rgba(30, 215, 96, 0.25)",
                        borderRadius: "12px",
                        padding: "1rem 1.25rem"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                          <div>
                            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#fff" }}>Рейтинг Leetify</span>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block" }}>Комплексная оценка полезности игрока</span>
                          </div>
                          {(() => {
                            const val = parseFloat(leetifyStats.ranks?.leetify ?? leetifyStats.rating?.leetify ?? leetifyStats.stats?.leetify_rating ?? 0);
                            const isPos = val >= 0;
                            return (
                              <div style={{
                                background: isPos ? "rgba(76,175,80,0.15)" : "rgba(244,67,54,0.15)",
                                border: isPos ? "1px solid rgba(76,175,80,0.3)" : "1px solid rgba(244,67,54,0.3)",
                                color: isPos ? "#4caf50" : "#f44336",
                                padding: "0.25rem 0.75rem",
                                borderRadius: "6px",
                                fontWeight: "800",
                                fontSize: "0.85rem"
                              }}>
                                {isPos ? `+${val.toFixed(2)}` : val.toFixed(2)}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Leetify metrics grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginTop: "0.75rem" }}>
                          {[
                            { label: "Preaim Accuracy", val: leetifyStats.stats?.preaim !== undefined ? `${parseFloat(leetifyStats.stats.preaim).toFixed(1)}°` : (leetifyStats.stats?.preaim_accuracy !== undefined ? `${Math.round(leetifyStats.stats.preaim_accuracy * 100)}%` : "—") },
                            { label: "Reaction Time", val: leetifyStats.stats?.reaction_time_ms !== undefined ? `${Math.round(leetifyStats.stats.reaction_time_ms)} ms` : (leetifyStats.stats?.reaction_time !== undefined ? `${Math.round(leetifyStats.stats.reaction_time)} ms` : "—") },
                            { label: "Aim Accuracy", val: leetifyStats.stats?.accuracy_enemy_spotted !== undefined ? `${Math.round(leetifyStats.stats.accuracy_enemy_spotted)}%` : (leetifyStats.stats?.accuracy !== undefined ? `${Math.round(leetifyStats.stats.accuracy * 100)}%` : "—") },
                            { label: "Counter-Strafing", val: leetifyStats.stats?.counter_strafing_good_shots_ratio !== undefined ? `${Math.round(leetifyStats.stats.counter_strafing_good_shots_ratio)}%` : (leetifyStats.stats?.counter_strafing_shots_good_ratio !== undefined ? `${Math.round(leetifyStats.stats.counter_strafing_shots_good_ratio * 100)}%` : "—") },
                            { label: "Spray Accuracy", val: leetifyStats.stats?.spray_accuracy !== undefined ? `${Math.round(leetifyStats.stats.spray_accuracy * (leetifyStats.stats.spray_accuracy <= 1 ? 100 : 1))}%` : "—" },
                            { label: "Leetify T / CT", val: `${parseFloat(leetifyStats.rating?.t_leetify || leetifyStats.stats?.t_leetify_rating || 0).toFixed(1)} / ${parseFloat(leetifyStats.rating?.ct_leetify || leetifyStats.stats?.ct_leetify_rating || 0).toFixed(1)}` }
                          ].map((item, idx) => (
                            <div key={idx} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "0.5rem", border: "1px solid var(--border-light)" }}>
                              <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", display: "block" }}>{item.label}</span>
                              <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#fff", display: "block", marginTop: "0.15rem" }}>{item.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: "0.75rem 1rem",
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px dashed var(--border-light)",
                        borderRadius: "8px",
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        lineHeight: "1.4"
                      }}>
                        <strong>Данные Leetify недоступны:</strong> этот игрок не зарегистрирован на leetify.com или не настроена интеграция Leetify API. Ниже показаны альтернативные тактические показатели FACEIT.
                      </div>
                    )}

                    {/* Advanced Tactical Stats (FACEIT) */}
                    {playerGameStats && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                        
                        {/* Aim & Combat */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--accent-cyan)", display: "block", marginBottom: "0.5rem" }}>Бой и Атака</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Средний урон (ADR):</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>{playerGameStats.lifetime["ADR"] || "—"}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Коэффициент убийств:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>{parseFloat(playerGameStats.lifetime["K/D Ratio"] ? (parseFloat(playerGameStats.lifetime["K/D Ratio"]) / 1000).toFixed(2) : "0").toFixed(2)} K/D</span>
                            </div>
                          </div>
                        </div>

                        {/* Opening Duels */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--accent-yellow)", display: "block", marginBottom: "0.5rem" }}>Первые дуэли (Entry)</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Участие в дуэлях:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>
                                {playerGameStats.lifetime["Entry Rate"] ? `${Math.round(parseFloat(playerGameStats.lifetime["Entry Rate"]) * 100)}%` : "—"}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Выиграно дуэлей:</span>
                              <span style={{ fontWeight: "700", color: "var(--success)" }}>
                                {playerGameStats.lifetime["Entry Success Rate"] ? `${Math.round(parseFloat(playerGameStats.lifetime["Entry Success Rate"]) * 100)}%` : "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Utility usage */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--accent-purple)", display: "block", marginBottom: "0.5rem" }}>Использование гранат</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Урон гранатами/раунд:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>{playerGameStats.lifetime["Utility Damage per Round"] || "—"} HP</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Эффективность флешек:</span>
                              <span style={{ fontWeight: "700", color: "#fff" }}>
                                {playerGameStats.lifetime["Flash Success Rate"] ? `${Math.round(parseFloat(playerGameStats.lifetime["Flash Success Rate"]) * 100)}%` : "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Clutches */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.75rem 1rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#00d4ff", display: "block", marginBottom: "0.5rem" }}>Клачи (Clutches)</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Побед в 1v1 клачах:</span>
                              <span style={{ fontWeight: "700", color: "var(--success)" }}>
                                {playerGameStats.lifetime["1v1 Win Rate"] ? `${Math.round(parseFloat(playerGameStats.lifetime["1v1 Win Rate"]) * 100)}%` : "—"}
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Побед в 1v2 клачах:</span>
                              <span style={{ fontWeight: "700", color: "var(--success)" }}>
                                {playerGameStats.lifetime["1v2 Win Rate"] ? `${Math.round(parseFloat(playerGameStats.lifetime["1v2 Win Rate"]) * 100)}%` : "—"}
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT: MAPS */}
                {playerModalTab === "maps" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "360px", overflowY: "auto", paddingRight: "0.25rem" }}>
                    {(() => {
                      // Determine maps list to render: from hubStats or gameStats
                      let mapItems: any[] = [];
                      if (playerHubStats && Array.isArray(playerHubStats.maps)) {
                        mapItems = playerHubStats.maps;
                      } else if (playerGameStats && Array.isArray(playerGameStats.segments)) {
                        mapItems = playerGameStats.segments
                          .filter((seg: any) => seg.type === "Map")
                          .map((seg: any) => ({
                            map: seg.label,
                            matches: parseInt(seg.stats.Matches || "0"),
                            winrate: parseInt(seg.stats["Win Rate %"] || "0"),
                            kd: parseFloat(seg.stats["Average K/D Ratio"] || "0"),
                            adr: seg.stats.ADR ? parseFloat(seg.stats.ADR) : null,
                            hsPct: seg.stats["Average Headshots %"] ? parseInt(seg.stats["Average Headshots %"]) : 0,
                            img: seg.img_regular || seg.img_small
                          }));
                      }

                      // Filter out vertigo & overpass
                      mapItems = mapItems.filter((item: any) => {
                        const mName = (item.map || "").toLowerCase();
                        return !mName.includes("vertigo") && !mName.includes("overpass");
                      });

                      if (mapItems.length === 0) {
                        return (
                          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                            Нет подробных данных по картам.
                          </div>
                        );
                      }

                      return mapItems.map((seg: any, idx: number) => {
                        const rawMapName = seg.map || "";
                        const mapName = rawMapName.replace("de_", "").replace("cs_", "").toUpperCase();
                        const matches = seg.matches || 0;
                        const winRate = seg.winrate || 0;
                        const kd = seg.kd || 0;
                        const adr = seg.adr || 0;
                        const hsPct = seg.hsPct || 0;
                        const mapBgUrl = seg.img || getMapImageUrl(rawMapName);

                        return (
                          <div 
                            key={idx} 
                            style={{
                              position: "relative",
                              borderRadius: "8px",
                              overflow: "hidden",
                              background: "rgba(20, 18, 30, 0.8)",
                              border: "1px solid var(--border-light)",
                              display: "flex",
                              alignItems: "center",
                              padding: "0.75rem 1rem",
                              minHeight: "65px"
                            }}
                          >
                            {/* Background Map Image Overlay */}
                            <div 
                              style={{
                                position: "absolute",
                                right: 0, top: 0, bottom: 0,
                                width: "50%",
                                backgroundImage: `linear-gradient(to left, rgba(20, 18, 30, 0.2) 0%, rgba(20, 18, 30, 0.95) 75%, rgba(20, 18, 30, 1) 100%), url(${mapBgUrl})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                opacity: 0.7,
                                zIndex: 0
                              }}
                            />

                            <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                              <div>
                                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#fff", display: "block" }}>{mapName}</span>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                  Матчей: <strong>{matches}</strong> • Win Rate: <strong style={{ color: winRate >= 50 ? "var(--success)" : "var(--danger)" }}>{winRate}%</strong>
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: "1.25rem", textAlign: "right" }}>
                                <div>
                                  <span style={{ fontSize: "0.65rem", color: "var(--accent-cyan)", display: "block" }}>Avg K/D</span>
                                  <span style={{ fontSize: "0.82rem", fontWeight: "700", color: matches > 0 ? (kd >= 1.0 ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>
                                    {matches > 0 ? kd.toFixed(2) : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ fontSize: "0.65rem", color: "var(--accent-yellow)", display: "block" }}>ADR</span>
                                  <span style={{ fontSize: "0.82rem", fontWeight: "700", color: matches > 0 && adr ? (adr >= 80 ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>
                                    {matches > 0 && adr ? adr.toFixed(1) : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ fontSize: "0.65rem", color: "var(--accent-purple)", display: "block" }}>HS%</span>
                                  <span style={{ fontSize: "0.82rem", fontWeight: "700", color: matches > 0 ? (hsPct >= 40 ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>
                                    {matches > 0 ? `${hsPct}%` : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                  <Link
                    href={`/players/${playerProfile.nickname}`}
                    style={{
                      flex: 1,
                      padding: "0.55rem 1rem",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      background: "linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))",
                      color: "#fff",
                      borderRadius: "8px",
                      fontWeight: "700",
                      textAlign: "center",
                      textDecoration: "none"
                    }}
                  >
                    <span>Аналитика на сайте</span>
                  </Link>
                  <a
                    href={`https://www.faceit.com/ru/players/${playerProfile.nickname}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ flex: 1, padding: "0.55rem 1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", margin: 0 }}
                  >
                    <span>Профиль FACEIT ↗</span>
                  </a>
                </div>

              </div>
            )}
            </ErrorBoundary>
          </div>
        </div>
      )}



      {/* AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 100000,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          overflowY: "auto"
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: "500px",
            width: "90vw",
            margin: "0 auto",
            padding: "2.25rem",
            borderRadius: "24px",
            border: "1.5px solid var(--accent-cyan)",
            boxShadow: "0 0 50px rgba(0, 229, 255, 0.3)",
            position: "relative",
            background: "#0c0a17"
          }}>
            <span 
              className="modal-close-btn" 
              onClick={() => setShowAuthModal(false)}
              style={{ top: "1.25rem", right: "1.25rem" }}
            >
              ✕
            </span>

            <h3 className="glow-text-cyan tour-modal-title">
              Авторизация Доступа
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", textAlign: "center", marginBottom: "1.5rem" }}>
              Введите пароль доступа для роли Event Maker (Mr.Chillout) или Администратора
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Пароль доступа (PIN / Passcode):
                </label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={authPasscode} 
                  onChange={(e) => { setAuthPasscode(e.target.value); setAuthError(""); }}
                  placeholder="Введите пароль..."
                  style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: "12px", background: "#06050c" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const p = authPasscode.trim().toLowerCase();
                      if (p === "chillout" || p === "mrchillout") {
                        setUserRole("EVENT_MAKER");
                        setUserName("Mr.Chillout");
                        localStorage.setItem("sigma_user_role", "EVENT_MAKER");
                        localStorage.setItem("sigma_user_name", "Mr.Chillout");
                        setShowAuthModal(false);
                      } else if (p === "demon323161" || p === "admin" || p === "sigmaadmin") {
                        setUserRole("ADMIN");
                        setUserName("Admin");
                        localStorage.setItem("sigma_user_role", "ADMIN");
                        localStorage.setItem("sigma_user_name", "Admin");
                        setShowAuthModal(false);
                      } else {
                        setAuthError("Неверный пароль доступа! Для Event Maker: chillout, для Admin: admin");
                      }
                    }
                  }}
                />
              </div>

              {authError && (
                <div style={{ color: "#ff4949", fontSize: "0.85rem", background: "rgba(255,73,73,0.1)", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(255,73,73,0.2)" }}>
                  {authError}
                </div>
              )}

              <button 
                className="btn btn-glow-cyan" 
                onClick={() => {
                  const p = authPasscode.trim().toLowerCase();
                  if (p === "chillout" || p === "mrchillout") {
                    setUserRole("EVENT_MAKER");
                    setUserName("Mr.Chillout");
                    localStorage.setItem("sigma_user_role", "EVENT_MAKER");
                    localStorage.setItem("sigma_user_name", "Mr.Chillout");
                    setShowAuthModal(false);
                  } else if (p === "demon323161" || p === "admin" || p === "sigmaadmin") {
                    setUserRole("ADMIN");
                    setUserName("Admin");
                    localStorage.setItem("sigma_user_role", "ADMIN");
                    localStorage.setItem("sigma_user_name", "Admin");
                    setShowAuthModal(false);
                  } else {
                    setAuthError("Неверный пароль доступа! Для Event Maker: chillout, для Admin: admin");
                  }
                }}
                style={{ padding: "0.75rem", fontSize: "0.85rem", borderRadius: "12px", marginTop: "0.5rem" }}
              >
                Войти в систему
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MR.CHILLOUT EVENT ANNOUNCEMENT MODAL */}
      {showEventModal && (userRole === "EVENT_MAKER" || userRole === "ADMIN") && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 100000,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          overflowY: "auto"
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: "600px",
            width: "92vw",
            margin: "0 auto",
            padding: "2.25rem",
            borderRadius: "24px",
            border: "1.5px solid #7c4dff",
            boxShadow: "0 0 50px rgba(124, 77, 255, 0.3)",
            position: "relative",
            background: "#0c0a17"
          }}>
            <span 
              className="modal-close-btn" 
              onClick={() => setShowEventModal(false)}
              style={{ top: "1.25rem", right: "1.25rem" }}
            >
              ✕
            </span>

            <h3 className="glow-text-cyan tour-modal-title">
              Добавить Event для Выигрыша Ножа
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", textAlign: "center", marginBottom: "1.5rem" }}>
              Внесите условия выигрыша ножа на текущем турнире. Инфо будет видна на баннере сайта и автоматически сгорит через 3 дня (72 часа).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Условия выигрыша ножа:</label>
                <textarea 
                  className="input-field" 
                  rows={3}
                  value={eventAnnText} 
                  onChange={(e) => setEventAnnText(e.target.value)} 
                  placeholder="Прим: Для выигрыша ножа нужно набрать больше всех ножевых фрагов за турнир!"
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "12px", background: "#06050c", fontSize: "0.9rem" }} 
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Приз / Награда:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={eventAnnPrize} 
                  onChange={(e) => setEventAnnPrize(e.target.value)} 
                  placeholder="Прим: Нож (Knife) / 5000 руб."
                  style={{ width: "100%", padding: "0.6rem 0.9rem", borderRadius: "10px", background: "#06050c", fontSize: "0.9rem" }} 
                />
              </div>
            </div>

            {eventAnnMsg && (
              <div style={{ color: "#00e5ff", background: "rgba(0, 229, 255, 0.1)", padding: "0.75rem", borderRadius: "10px", marginBottom: "1rem", fontSize: "0.9rem", textAlign: "center", border: "1px solid var(--accent-cyan)" }}>
                {eventAnnMsg}
              </div>
            )}

            <button 
              className="btn btn-glow-cyan"
              onClick={async () => {
                try {
                  const passcode = userRole === "EVENT_MAKER" ? "chillout" : "demon323161";
                  const res = await fetch("/api/events/announcement", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ passcode, text: eventAnnText, prize: eventAnnPrize })
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    setEventAnnouncement(data.announcement);
                    setEventAnnMsg("Анонс события опубликован на 3 дня!");
                    setTimeout(() => { setShowEventModal(false); }, 1500);
                  } else {
                    setEventAnnMsg("Ошибка: " + (data.error || "Не удалось сохранить анонс"));
                  }
                } catch(e: any) {
                  setEventAnnMsg("Ошибка: " + e.message);
                }
              }}
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.85rem", borderRadius: "12px", background: "linear-gradient(135deg, #7c4dff, #00e5ff)" }}
            >
              Опубликовать Event
            </button>
          </div>
        </div>
      )}

      {/* ADMIN CYBERSHOKE MATCH UPLOAD MODAL (ADMIN ONLY) */}
      {showCybershokeModal && userRole === "ADMIN" && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 100000,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          overflowY: "auto"
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: "750px",
            width: "92vw",
            margin: "0 auto",
            padding: "2.25rem",
            borderRadius: "24px",
            border: "1.5px solid #ff9100",
            boxShadow: "0 0 50px rgba(255, 145, 0, 0.3)",
            position: "relative",
            background: "#0c0a17"
          }}>
            <span 
              className="modal-close-btn" 
              onClick={() => setShowCybershokeModal(false)}
              style={{ top: "1.25rem", right: "1.25rem" }}
            >
              ✕
            </span>

            <h3 className="glow-text-cyan tour-modal-title">
              Панель Администратора: Добавление матча Cybershoke
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", textAlign: "center", marginBottom: "1.5rem" }}>
              Внесите результаты серии карт Cybershoke с разбивкой KDA по игрокам каждой команды
            </p>

            {/* TEAM NAMES & WINNER SELECTOR */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Название Команды 1:</label>
                <input type="text" className="input-field" value={csFaction1} onChange={(e) => setCsFaction1(e.target.value)} style={{ width: "100%", padding: "0.6rem", borderRadius: "10px", background: "#06050c" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Название Команды 2:</label>
                <input type="text" className="input-field" value={csFaction2} onChange={(e) => setCsFaction2(e.target.value)} style={{ width: "100%", padding: "0.6rem", borderRadius: "10px", background: "#06050c" }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.85rem", color: "#ff9100", fontWeight: "700" }}>Победитель матча:</label>
                <select className="input-field" value={csWinner} onChange={(e) => setCsWinner(e.target.value)} style={{ width: "100%", padding: "0.6rem", borderRadius: "10px", background: "#06050c" }}>
                  <option value="faction1">Команда 1 ({csFaction1})</option>
                  <option value="faction2">Команда 2 ({csFaction2})</option>
                  <option value="draw">Ничья (1:1 / Draw)</option>
                </select>
              </div>
            </div>

            {/* MAPS & SCORES (SUPPORT BO1 / BO2) */}
            <div style={{ background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--border-light)", marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: "700", fontSize: "0.9rem", color: "var(--accent-cyan)", marginBottom: "0.5rem" }}>
                Карты серии (BO1 / BO2):
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Карта 1:</label>
                  <select className="input-field" value={csMap1} onChange={(e) => setCsMap1(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem" }}>
                    <option value="de_mirage">Mirage</option>
                    <option value="de_dust2">Dust 2</option>
                    <option value="de_anubis">Anubis</option>
                    <option value="de_inferno">Inferno</option>
                    <option value="de_nuke">Nuke</option>
                    <option value="de_ancient">Ancient</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Счет (К1 : К2):</label>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <input type="number" className="input-field" value={csScore1} onChange={(e) => setCsScore1(e.target.value)} style={{ width: "50%", padding: "0.5rem", borderRadius: "8px", background: "#06050c", textAlign: "center", fontSize: "0.85rem" }} />
                    <input type="number" className="input-field" value={csScore2} onChange={(e) => setCsScore2(e.target.value)} style={{ width: "50%", padding: "0.5rem", borderRadius: "8px", background: "#06050c", textAlign: "center", fontSize: "0.85rem" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)" }}>Карта 2 (Необязательно):</label>
                  <select className="input-field" value={csMap2} onChange={(e) => setCsMap2(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem" }}>
                    <option value="">(Без второй карты)</option>
                    <option value="de_mirage">Mirage</option>
                    <option value="de_dust2">Dust 2</option>
                    <option value="de_anubis">Anubis</option>
                    <option value="de_inferno">Inferno</option>
                    <option value="de_nuke">Nuke</option>
                    <option value="de_ancient">Ancient</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TEAM 1 PLAYERS INPUT */}
            <div style={{ background: "rgba(0, 229, 255, 0.03)", padding: "1.25rem", borderRadius: "16px", border: "1px solid rgba(0, 229, 255, 0.2)", marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#00e5ff", fontSize: "0.95rem" }}>
                Игроки Команды 1 ({csFaction1}):
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.3rem", fontSize: "0.75rem", color: "var(--text-secondary)", textAlign: "center" }}>
                <span style={{ textAlign: "left" }}>Ник в Хабе / Кибершок</span>
                <span>Kills</span>
                <span>Deaths</span>
                <span>Assists</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input type="text" className="input-field" value={csPlayerNick1} onChange={(e) => setCsPlayerNick1(e.target.value)} placeholder="Прим: MrChillout61" style={{ padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem" }} />
                <input type="number" className="input-field" value={csKills1} onChange={(e) => setCsKills1(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem", textAlign: "center" }} />
                <input type="number" className="input-field" value={csDeaths1} onChange={(e) => setCsDeaths1(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem", textAlign: "center" }} />
                <input type="number" className="input-field" value={csAssists1} onChange={(e) => setCsAssists1(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem", textAlign: "center" }} />
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  if (!csPlayerNick1.trim()) return;
                  setCsPlayers1(prev => [...prev, { nickname: csPlayerNick1.trim(), kills: csKills1, deaths: csDeaths1, assists: csAssists1 }]);
                  setCsPlayerNick1(""); setCsKills1("0"); setCsDeaths1("0"); setCsAssists1("0");
                }}
                style={{ width: "100%", padding: "0.45rem", fontSize: "0.82rem" }}
              >
                + Добавить игрока в Команду 1
              </button>

              {csPlayers1.length > 0 && (
                <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {csPlayers1.map((p, idx) => (
                    <span key={idx} style={{ background: "rgba(0, 229, 255, 0.15)", border: "1px solid var(--accent-cyan)", padding: "0.25rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem", color: "#fff" }}>
                      {p.nickname} (K:{p.kills} D:{p.deaths} A:{p.assists})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* TEAM 2 PLAYERS INPUT */}
            <div style={{ background: "rgba(255, 145, 0, 0.03)", padding: "1.25rem", borderRadius: "16px", border: "1px solid rgba(255, 145, 0, 0.2)", marginBottom: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#ff9100", fontSize: "0.95rem" }}>
                Игроки Команды 2 ({csFaction2}):
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.3rem", fontSize: "0.75rem", color: "var(--text-secondary)", textAlign: "center" }}>
                <span style={{ textAlign: "left" }}>Ник в Хабе / Кибершок</span>
                <span>Kills</span>
                <span>Deaths</span>
                <span>Assists</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input type="text" className="input-field" value={csPlayerNick2} onChange={(e) => setCsPlayerNick2(e.target.value)} placeholder="Прим: ANAKONDA1966" style={{ padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem" }} />
                <input type="number" className="input-field" value={csKills2} onChange={(e) => setCsKills2(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem", textAlign: "center" }} />
                <input type="number" className="input-field" value={csDeaths2} onChange={(e) => setCsDeaths2(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem", textAlign: "center" }} />
                <input type="number" className="input-field" value={csAssists2} onChange={(e) => setCsAssists2(e.target.value)} style={{ padding: "0.5rem", borderRadius: "8px", background: "#06050c", fontSize: "0.85rem", textAlign: "center" }} />
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  if (!csPlayerNick2.trim()) return;
                  setCsPlayers2(prev => [...prev, { nickname: csPlayerNick2.trim(), kills: csKills2, deaths: csDeaths2, assists: csAssists2 }]);
                  setCsPlayerNick2(""); setCsKills2("0"); setCsDeaths2("0"); setCsAssists2("0");
                }}
                style={{ width: "100%", padding: "0.45rem", fontSize: "0.82rem" }}
              >
                + Добавить игрока в Команду 2
              </button>

              {csPlayers2.length > 0 && (
                <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {csPlayers2.map((p, idx) => (
                    <span key={idx} style={{ background: "rgba(255, 145, 0, 0.15)", border: "1px solid #ff9100", padding: "0.25rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem", color: "#fff" }}>
                      {p.nickname} (K:{p.kills} D:{p.deaths} A:{p.assists})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {csSubmitMsg && (
              <div style={{ color: "#00e5ff", background: "rgba(0, 229, 255, 0.1)", padding: "0.75rem", borderRadius: "10px", marginBottom: "1rem", fontSize: "0.9rem", textAlign: "center", border: "1px solid var(--accent-cyan)" }}>
                {csSubmitMsg}
              </div>
            )}

            <button 
              className="btn btn-glow-cyan"
              onClick={async () => {
                try {
                  const res = await fetch("/api/admin/matches/custom", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      passcode: "demon323161",
                      matchData: {
                        map1: csMap1,
                        map2: csMap2,
                        faction1: csFaction1,
                        faction2: csFaction2,
                        score1: csScore1,
                        score2: csScore2,
                        winner: csWinner,
                        players1: csPlayers1,
                        players2: csPlayers2
                      }
                    })
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    setCsSubmitMsg("Матч Cybershoke успешно сохранен и добавлен!");
                    setTimeout(() => { setShowCybershokeModal(false); fetchMatches(); }, 1500);
                  } else {
                    setCsSubmitMsg("Ошибка: " + (data.error || "Не удалось сохранить матч"));
                  }
                } catch(e: any) {
                  setCsSubmitMsg("Ошибка: " + e.message);
                }
              }}
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.85rem", borderRadius: "12px", background: "linear-gradient(135deg, #ff9100, #ff1744)" }}
            >
              Сохранить матч Cybershoke
            </button>
          </div>
        </div>
      )}

      {/* MR.CHILLOUT EVENT ANNOUNCEMENT MODAL */}
      {showEventModal && (userRole === "EVENT_MAKER" || userRole === "ADMIN") && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 100000,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          overflowY: "auto"
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: "600px",
            width: "92vw",
            margin: "0 auto",
            padding: "2.25rem",
            borderRadius: "24px",
            border: "1.5px solid #7c4dff",
            boxShadow: "0 0 50px rgba(124, 77, 255, 0.3)",
            position: "relative",
            background: "#0c0a17"
          }}>
            <span 
              className="modal-close-btn" 
              onClick={() => setShowEventModal(false)}
              style={{ top: "1.25rem", right: "1.25rem" }}
            >
              ✕
            </span>

            <h3 className="glow-text-cyan tour-modal-title">
              Добавить Event для Выигрыша Ножа
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", textAlign: "center", marginBottom: "1.5rem" }}>
              Внесите условия выигрыша ножа на текущем турнире. Инфо будет видна на баннере сайта и автоматически сгорит через 3 дня (72 часа).
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Условия выигрыша ножа:</label>
                <textarea 
                  className="input-field" 
                  rows={3}
                  value={eventAnnText} 
                  onChange={(e) => setEventAnnText(e.target.value)} 
                  placeholder="Прим: Для выигрыша ножа нужно набрать больше всех ножевых фрагов за турнир!"
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "12px", background: "#06050c", fontSize: "0.9rem", resize: "vertical", boxSizing: "border-box" }} 
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Приз / Награда:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={eventAnnPrize} 
                  onChange={(e) => setEventAnnPrize(e.target.value)} 
                  placeholder="Прим: Нож (Knife) / 5000 руб."
                  style={{ width: "100%", padding: "0.6rem 0.9rem", borderRadius: "10px", background: "#06050c", fontSize: "0.9rem" }} 
                />
              </div>
            </div>

            {eventAnnMsg && (
              <div style={{ color: "#00e5ff", background: "rgba(0, 229, 255, 0.1)", padding: "0.75rem", borderRadius: "10px", marginBottom: "1rem", fontSize: "0.9rem", textAlign: "center", border: "1px solid var(--accent-cyan)" }}>
                {eventAnnMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
              <button 
                className="btn btn-glow-cyan"
                onClick={async () => {
                  try {
                    const passcode = userRole === "EVENT_MAKER" ? "chillout" : "demon323161";
                    const res = await fetch("/api/events/announcement", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ passcode, text: eventAnnText, prize: eventAnnPrize })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      setEventAnnouncement(data.announcement);
                      setEventAnnMsg("Анонс события опубликован на 3 дня!");
                      setTimeout(() => { setShowEventModal(false); }, 1500);
                    } else {
                      setEventAnnMsg("Ошибка: " + (data.error || "Не удалось сохранить анонс"));
                    }
                  } catch(e: any) {
                    setEventAnnMsg("Ошибка: " + e.message);
                  }
                }}
                style={{ width: "100%", padding: "0.75rem", fontSize: "0.85rem", borderRadius: "12px", background: "linear-gradient(135deg, #7c4dff, #00e5ff)" }}
              >
                Опубликовать Event
              </button>

              {eventAnnouncement && (
                <button
                  onClick={async () => {
                    try {
                      const passcode = userRole === "EVENT_MAKER" ? "chillout" : "demon323161";
                      const res = await fetch(`/api/events/announcement?passcode=${passcode}`, { method: "DELETE" });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        setEventAnnouncement(null);
                        setEventAnnMsg("Event успешно удален!");
                        setTimeout(() => { setShowEventModal(false); }, 1200);
                      } else {
                        setEventAnnMsg("Ошибка при удалении: " + (data.error || ""));
                      }
                    } catch (e: any) {
                      setEventAnnMsg("Ошибка сети: " + e.message);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "0.95rem",
                    fontWeight: "700",
                    borderRadius: "12px",
                    background: "rgba(255, 73, 73, 0.15)",
                    border: "1px solid rgba(255, 73, 73, 0.4)",
                    color: "#ff4949",
                    cursor: "pointer"
                  }}
                >
                  🗑 Удалить текущий Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN INDIVIDUAL PLAYER EDIT MODAL */}
      {showAdminPlayerEditModal && adminEditingPlayer && userRole === "ADMIN" && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 1000000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem"
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: "500px",
            width: "100%",
            padding: "2rem",
            borderRadius: "20px",
            border: "1.5px solid var(--accent-cyan)",
            boxShadow: "0 0 40px rgba(0, 229, 255, 0.2)",
            position: "relative",
            background: "#0c0a17"
          }}>
            <span 
              className="modal-close-btn" 
              onClick={() => setShowAdminPlayerEditModal(false)}
              style={{ top: "1.25rem", right: "1.25rem" }}
            >
              ✕
            </span>

            <h3 className="glow-text-cyan tour-modal-title">
              Редактирование игрока: {adminEditingPlayer.nickname}
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", textAlign: "center", marginBottom: "1.25rem" }}>
              Задайте индивидуальные переопределения рейтинга или ELO для игрока хаба
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Premier CS Rating (очки в CS2):
                </label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={adminCsRatingInput} 
                  onChange={(e) => setAdminCsRatingInput(e.target.value)} 
                  placeholder="Прим: 18940 или 14500" 
                  style={{ width: "100%", padding: "0.65rem", borderRadius: "10px", background: "#06050c", fontSize: "0.9rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Фиксированный балл скилла (1–100, опционально):
                </label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={adminCustomScoreInput} 
                  onChange={(e) => setAdminCustomScoreInput(e.target.value)} 
                  placeholder="Прим: 85" 
                  style={{ width: "100%", padding: "0.65rem", borderRadius: "10px", background: "#06050c", fontSize: "0.9rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Custom FACEIT ELO (если отличается):
                </label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={adminCustomEloInput} 
                  onChange={(e) => setAdminCustomEloInput(e.target.value)} 
                  placeholder="Прим: 1980" 
                  style={{ width: "100%", padding: "0.65rem", borderRadius: "10px", background: "#06050c", fontSize: "0.9rem" }}
                />
              </div>

              {adminEditMsg && (
                <div style={{ fontSize: "0.82rem", color: adminEditMsg.includes("Ошибка") ? "#ff4949" : "#4caf50", textAlign: "center" }}>
                  {adminEditMsg}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowAdminPlayerEditModal(false)}
                style={{ flex: 1, padding: "0.65rem", borderRadius: "10px" }}
              >
                Отмена
              </button>
              <button 
                className="btn btn-glow-cyan" 
                onClick={async () => {
                  try {
                    setAdminEditMsg("Сохранение...");
                    const res = await fetch("/api/admin/players/override", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        passcode: "sigmaadmin",
                        playerId: adminEditingPlayer.player_id,
                        nickname: adminEditingPlayer.nickname,
                        csRating: adminCsRatingInput !== "" ? Number(adminCsRatingInput) : undefined,
                        customElo: adminCustomEloInput !== "" ? Number(adminCustomEloInput) : undefined,
                        customSkillScore: adminCustomScoreInput !== "" ? Number(adminCustomScoreInput) : undefined
                      })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      setAdminEditMsg("Сохранено успешно!");
                      fetchPlayerOverrides();
                      setTimeout(() => {
                        setShowAdminPlayerEditModal(false);
                        setAdminEditMsg("");
                      }, 1000);
                    } else {
                      setAdminEditMsg(data.error || "Ошибка сохранения");
                    }
                  } catch (err: any) {
                    setAdminEditMsg("Ошибка сети: " + err.message);
                  }
                }}
                style={{ flex: 1, padding: "0.65rem", borderRadius: "10px" }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN BATCH PREMIER PTS & SKILL SCORE EDIT MODAL */}
      {showBatchPtsModal && userRole === "ADMIN" && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 1000000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem"
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: "850px",
            width: "100%",
            maxHeight: "88vh",
            overflowY: "auto",
            padding: "2rem",
            borderRadius: "24px",
            border: "1.5px solid var(--accent-cyan)",
            boxShadow: "0 0 50px rgba(0, 229, 255, 0.25)",
            position: "relative",
            background: "#0c0a17"
          }}>
            <span 
              className="modal-close-btn" 
              onClick={() => setShowBatchPtsModal(false)}
              style={{ top: "1.25rem", right: "1.25rem" }}
            >
              ✕
            </span>

            <h3 className="glow-text-cyan tour-modal-title">
              Массовое редактирование Premier PTS и Скилла игроков
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center", marginBottom: "1.25rem" }}>
              Задайте Premier PTS или индивидуальный Балл Скилла (1–100) для каждого игрока
            </p>

            {/* Formula Explanation Banner */}
            <div style={{
              background: "rgba(0, 229, 255, 0.05)",
              border: "1px solid rgba(0, 229, 255, 0.2)",
              borderRadius: "12px",
              padding: "0.85rem 1.1rem",
              marginBottom: "1.25rem",
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              lineHeight: "1.45"
            }}>
              <strong style={{ color: "var(--accent-cyan)", display: "block", marginBottom: "0.45rem", fontSize: "0.88rem" }}>
                Формула расчёта динамического скилла (1–100):
              </strong>
              <div>• <strong>Базовый скилл (Faceit ELO + Premier PTS):</strong> взвешивается в пользу платформы с большей активностью (50/50, 70/30 или 30/70).</div>
              <div>• <strong>Глобальные метрики Faceit:</strong> корректировка по K/D (±12 pts за 1.0), Win Rate (±0.20 pts за 1%) и HS%.</div>
              <div>• <strong>Статистика в Хабе:</strong> плавный учёт K/D и ADR в хабе с защитой от малого количества игр: <code style={{ color: "#00e5ff", fontWeight: "700" }}>K_hub = min(0.35, N_матчей / 20 × 0.35)</code>.</div>
              <div>• <strong>Итог:</strong> <code style={{ color: "#00e5ff", fontWeight: "700" }}>Skill = Math.round((1 - K_hub) × S_Global + K_hub × S_Hub)</code></div>
              <div style={{ marginTop: "0.45rem", color: "#ffb74d", fontSize: "0.78rem" }}>
                <em>При вводе поля «Скилл (1–100)» значение фиксируется и напрямую задает итоговый балл игрока.</em>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {(rankings && rankings.length > 0 ? rankings : []).map((item: any, idx: number) => {
                const nick = item.nickname || item.player?.nickname || "Игрок";
                const pId = item.player_id || item.player?.player_id;
                const ov = (pId && playerOverridesMap[pId]) || (nick && playerOverridesMap[nick]) || {};
                const currentPts = batchPtsMap[nick] !== undefined ? batchPtsMap[nick] : (ov.csRating !== undefined ? ov.csRating.toString() : "");
                const currentScore = batchScoreMap[nick] !== undefined ? batchScoreMap[nick] : (ov.customSkillScore !== undefined ? ov.customSkillScore.toString() : "");

                return (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "10px",
                    padding: "0.55rem 0.85rem",
                    gap: "0.5rem"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: "120px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: "20px" }}>#{idx + 1}</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{nick}</span>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", display: "block", textAlign: "center" }}>Premier PTS</span>
                        <input 
                          type="number"
                          value={currentPts}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchPtsMap(prev => ({ ...prev, [nick]: val }));
                          }}
                          placeholder="PTS"
                          style={{
                            width: "90px",
                            padding: "0.35rem 0.5rem",
                            borderRadius: "7px",
                            background: "#06050c",
                            border: "1px solid var(--border-light)",
                            color: "var(--accent-cyan)",
                            fontWeight: "700",
                            fontSize: "0.82rem",
                            textAlign: "right"
                          }}
                        />
                      </div>

                      <div>
                        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", display: "block", textAlign: "center" }}>Скилл 1-100</span>
                        <input 
                          type="number"
                          value={currentScore}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchScoreMap(prev => ({ ...prev, [nick]: val }));
                          }}
                          placeholder="1-100"
                          style={{
                            width: "70px",
                            padding: "0.35rem 0.5rem",
                            borderRadius: "7px",
                            background: "#06050c",
                            border: "1px solid var(--border-light)",
                            color: "#c084fc",
                            fontWeight: "700",
                            fontSize: "0.82rem",
                            textAlign: "right"
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {batchSaveMsg && (
              <div style={{ fontSize: "0.85rem", color: batchSaveMsg.includes("Ошибка") ? "#ff4949" : "#4caf50", textAlign: "center", marginBottom: "1rem" }}>
                {batchSaveMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem" }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowBatchPtsModal(false)}
                style={{ flex: 1, padding: "0.75rem", borderRadius: "12px" }}
              >
                Отмена
              </button>
              <button 
                className="btn btn-glow-cyan" 
                onClick={async () => {
                  try {
                    setBatchSaveMsg("Сохранение данных игроков...");
                    const batchArray = Object.keys({ ...batchPtsMap, ...batchScoreMap }).map(nickname => ({
                      nickname,
                      csRating: batchPtsMap[nickname] !== undefined && batchPtsMap[nickname] !== "" ? Number(batchPtsMap[nickname]) : undefined,
                      customSkillScore: batchScoreMap[nickname] !== undefined && batchScoreMap[nickname] !== "" ? Number(batchScoreMap[nickname]) : undefined
                    }));

                    const res = await fetch("/api/admin/players/override", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        passcode: "sigmaadmin",
                        batchOverrides: batchArray
                      })
                    });

                    const data = await res.json();
                    if (res.ok && data.success) {
                      setBatchSaveMsg("Данные игроков успешно сохранены!");
                      fetchPlayerOverrides();
                      setTimeout(() => {
                        setShowBatchPtsModal(false);
                        setBatchSaveMsg("");
                      }, 1200);
                    } else {
                      setBatchSaveMsg(data.error || "Ошибка сохранения");
                    }
                  } catch (err: any) {
                    setBatchSaveMsg("Ошибка сети: " + err.message);
                  }
                }}
                style={{ flex: 1, padding: "0.75rem", borderRadius: "12px" }}
              >
                Сохранить все данные
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ONBOARDING TOUR MODAL */}
      {showTourModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.9)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          zIndex: 100000,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "1.5rem 1rem",
          overflowY: "auto"
        }}>
          <div className="glass-card animate-fade-in tour-modal-card" style={{
            border: "1px solid var(--border-light)",
            boxShadow: "0 20px 70px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 229, 255, 0.2)",
            position: "relative",
            background: "#0c0a17"
          }}>
            <span 
              className="modal-close-btn" 
              onClick={() => {
                localStorage.setItem("hasSeenSigmaTour", "true");
                setTourStep(0); setShowTourModal(false);
              }}
              style={{ top: "1.75rem", right: "1.75rem" }}
            >
              ✕
            </span>

            {tourStep === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center", alignItems: "center" }}>
                <h3 className="glow-text-cyan tour-modal-title">
                  Добро пожаловать в Сигма Кибер Клуб
                </h3>
                <p className="tour-modal-desc">
                  Статистика хаба в одном месте — без лишнего. Таблица лидеров, история матчей, Leetify AI и Captain's Draft. Всё то, чего не хватало стандартному FACEIT.
                </p>
                <div className="tour-modal-box">
                  <strong>Leaderboard:</strong> очки, процент побед, динамика по сезонам — сразу видно, кто реально тащит, а кто просто Саша.
                </div>
              </div>
            )}

            {tourStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center", alignItems: "center" }}>
                <h3 className="glow-text-cyan tour-modal-title">
                  Match History & 2D Playback
                </h3>
                <p className="tour-modal-desc">
                  В каждом матче — полный разбор по раундам на 2D-карте: куда шли, откуда убили, какое оружие использовали.
                </p>
                <div className="tour-modal-box">
                  <div><strong>2D Kill Feed:</strong> трассеры выстрелов, позиции на карте, headshot'ы и иконки оружия в реальных координатах</div>
                  <div><strong>Round-by-round stats:</strong> K/D, ADR, MVP, тепловая карта с подробным разбором каждого раунда по демо-видео и детальная таблица по каждому игроку</div>
                </div>
              </div>
            )}

            {tourStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center", alignItems: "center" }}>
                <h3 className="glow-text-cyan tour-modal-title">
                  Профили игроков
                </h3>
                <p className="tour-modal-desc">
                  Кликни на ник — откроется профиль со всей статистикой: FACEIT, Steam и Leetify AI в одном окне.
                </p>
                <div className="tour-modal-box">
                  <div><strong>FACEIT Stats:</strong> K/D, ADR, HS%, Win Rate по картам и динамика Elo</div>
                  <div><strong>Leetify AI:</strong> оценка прицеливания, позиционирования и полезности гранат</div>
                </div>
              </div>
            )}

            {tourStep === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center", alignItems: "center" }}>
                <h3 className="glow-text-cyan tour-modal-title">
                  Captain's Draft
                </h3>
                <p className="tour-modal-desc">
                  Делим на команды без споров — Snake Draft на 4 капитана с live-синхронизацией между устройствами.
                </p>
                <div className="tour-modal-box">
                  <div><strong>Snake Draft System:</strong> порядок пиков переключается автоматически, текущий ход подсвечивается</div>
                  <div><strong>Сохранение & экспорт:</strong> прогресс переживает F5, финальный состав скачивается в .txt</div>
                </div>
              </div>
            )}

            {tourStep === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center", alignItems: "center" }}>
                <h3 className="glow-text-cyan tour-modal-title">
                  Фильтры, сортировка & Сравнение
                </h3>
                <p className="tour-modal-desc">
                  Ищи по нику, фильтруй по минимуму матчей, сортируй по скиллу или Win Rate — и сравнивай двух игроков напрямую.
                </p>
                <div className="tour-modal-box">
                  <div><strong>Skill Rating (1–100):</strong> взвешенная оценка на основе совокупности показателей игрока.</div>
                  <div><strong>Сравнение:</strong> отдельная вкладка со сравнительной таблицей показателей двух игроков.</div>
                </div>
              </div>
            )}

            {tourStep === 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center", alignItems: "center" }}>
                <h3 className="glow-text-cyan tour-modal-title">
                  Fantasy League
                </h3>
                <p className="tour-modal-desc">
                  Интерактивная лига прогнозов на турниры Сигма Хаба. Собери команду из 3 игроков и соревнуйся за звание лучшего аналитика.
                </p>
                <div className="tour-modal-box">
                  <div><strong>Выберите 3 роли:</strong> Снайпер (фраги и первый килл), Саппорт (ассисты, гранаты и дефьюзы) и Темная лошадка (сбалансированный множитель очков).</div>
                  <div><strong>Автоматический подсчет:</strong> очки рассчитываются по реальной статистике матчей турнира.</div>
                  <div><strong>Награды:</strong> победитель получает официальный статус «Фантазер» и золотую рамку на сайте.</div>
                </div>
              </div>
            )}

            {/* 3D COVERFLOW PERSPECTIVE FOLDER CAROUSEL */}
            <div className="tour-modal-carousel">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const offset = idx - tourStep;
                const absOffset = Math.abs(offset);

                const is2K = typeof window !== 'undefined' && (window.innerWidth >= 2100 || (window.innerWidth >= 1600 && window.innerHeight >= 1081));
                let rotateY = 0;
                let translateX = is2K ? offset * 280 : offset * 200;
                let translateZ = is2K ? -absOffset * 220 : -absOffset * 150;
                let scale = is2K ? 1 - absOffset * 0.16 : 1 - absOffset * 0.14;
                let opacity = 1 - absOffset * 0.45;
                let zIndex = 10 - absOffset;

                if (offset < 0) {
                  rotateY = is2K ? 36 : 30;
                  translateX = is2K ? (offset * 260 - 80) : (offset * 190 - 50);
                } else if (offset > 0) {
                  rotateY = is2K ? -36 : -30;
                  translateX = is2K ? (offset * 260 + 80) : (offset * 190 + 50);
                }

                if (absOffset > 2) opacity = 0;

                return (
                  <div
                    key={idx}
                    onClick={() => setTourStep(idx)}
                    className="tour-modal-slide"
                    style={{
                      border: idx === tourStep ? "2.5px solid var(--accent-cyan)" : "1px solid rgba(255, 255, 255, 0.12)",
                      boxShadow: idx === tourStep ? "0 20px 60px rgba(0, 229, 255, 0.4)" : "0 15px 40px rgba(0, 0, 0, 0.8)",
                      transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                      transition: "all 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
                      opacity: opacity,
                      zIndex: zIndex
                    }}
                  >
                    <img
                      src={`/tour/slide${idx + 1}.webp`}
                      alt={`Слайд ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        filter: idx === tourStep ? "brightness(1.0) contrast(1.05)" : "brightness(0.4) contrast(1.1)"
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1rem",
              borderTop: "1px solid var(--border-light)",
              paddingTop: "1rem"
            }}>
              <div style={{ display: "flex", gap: "0.65rem" }}>
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <span 
                    key={idx}
                    onClick={() => setTourStep(idx)}
                    style={{
                      width: idx === tourStep ? "36px" : "12px",
                      height: "12px",
                      borderRadius: "6px",
                      background: idx === tourStep ? "var(--accent-cyan)" : "rgba(255,255,255,0.2)",
                      cursor: "pointer",
                      transition: "all 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                      boxShadow: idx === tourStep ? "0 0 12px rgba(0, 229, 255, 0.6)" : "none"
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                {tourStep > 0 && (
                  <button 
                    onClick={() => setTourStep(prev => prev - 1)}
                    className="btn btn-secondary"
                    style={{ padding: "0.75rem 1.75rem", fontSize: "0.85rem", borderRadius: "12px" }}
                  >
                    Назад
                  </button>
                )}

                {tourStep < 5 ? (
                  <button 
                    onClick={() => setTourStep(prev => prev + 1)}
                    className="btn btn-glow-cyan"
                    style={{ padding: "0.75rem 2.25rem", fontSize: "0.85rem", fontWeight: "800", borderRadius: "12px" }}
                  >
                    Далее
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      localStorage.setItem("hasSeenSigmaTour", "true");
                      setTourStep(0); setShowTourModal(false);
                    }}
                    className="btn btn-primary"
                    style={{
                      background: "linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))",
                      padding: "0.75rem 2.5rem",
                      fontSize: "1.05rem",
                      fontWeight: "900",
                      borderRadius: "12px",
                      boxShadow: "0 0 30px rgba(0, 229, 255, 0.5)"
                    }}
                  >
                    Начать работу
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4-CAPTAIN DRAFT SYSTEM MODAL */}
      {showDraftModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 100000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          overflowY: "auto"
        }}>
          <div className="glass-card animate-fade-in" style={{
            maxWidth: "1050px",
            width: "100%",
            margin: "auto",
            padding: "1.75rem",
            borderRadius: "20px",
            border: "1px solid var(--accent-cyan)",
            boxShadow: "0 0 40px rgba(0, 229, 255, 0.2)",
            maxHeight: "92vh",
            overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "1rem", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <h3 style={{ fontSize: "1.3rem", color: "#fff", fontWeight: "900", margin: 0 }}>
                    Captain's Draft
                  </h3>
                  <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem", borderRadius: "6px", background: "rgba(0, 229, 255, 0.15)", color: "var(--accent-cyan)", fontWeight: "800" }}>
                    ЛИМИТ: 300 ОЧКОВ СКИЛЛА (+- 10)
                  </span>
                </div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Пошаговый выбор игроков в реальном времени с балансировкой по очкам скилла
                </span>
              </div>
              <button 
                onClick={() => setShowDraftModal(false)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  color: "#fff",
                  padding: "0.4rem 0.8rem",
                  cursor: "pointer",
                  fontSize: "0.8rem"
                }}
              >
                Закрыть ✕
              </button>
            </div>

            {draftStep === "setup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div>
                  <h4 style={{ color: "var(--accent-cyan)", fontSize: "0.95rem", marginBottom: "0.75rem", fontWeight: "800" }}>
                    1. Укажите никнеймы 4 Капитанов:
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem" }}>
                    {[0, 1, 2, 3].map((idx) => {
                      const capName = draftCaptains[idx] || "";
                      const capSkill = capName ? getPlayerSkillNumber(capName) : 50;
                      return (
                        <div key={idx} className="input-group">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>
                              Капитан {idx + 1}
                            </label>
                            {capName && (
                              <span style={{ fontSize: "0.7rem", color: "#ffd54f", fontWeight: "700" }}>
                                {capSkill} очков Скилла
                              </span>
                            )}
                          </div>
                          <input 
                            type="text"
                            className="input-field"
                            value={draftCaptains[idx]}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftCaptains(prev => {
                                const next = [...prev] as [string, string, string, string];
                                next[idx] = val;
                                return next;
                              });
                            }}
                            placeholder={`Капитан ${idx + 1}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <h4 style={{ color: "var(--accent-cyan)", fontSize: "0.95rem", fontWeight: "800", margin: 0 }}>
                      2. Пул доступных игроков:
                    </h4>
                    {members.length > 0 && (
                      <button
                        onClick={() => {
                          setDraftPoolInput(members.map(m => m.nickname).join("\n"));
                        }}
                        style={{
                          background: "rgba(0, 229, 255, 0.1)",
                          border: "1px solid rgba(0, 229, 255, 0.3)",
                          borderRadius: "6px",
                          color: "var(--accent-cyan)",
                          padding: "0.25rem 0.6rem",
                          fontSize: "0.75rem",
                          cursor: "pointer"
                        }}
                      >
                        Загрузить из участников хаба ({members.length})
                      </button>
                    )}
                  </div>
                  <textarea 
                    rows={6}
                    className="input-field"
                    style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem", resize: "vertical" }}
                    placeholder="Вставьте никнеймы игроков по одному на строку..."
                    value={draftPoolInput}
                    onChange={(e) => setDraftPoolInput(e.target.value)}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                    Капитаны исключаются из общего пула выбора автоматически. Максимальный бюджет каждой команды — 300 очков Скилла (+- 10 очков).
                  </span>
                </div>

                <button 
                  onClick={startDraftSetup}
                  style={{
                    background: "linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))",
                    border: "none",
                    borderRadius: "10px",
                    padding: "0.85rem",
                    color: "#fff",
                    fontSize: "0.95rem",
                    fontWeight: "900",
                    cursor: "pointer",
                    boxShadow: "0 0 20px rgba(0, 229, 255, 0.3)",
                    marginTop: "0.5rem"
                  }}
                >
                  Начать Драфт
                </button>
              </div>
            )}

            {(draftStep === "picking" || draftStep === "finished") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {draftStep === "picking" && (
                  <div style={{
                    background: "linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(124, 77, 255, 0.15))",
                    border: "1.5px solid var(--accent-cyan)",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 0 20px rgba(0, 229, 255, 0.2)",
                    flexWrap: "wrap",
                    gap: "0.75rem"
                  }}>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.05em" }}>
                        Текущий ход (Snake Draft #{draftCurrentStepIndex + 1} из 16)
                      </span>
                      <div style={{ fontSize: "1.2rem", fontWeight: "900", color: "#fff", marginTop: "0.1rem" }}>
                        Выбирает: <span style={{ color: "var(--accent-cyan)" }}>{draftCaptains[draftTurnSequence[draftCurrentStepIndex]]}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", background: "rgba(0,0,0,0.3)", padding: "0.4rem 0.8rem", borderRadius: "8px" }}>
                      Осталось в пуле: <strong style={{ color: "#fff" }}>{draftAvailablePlayers.length}</strong> игроков
                    </div>
                  </div>
                )}

                {/* Error Banner when pick exceeds budget */}
                {draftErrorMsg && (
                  <div style={{
                    background: "rgba(255, 82, 82, 0.15)",
                    border: "1.5px solid #ff5252",
                    borderRadius: "10px",
                    padding: "0.75rem 1.25rem",
                    color: "#ff8a80",
                    fontWeight: "800",
                    fontSize: "0.85rem",
                    textAlign: "center"
                  }}>
                    {draftErrorMsg}
                  </div>
                )}

                {/* 4 TEAMS ROSTER WITH SKILL POINTS BUDGET */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1rem" }}>
                  {draftCaptains.map((cap, cIdx) => {
                    const isMyTurn = draftStep === "picking" && draftTurnSequence[draftCurrentStepIndex] === cIdx;
                    const roster = draftTeams[cIdx] || [];
                    const teamPts = roster.reduce((sum, pName) => sum + getPlayerSkillNumber(pName), 0);
                    const remainingPts = 300 - teamPts;
                    const isOverLimit = teamPts > 310;
                    const isUnderLimit = roster.length === 5 && teamPts < 290;
                    const isBalanced = roster.length === 5 && teamPts >= 290 && teamPts <= 310;

                    let roomLabel = "";
                    if (draftRoomAssignment) {
                      if (draftRoomAssignment.vip.includes(cIdx)) roomLabel = "ВИП-ЗАЛ";
                      if (draftRoomAssignment.main.includes(cIdx)) roomLabel = "ОБЩИЙ ЗАЛ";
                    }

                    return (
                      <div 
                        key={cIdx} 
                        style={{
                          background: isMyTurn ? "rgba(0, 229, 255, 0.08)" : "rgba(255,255,255,0.02)",
                          border: isMyTurn ? "2px solid var(--accent-cyan)" : roomLabel === "ВИП-ЗАЛ" ? "1.5px solid #ffd700" : "1px solid var(--border-light)",
                          borderRadius: "14px",
                          padding: "1.1rem",
                          boxShadow: isMyTurn ? "0 0 20px rgba(0, 229, 255, 0.25)" : roomLabel === "ВИП-ЗАЛ" ? "0 0 15px rgba(255, 215, 0, 0.2)" : "none",
                          transition: "all 0.2s"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                          <span style={{ fontWeight: "900", fontSize: "0.95rem", color: isMyTurn ? "var(--accent-cyan)" : "#fff" }}>
                            Команда {cIdx + 1}
                          </span>
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            {roomLabel && (
                              <span style={{ fontSize: "0.65rem", background: roomLabel === "ВИП-ЗАЛ" ? "linear-gradient(135deg, #ffd700, #ff9100)" : "rgba(0, 229, 255, 0.2)", color: roomLabel === "ВИП-ЗАЛ" ? "#000" : "var(--accent-cyan)", padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: "900" }}>
                                {roomLabel}
                              </span>
                            )}
                            {isMyTurn && <span style={{ fontSize: "0.6rem", background: "var(--accent-cyan)", color: "#000", padding: "0.15rem 0.4rem", borderRadius: "3px", fontWeight: "900" }}>ХОД</span>}
                          </div>
                        </div>

                        {/* Skill Tracker Header */}
                        <div style={{ background: "rgba(0,0,0,0.35)", padding: "0.5rem 0.75rem", borderRadius: "8px", marginBottom: "0.75rem", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
                            <span style={{ color: "var(--text-secondary)" }}>Сумма очков:</span>
                            <strong style={{ color: isOverLimit ? "#ff5252" : isBalanced ? "#00e676" : "#fff", fontSize: "0.85rem" }}>
                              {teamPts} / 300
                            </strong>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                            <span style={{ color: "var(--text-muted)" }}>Осталось:</span>
                            <span style={{ color: remainingPts < -10 ? "#ff5252" : remainingPts < 0 ? "#ffb74d" : "var(--accent-cyan)", fontWeight: "700" }}>
                              {remainingPts >= 0 ? `${remainingPts} очков` : `Перебор: +${Math.abs(remainingPts)} очков`}
                            </span>
                          </div>
                          {isBalanced && (
                            <div style={{ fontSize: "0.68rem", color: "#00e676", fontWeight: "800", marginTop: "0.25rem", textAlign: "center" }}>
                              Баланс соблюден
                            </div>
                          )}
                          {isOverLimit && (
                            <div style={{ fontSize: "0.68rem", color: "#ff5252", fontWeight: "800", marginTop: "0.25rem", textAlign: "center" }}>
                              Превышен лимит очков Скилла
                            </div>
                          )}
                          {isUnderLimit && (
                            <div style={{ fontSize: "0.68rem", color: "#ffb74d", fontWeight: "800", marginTop: "0.25rem", textAlign: "center" }}>
                              Недобор очков Скилла
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minHeight: "140px" }}>
                          {roster.map((player, pIdx) => {
                            const pSkill = getPlayerSkillNumber(player);
                            return (
                              <div 
                                key={pIdx} 
                                style={{
                                  padding: "0.4rem 0.6rem",
                                  background: pIdx === 0 ? "rgba(255, 213, 79, 0.12)" : "rgba(255,255,255,0.04)",
                                  border: pIdx === 0 ? "1px solid rgba(255, 213, 79, 0.3)" : "1px solid rgba(255,255,255,0.05)",
                                  borderRadius: "6px",
                                  fontSize: "0.8rem",
                                  color: pIdx === 0 ? "#ffd54f" : "#fff",
                                  fontWeight: pIdx === 0 ? "700" : "500",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px" }}>
                                  {pIdx + 1}. {player} {pIdx === 0 && <span style={{ fontSize: "0.6rem", opacity: 0.85 }}>[КЭП]</span>}
                                </span>
                                <span style={{ fontSize: "0.72rem", fontWeight: "800", padding: "0.1rem 0.35rem", borderRadius: "4px", background: "rgba(255,255,255,0.08)", color: pSkill >= 80 ? "#c084fc" : pSkill >= 60 ? "var(--accent-cyan)" : "#fff" }}>
                                  {pSkill} очков
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AVAILABLE PLAYERS POOL WITH SKILL POINTS */}
                {draftStep === "picking" && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <h4 style={{ color: "#fff", fontSize: "0.95rem", fontWeight: "800", margin: 0 }}>
                        Доступные игроки для выбора:
                      </h4>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Нажмите «Пикнуть» для выбора игрока в текущую команду
                      </span>
                    </div>

                    {draftAvailablePlayers.length === 0 ? (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Все игроки выбраны.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: "0.6rem", maxHeight: "260px", overflowY: "auto", padding: "0.25rem" }}>
                        {[...draftAvailablePlayers].sort((a, b) => getPlayerSkillNumber(b) - getPlayerSkillNumber(a)).map((pName) => {
                          const pSkill = getPlayerSkillNumber(pName);
                          const activeCapIdx = draftTurnSequence[draftCurrentStepIndex];
                          const currentRoster = draftTeams[activeCapIdx] || [];
                          const currentTeamPts = currentRoster.reduce((sum, p) => sum + getPlayerSkillNumber(p), 0);
                          const wouldExceedLimit = currentTeamPts + pSkill > 310;

                          return (
                            <div 
                              key={pName} 
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: wouldExceedLimit ? "rgba(255, 82, 82, 0.04)" : "rgba(255,255,255,0.03)",
                                border: wouldExceedLimit ? "1px solid rgba(255, 82, 82, 0.3)" : "1px solid var(--border-light)",
                                borderRadius: "8px",
                                padding: "0.5rem 0.75rem",
                                opacity: wouldExceedLimit ? 0.6 : 1.0,
                                transition: "all 0.2s"
                              }}
                            >
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "90px" }}>
                                <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#fff" }}>
                                  {pName}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: wouldExceedLimit ? "#ff8a80" : pSkill >= 80 ? "#c084fc" : pSkill >= 60 ? "var(--accent-cyan)" : "var(--text-muted)", fontWeight: "800" }}>
                                  {pSkill} очков
                                </div>
                              </div>
                              <button 
                                onClick={() => handlePickPlayer(pName)}
                                disabled={wouldExceedLimit}
                                style={{
                                  background: wouldExceedLimit ? "rgba(255,255,255,0.08)" : "var(--accent-cyan)",
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "0.3rem 0.6rem",
                                  color: wouldExceedLimit ? "var(--text-muted)" : "#000",
                                  fontSize: "0.72rem",
                                  fontWeight: "800",
                                  cursor: wouldExceedLimit ? "not-allowed" : "pointer"
                                }}
                              >
                                {wouldExceedLimit ? "Лимит" : "Пикнуть"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* FINISHED STAGE: ROOM ROLL SYSTEM (VIP vs MAIN HALL) */}
                {draftStep === "finished" && (
                  <div style={{
                    background: "linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(12, 10, 23, 0.95) 100%)",
                    border: "1.5px solid var(--success)",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
                          Драфт успешно завершен
                        </span>
                        <div style={{ fontSize: "1.2rem", fontWeight: "900", color: "#fff", marginTop: "0.1rem" }}>
                          Все 4 команды укомплектованы по 5 игроков
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                        <button 
                          onClick={handleRollRooms}
                          disabled={isRollingRooms}
                          style={{
                            background: isRollingRooms ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #ffd700, #ff9100)",
                            border: "none",
                            borderRadius: "10px",
                            padding: "0.65rem 1.25rem",
                            color: "#000",
                            fontWeight: "900",
                            fontSize: "0.85rem",
                            cursor: isRollingRooms ? "not-allowed" : "pointer",
                            boxShadow: "0 0 20px rgba(255, 215, 0, 0.4)",
                            transition: "all 0.2s"
                          }}
                        >
                          {isRollingRooms ? "Идет розыгрыш..." : draftRoomAssignment ? "Переиграть игровые зоны" : "Разыграть игровые зоны (VIP / Общий зал)"}
                        </button>

                        <button 
                          onClick={downloadDraftResultsFile}
                          style={{
                            background: "var(--success)",
                            border: "none",
                            borderRadius: "10px",
                            padding: "0.65rem 1.25rem",
                            color: "#000",
                            fontWeight: "900",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            boxShadow: "0 0 15px rgba(0, 230, 118, 0.4)"
                          }}
                        >
                          Скачать файл команд (.txt)
                        </button>
                      </div>
                    </div>

                    {/* Room Allocation Result Cards */}
                    {draftRoomAssignment && (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "1rem",
                        paddingTop: "0.5rem"
                      }}>
                        {/* VIP ROOM */}
                        <div style={{
                          background: "linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(20, 15, 5, 0.9) 100%)",
                          border: "1.5px solid rgba(255, 215, 0, 0.5)",
                          borderRadius: "12px",
                          padding: "1.25rem",
                          boxShadow: "0 0 25px rgba(255, 215, 0, 0.15)"
                        }}>
                          <div style={{ fontSize: "0.75rem", color: "#ffd700", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.5rem" }}>
                            ИГРОВАЯ ЗОНА: ВИП-ЗАЛ (2 КОМАНДЫ)
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {draftRoomAssignment.vip.map((teamIdx) => {
                              const roster = draftTeams[teamIdx] || [];
                              const teamPts = roster.reduce((s, p) => s + getPlayerSkillNumber(p), 0);
                              return (
                                <div key={teamIdx} style={{ background: "rgba(0,0,0,0.4)", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(255, 215, 0, 0.2)" }}>
                                  <div style={{ fontWeight: "800", color: "#fff", fontSize: "0.9rem" }}>
                                    Команда {teamIdx + 1} ({draftCaptains[teamIdx]})
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                                    Сумма: <strong style={{ color: "#ffd700" }}>{teamPts} очков Скилла</strong> | Состав: {roster.join(", ")}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* MAIN HALL */}
                        <div style={{
                          background: "linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(5, 15, 25, 0.9) 100%)",
                          border: "1.5px solid rgba(0, 229, 255, 0.4)",
                          borderRadius: "12px",
                          padding: "1.25rem",
                          boxShadow: "0 0 25px rgba(0, 229, 255, 0.15)"
                        }}>
                          <div style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.5rem" }}>
                            ИГРОВАЯ ЗОНА: ОБЩИЙ ЗАЛ (2 КОМАНДЫ)
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {draftRoomAssignment.main.map((teamIdx) => {
                              const roster = draftTeams[teamIdx] || [];
                              const teamPts = roster.reduce((s, p) => s + getPlayerSkillNumber(p), 0);
                              return (
                                <div key={teamIdx} style={{ background: "rgba(0,0,0,0.4)", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(0, 229, 255, 0.2)" }}>
                                  <div style={{ fontWeight: "800", color: "#fff", fontSize: "0.9rem" }}>
                                    Команда {teamIdx + 1} ({draftCaptains[teamIdx]})
                                  </div>
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                                    Сумма: <strong style={{ color: "var(--accent-cyan)" }}>{teamPts} очков Скилла</strong> | Состав: {roster.join(", ")}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-light)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                  <button 
                    onClick={handleResetDraft}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "8px",
                      padding: "0.45rem 0.9rem",
                      color: "var(--text-secondary)",
                      fontSize: "0.8rem",
                      cursor: "pointer"
                    }}
                  >
                    Сбросить драфт
                  </button>

                  <button 
                    onClick={downloadDraftResultsFile}
                    style={{
                      background: "rgba(0, 229, 255, 0.15)",
                      border: "1px solid var(--accent-cyan)",
                      borderRadius: "8px",
                      padding: "0.45rem 1rem",
                      color: "#fff",
                      fontSize: "0.82rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem"
                    }}
                  >
                    Скачать файл (.txt)
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Pulse Animation Keyframes */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .hover-underline:hover {
          text-decoration: underline;
        }
      `}</style>

      </div>
    </>
  );
}
