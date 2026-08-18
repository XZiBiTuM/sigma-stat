import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete("sigma_user_session");
  return response;
}
