import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("sigma_user_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const decodedStr = Buffer.from(sessionCookie, "base64").toString("utf8");
    const session = JSON.parse(decodedStr);

    return NextResponse.json({ authenticated: true, user: session });
  } catch (e: any) {
    return NextResponse.json({ authenticated: false, user: null, error: e.message });
  }
}
