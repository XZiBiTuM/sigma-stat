import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Determine correct base URL (handling proxies like Nginx)
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "sigma-zadrots.duckdns.org";
  const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${baseUrl}/api/auth/steam/callback`,
    "openid.realm": `${baseUrl}/`,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
  });

  const steamLoginUrl = `https://steamcommunity.com/openid/login?${params.toString()}`;
  return NextResponse.redirect(steamLoginUrl);
}
