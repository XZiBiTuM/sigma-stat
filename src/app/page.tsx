"use client";

import React, { useState, useEffect, useTransition, Component, ReactNode } from "react";
import Image from "next/image";

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
}

interface PlayerGameStats {
  lifetime: {
    Matches: string;
    "Average K/D Ratio": string;
    "Win Rate %": string;
    "Average Headshots %": string;
    "Longest Win Streak": string;
    "Current Win Streak"?: string;
  };
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
  const [activeTab, setActiveTab] = useState<"leaderboard" | "matches" | "members" | "tournaments">("leaderboard");
  
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
  const [roundHistory, setRoundHistory] = useState<any>(null);
  const [isLoadingRoundHistory, setIsLoadingRoundHistory] = useState(false);
  const [manualDemoUrl, setManualDemoUrl] = useState("");
  const [isSubmittingDemoUrl, setIsSubmittingDemoUrl] = useState(false);

  // Modal: Player details
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerGameStats, setPlayerGameStats] = useState<PlayerGameStats | null>(null);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);

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

        // Fetch Hub Leaderboards
        const leaderboardsRes = await fetch(`/api/faceit/hubs/${hubId}/leaderboards`);
        let finalLeaderboards = [{ leaderboard_id: "general", leaderboard_name: "Общий рейтинг (All-time)", status: "ACTIVE" }];
        if (leaderboardsRes.ok) {
          const lbData = await leaderboardsRes.json();
          const items = lbData.items || [];
          finalLeaderboards = [...items, ...finalLeaderboards];
        }
        setLeaderboards(finalLeaderboards);
        setSelectedLeaderboardId(finalLeaderboards[0].leaderboard_id);

        // Fetch Hub Members
        const membersRes = await fetch(`/api/faceit/hubs/${hubId}/members`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData.items || []);
        }

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

  // Fetch match details modal stats
  const loadMatchDetails = async (matchId: string) => {
    setSelectedMatchId(matchId);
    setIsLoadingMatchDetails(true);
    setMatchDetails(null);
    setRoundHistory(null);
    setIsLoadingRoundHistory(true);
    setManualDemoUrl("");
    
    try {
      const res = await fetch(`/api/faceit/matches/${matchId}/stats`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ошибка загрузки статистики");
      }
      const data = await res.json();
      setMatchDetails(data.rounds || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingMatchDetails(false);
    }

    try {
      const res = await fetch(`/api/faceit/matches/${matchId}/round-history`);
      if (res.ok) {
        const data = await res.json();
        setRoundHistory(data);
      }
    } catch (err) {
      console.error("Failed to load round history", err);
    } finally {
      setIsLoadingRoundHistory(false);
    }
  };

  const submitManualDemoUrl = async (url: string) => {
    if (!selectedMatchId || !url.trim()) return;
    setIsSubmittingDemoUrl(true);
    setRoundHistory(null);
    setIsLoadingRoundHistory(true);
    try {
      const res = await fetch(`/api/faceit/matches/${selectedMatchId}/round-history?demoUrl=${encodeURIComponent(url.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setRoundHistory(data);
        setManualDemoUrl("");
      } else {
        alert("Не удалось спарсить демку по этой ссылке. Пожалуйста, проверьте ссылку.");
      }
    } catch (err) {
      console.error("Failed to load manual round history", err);
      alert("Произошла ошибка при загрузке демки.");
    } finally {
      setIsSubmittingDemoUrl(false);
      setIsLoadingRoundHistory(false);
    }
  };

  // Fetch player details modal stats
  const loadPlayerDetails = async (playerId: string) => {
    setSelectedPlayerId(playerId);
    setIsLoadingPlayer(true);
    setPlayerProfile(null);
    setPlayerGameStats(null);
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

  // Filters for client-side lists
  const filteredRankings = rankings.filter((item) => {
    const playerInfo = item.player || (item as any).user;
    const nickname = playerInfo?.nickname || "";
    return nickname.toLowerCase().includes(playerSearchQuery.toLowerCase());
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
    return clean;
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
      <div className="container animate-fade-in">
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
              fontWeight: "800"
            }}>
              Сигма Кибер Арена
            </span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: "600" }}>
            Дорога в киберспорт закрыта!
          </p>
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
            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "var(--text-secondary)" }}>Быстрый выбор для тестирования:</h3>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
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
                  {hubDetails.description || "Описание отсутствует."}
                </p>
              </div>

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
                  {Math.max(hubDetails.players_number ?? 0, members.length).toLocaleString("ru-RU")}
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
                  Таблица лидеров
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                  onClick={() => setActiveTab('matches')}
                >
                  История игр
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
                  onClick={() => setActiveTab('members')}
                >
                  Участники ({members.length})
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'tournaments' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tournaments')}
                >
                  Турниры ({tournaments.length || "…"})
                </button>
              </div>



              {/* TAB CONTENT: LEADERBOARD */}
              {activeTab === 'leaderboard' && (
                <div className="glass-card animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  {/* Search and Filters */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div className="input-group" style={{ maxWidth: "350px" }}>
                      <input
                        type="text"
                        placeholder="Поиск игрока по никнейму…"
                        className="input-field"
                        value={playerSearchQuery}
                        onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      />
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      Показано игроков: {filteredRankings.length}
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
                            <th style={{ width: "70px", textAlign: "center" }}>Место</th>
                            <th>Игрок</th>
                            <th style={{ textAlign: "center" }}>Очки</th>
                            <th style={{ textAlign: "center" }}>Матчи</th>
                            <th style={{ textAlign: "center" }}>В / П</th>
                            <th style={{ textAlign: "center" }}>Win Rate</th>
                            <th style={{ textAlign: "center" }}>Стрик</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRankings.map((item) => {
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

                            return (
                              <tr key={playerId}>
                                <td style={{ textAlign: "center", fontWeight: "700", color: item.position <= 3 ? "var(--accent-cyan)" : "var(--text-primary)" }}>
                                  {item.position === 1 && <span className="rank-badge gold">1</span>}
                                  {item.position === 2 && <span className="rank-badge silver">2</span>}
                                  {item.position === 3 && <span className="rank-badge bronze">3</span>}
                                  {item.position > 3 && item.position}
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
                                  </div>
                                </td>
                                <td style={{ textAlign: "center", fontWeight: "700", color: "#fff" }}>
                                  {points}
                                </td>
                                <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                                  {played}
                                </td>
                                <td style={{ textAlign: "center", fontSize: "0.85rem" }}>
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

                  {isLoadingMatches ? (
                    <div style={{ textAlign: "center", padding: "3rem" }}>
                      <div className="glow-text-cyan" style={{ fontSize: "1.2rem" }}>Загрузка истории матчей...</div>
                    </div>
                  ) : filteredMatches.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)", border: "1px dashed var(--border-light)", borderRadius: "12px" }}>
                      Матчи в данной категории отсутствуют.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {filteredMatches.map((match) => {
                        const isFinished = match.status === "FINISHED";
                        const isLive = match.status === "ONGOING" || match.status === "LIVE";
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
                              padding: "1.25rem",
                              borderLeft: isLive ? "4px solid var(--accent-cyan)" : isFinished ? "1px solid var(--border-light)" : "4px solid var(--danger)",
                              flexWrap: "wrap",
                              gap: "1rem",
                              position: "relative",
                              overflow: "hidden"
                            }}
                          >
                            {/* Dynamic Maps Background */}
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: "hidden", borderRadius: "inherit" }}>
                              {matchMaps.length > 1 ? (
                                <>
                                  <div style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    background: `url(/maps/${getMapFileName(matchMaps[0])}.webp) center/cover no-repeat, var(--bg-card)`,
                                    clipPath: "polygon(0 0, 52% 0, 48% 100%, 0 100%)"
                                  }} />
                                  <div style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    background: `url(/maps/${getMapFileName(matchMaps[1])}.webp) center/cover no-repeat, var(--bg-card)`,
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
                                  background: `url(/maps/${getMapFileName(matchMaps[0])}.webp) center/cover no-repeat, var(--bg-card)`
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
                                <span style={{ color: "var(--text-muted)", fontSize: "1rem" }}>:</span>
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
                  <h3 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "0.5rem" }}>
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
                                  <span className="badge badge-danger" style={{ fontSize: "0.6rem", padding: "0.05rem 0.3rem", background: "rgba(255, 23, 68, 0.15)", border: "1px solid var(--danger)", color: "var(--danger)" }}>Не игрок</span>
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
                                    🗺 САМАЯ ПОПУЛЯРНАЯ КАРТА
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
                          <h4 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "1rem" }}>
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
                          <h4 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "1rem" }}>
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
                                          background: `url(/maps/${getMapFileName(tMatchMaps[0])}.webp) center/cover no-repeat, var(--bg-card)`,
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

            </div>

          </div>

        </div>
      )}
    </div>

      {/* MODAL: MATCH DETAILS STATS */}
      {selectedMatchId && (
        <div className="modal-overlay" onClick={() => setSelectedMatchId(null)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ padding: "2rem" }}>
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
                                fontSize: "1.1rem",
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
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{mvpAdr} СУ/Р</div>
                                  <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>Всего: {mvpPlayer.player_stats?.Damage || "0"}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>HS</div>
                                  <div style={{ fontWeight: "700", color: "var(--accent-cyan)", fontSize: "0.9rem" }}>{mvpHsPercent}%</div>
                                  <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>Кол-во: {mvpPlayer.player_stats?.Headshots || "0"}</div>
                                </div>

                                {/* Row 2: Performance */}
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>MULTIKILLS</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.85rem", marginTop: "0.1rem" }}>
                                    {doubleK + tripleK + quadK + pentaK > 0 ? (
                                      <span>{doubleK + tripleK + quadK + pentaK} раунд.</span>
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
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{entryKills} entry</div>
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
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{flashedEnemies} чел.</div>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>Флешек: {mvpPlayer.player_stats?.["Flash Count"] || "0"}</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)" }}>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Из снайперских винтовок</div>
                                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>{sniperKills} убийств</div>
                                  <div style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>Снайп-рейт: {Math.round(parseFloat(mvpPlayer.player_stats?.["Sniper Kill Rate per Match"] || "0") * 100)}%</div>
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
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "1rem" }}>
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
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "1rem" }}>
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
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "1rem" }}>
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
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "1rem" }}>
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
                                  <div style={{ fontWeight: "800", color: "var(--accent-cyan)", fontSize: "1rem" }}>
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

                        // Helper to get emoji/icon for win reason
                        const getReasonIcon = (reason: string) => {
                          switch (reason) {
                            case "bomb_exploded": return "💣";
                            case "bomb_defused": return "🛡️";
                            case "time_expired": return "⏱️";
                            default: return "💀";
                          }
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
                                ⚙️ Скачивание и анализ записи игры (демки) с FACEIT...
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
                                🛡️ Ход матча по раундам недоступен автоматически
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
                                  ❌ Ошибка анализа: {roundHistory.error || "Не удалось скачать или распаковать демку."}
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
                                  onClick={() => submitManualDemoUrl(manualDemoUrl)}
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
                                        title={`Раунд ${r.round}: победили ${teamLabel}\nСпособ: ${getReasonTooltip(r.reason, r.winner)}`}
                                        style={{
                                          width: "36px",
                                          height: "36px",
                                          borderRadius: "6px",
                                          background: winnerBg,
                                          border: `1px solid ${winnerBorder}`,
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          position: "relative",
                                          cursor: "help",
                                          boxShadow: `0 0 6px ${isCTWinner ? "rgba(0,184,212,0.05)" : "rgba(255,61,0,0.05)"}`
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
                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <span style={{ color: "rgba(0, 184, 212, 1)" }}>●</span> Спецназ (CT)
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <span style={{ color: "rgba(255, 61, 0, 1)" }}>●</span> Террористы (T)
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                  <span>💀 Убийства</span>
                                  <span>💣 Взрыв</span>
                                  <span>🛡️ Дефуз</span>
                                  <span>⏱️ Время</span>
                                </div>
                              </div>
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
                                    <th style={{ textAlign: "center" }}>СУ/Р</th>
                                    <th style={{ textAlign: "center" }}>HS%</th>
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
        <div className="modal-overlay" onClick={() => setSelectedPlayerId(null)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px", padding: "2rem" }}>
            <span className="modal-close-btn" onClick={() => setSelectedPlayerId(null)}>✕</span>
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
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "1.25rem" }}>
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
                    {playerProfile.country && (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.15rem" }}>
                        Страна: {playerProfile.country.toUpperCase()}
                      </p>
                    )}
                  </div>

                  {/* Level and Elo display */}
                  {(() => {
                    const gameId = hubDetails?.game_id || "cs2";
                    const gameInfo = playerProfile.games?.[gameId];
                    if (!gameInfo) return null;
                    return (
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>ELO</span>
                          <span style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem" }}>{gameInfo.faceit_elo}</span>
                        </div>
                        <div style={getLevelBadgeStyle(gameInfo.skill_level)}>
                          {gameInfo.skill_level}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Lifetime Hub / Game Stats */}
                <div>
                  <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#fff" }}>
                    Общая статистика ({hubDetails?.game_id.toUpperCase()})
                  </h3>

                  {!playerGameStats ? (
                    <div style={{
                      padding: "1.5rem",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      background: "rgba(0,0,0,0.15)",
                      borderRadius: "10px",
                      border: "1px dashed var(--border-light)",
                      fontSize: "0.85rem"
                    }}>
                      Игрок еще не сыграл ни одного матча в этой дисциплине или его статистика приватна.
                    </div>
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "0.75rem"
                    }}>
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.75rem 1rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Всего матчей</span>
                        <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "#fff", marginTop: "0.15rem" }}>
                          {playerGameStats.lifetime.Matches}
                        </div>
                      </div>

                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.75rem 1rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Процент побед</span>
                        <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--success)", marginTop: "0.15rem" }}>
                          {playerGameStats.lifetime["Win Rate %"]}%
                        </div>
                      </div>

                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.75rem 1rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Средний K/D</span>
                        <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--accent-cyan)", marginTop: "0.15rem" }}>
                          {parseFloat(playerGameStats.lifetime["Average K/D Ratio"]).toFixed(2)}
                        </div>
                      </div>

                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "0.75rem 1rem" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Средний хэдшот</span>
                        <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "#fff", marginTop: "0.15rem" }}>
                          {playerGameStats.lifetime["Average Headshots %"]}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <a
                    href={`https://www.faceit.com/ru/players/${playerProfile.nickname}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ width: "100%", padding: "0.65rem 1rem", fontSize: "0.9rem" }}
                  >
                    Открыть полный профиль на FACEIT
                  </a>
                </div>

              </div>
            )}
            </ErrorBoundary>
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

    </>
  );
}
