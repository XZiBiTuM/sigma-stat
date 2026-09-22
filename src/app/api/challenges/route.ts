import { NextRequest, NextResponse } from "next/server";
import {
  readWeeklyChallengesState,
  getUserWeeklyChallenges,
  verifyUserCombatChallenges
} from "@/lib/challenges";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getUserIdentifiersFromRequest(request: NextRequest): {
  userId: string;
  nickname: string;
  allKeys: string[];
  isAuthenticated: boolean;
} {
  const sessionCookie = request.cookies.get("sigma_user_session")?.value;
  if (!sessionCookie) {
    return {
      userId: "guest",
      nickname: "Гость",
      allKeys: ["guest"],
      isAuthenticated: false
    };
  }

  try {
    const decoded = Buffer.from(sessionCookie, "base64").toString("utf8");
    const session = JSON.parse(decoded);
    const steamId = session.steamId || "";
    const faceitId = session.faceit?.playerId || "";
    const nick = session.faceit?.nickname || session.steamName || "";

    const keys = [faceitId, steamId, nick].filter(Boolean);
    return {
      userId: faceitId || steamId || nick || "guest",
      nickname: nick || "Боец",
      allKeys: keys.length > 0 ? keys : ["guest"],
      isAuthenticated: true
    };
  } catch {
    return {
      userId: "guest",
      nickname: "Гость",
      allKeys: ["guest"],
      isAuthenticated: false
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const state = readWeeklyChallengesState();
    const user = getUserIdentifiersFromRequest(request);

    const challenges = getUserWeeklyChallenges(user.userId, state);
    const balance = (user.isAuthenticated && state.tokenBalances[user.userId.toLowerCase()]) || 0;

    return NextResponse.json({
      success: true,
      weekId: state.weekId,
      weekStart: state.weekStart,
      weekEnd: state.weekEnd,
      isCombatWeek: state.isCombatWeek,
      tournamentTitle: state.tournamentTitle,
      tournamentDate: state.tournamentDate,
      isAuthenticated: user.isAuthenticated,
      userNickname: user.nickname,
      tokensBalance: balance,
      challenges
    });
  } catch (error: any) {
    console.error("Error in challenges GET:", error);
    return NextResponse.json({ error: error.message || "Failed to load challenges" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserIdentifiersFromRequest(request);
    if (!user.isAuthenticated) {
      return NextResponse.json(
        { error: "Для проверки выполнения и получения жетонов необходима авторизация через Steam!" },
        { status: 401 }
      );
    }

    const state = readWeeklyChallengesState();
    const result = verifyUserCombatChallenges(user.allKeys, state);
    const balance = state.tokenBalances[user.userId.toLowerCase()] || 0;

    return NextResponse.json({
      success: true,
      tokensBalance: balance,
      tokensAwarded: result.tokensAwarded,
      message: result.message,
      challenges: result.updatedChallenges
    });
  } catch (error: any) {
    console.error("Error in challenges POST:", error);
    return NextResponse.json({ error: error.message || "Failed to verify challenges" }, { status: 500 });
  }
}
