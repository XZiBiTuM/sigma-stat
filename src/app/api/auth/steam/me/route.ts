export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/faceit";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("sigma_user_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const decodedStr = Buffer.from(sessionCookie, "base64").toString("utf8");
    const session = JSON.parse(decodedStr);

    // Dynamically refresh live Faceit Elo and Avatar if linked
    if (session.faceit?.playerId) {
      try {
        const liveProfile = await getPlayerProfile(session.faceit.playerId);
        if (liveProfile) {
          const liveElo = liveProfile.games?.cs2?.faceit_elo || liveProfile.games?.csgo?.faceit_elo;
          if (liveElo) {
            session.faceit.elo = liveElo;
          }
          if (liveProfile.games?.cs2?.skill_level) {
            session.faceit.skillLevel = liveProfile.games.cs2.skill_level;
          }
          if (liveProfile.avatar) {
            session.faceit.avatar = liveProfile.avatar;
          }
          if (liveProfile.nickname) {
            session.faceit.nickname = liveProfile.nickname;
          }
        }
      } catch (err) {
        console.warn("Could not refresh live Faceit data in session:", err);
      }
    }

    const response = NextResponse.json(
      { authenticated: true, user: session },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );

    // Update cookie with refreshed session
    try {
      const updatedCookieValue = Buffer.from(JSON.stringify(session)).toString("base64");
      response.cookies.set("sigma_user_session", updatedCookieValue, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax"
      });
    } catch {}

    return response;
  } catch (e: any) {
    return NextResponse.json({ authenticated: false, user: null, error: e.message });
  }
}
