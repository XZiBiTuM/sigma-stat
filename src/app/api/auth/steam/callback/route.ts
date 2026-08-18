import { NextRequest, NextResponse } from "next/server";

const STEAM_API_KEY = process.env.STEAM_API_KEY || "15536CB4CFFE33DA56F57B1F3CF07CCF";
const FACEIT_API_KEY = process.env.FACEIT_API_KEY || "53114c9e-8287-4b6b-a31e-9c2923eb01d7";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const claimedId = searchParams.get("openid.claimed_id") || "";
    
    // Extract 64-bit Steam ID from URL e.g. https://steamcommunity.com/openid/id/76561198444058436
    const steamIdMatch = claimedId.match(/\/id\/(\d+)$/);
    const steamId = steamIdMatch ? steamIdMatch[1] : null;

    if (!steamId) {
      return NextResponse.redirect(new URL("/?auth_error=no_steam_id", request.url));
    }

    // Optional validation: check_authentication with Steam
    try {
      const validationParams = new URLSearchParams();
      searchParams.forEach((val, key) => {
        validationParams.append(key, val);
      });
      validationParams.set("openid.mode", "check_authentication");

      await fetch("https://steamcommunity.com/openid/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: validationParams.toString()
      });
    } catch (e) {
      console.warn("OpenID validation error:", e);
    }

    // 1. Fetch Steam Profile details
    let steamProfile: any = null;
    try {
      const steamRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`
      );
      if (steamRes.ok) {
        const steamData = await steamRes.json();
        steamProfile = steamData?.response?.players?.[0] || null;
      }
    } catch (e) {
      console.error("Failed to fetch Steam profile:", e);
    }

    // 2. Fetch Linked FACEIT Profile details by Steam ID 64
    let faceitProfile: any = null;
    try {
      let faceitRes = await fetch(
        `https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${steamId}`,
        {
          headers: { Authorization: `Bearer ${FACEIT_API_KEY}` }
        }
      );
      if (!faceitRes.ok) {
        faceitRes = await fetch(
          `https://open.faceit.com/data/v4/players?game=csgo&game_player_id=${steamId}`,
          {
            headers: { Authorization: `Bearer ${FACEIT_API_KEY}` }
          }
        );
      }
      if (faceitRes.ok) {
        faceitProfile = await faceitRes.json();
      }
    } catch (e) {
      console.error("Failed to fetch FACEIT profile by SteamID:", e);
    }

    const sessionData = {
      steamId,
      steamName: steamProfile?.personaname || faceitProfile?.nickname || `Player_${steamId.slice(-4)}`,
      steamAvatar: steamProfile?.avatarfull || steamProfile?.avatarmedium || faceitProfile?.avatar || "/default-avatar.png",
      profileUrl: steamProfile?.profileurl || `https://steamcommunity.com/profiles/${steamId}`,
      faceit: faceitProfile ? {
        playerId: faceitProfile.player_id,
        nickname: faceitProfile.nickname,
        avatar: faceitProfile.avatar,
        country: faceitProfile.country,
        elo: faceitProfile.games?.cs2?.faceit_elo || faceitProfile.games?.csgo?.faceit_elo || 1000,
        skillLevel: faceitProfile.games?.cs2?.skill_level || faceitProfile.games?.csgo?.skill_level || 1,
        faceitUrl: faceitProfile.faceit_url ? faceitProfile.faceit_url.replace("{lang}", "en") : `https://www.faceit.com/en/players/${faceitProfile.nickname}`
      } : null,
      loggedAt: Date.now()
    };

    // Serialize session payload safely
    const sessionCookieValue = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    // Redirect to home page with session cookie set
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "sigma-zadrots.duckdns.org";
    const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const redirectUrl = new URL(`${proto}://${host}/?login_success=1`);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("sigma_user_session", sessionCookieValue, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false, // Accessible to client-side JS for reactive header UI
      sameSite: "lax"
    });

    return response;
  } catch (err: any) {
    console.error("Steam callback error:", err);
    return NextResponse.redirect(new URL("/?auth_error=server_error", request.url));
  }
}
