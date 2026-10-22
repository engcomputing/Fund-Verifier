import { NextRequest, NextResponse } from "next/server";
import {
  listRegisteredUsers,
  loginUserFromSupabase,
  registerUserInSupabase,
} from "@/lib/db";

export async function GET() {
  const users = listRegisteredUsers();
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "login").toLowerCase();

    if (action === "signin" || action === "signup" || action === "register") {
      const result = await registerUserInSupabase({
        email: String(body.email || ""),
        username: String(body.username || ""),
        password: String(body.password || ""),
        fullName: body.fullName ? String(body.fullName) : undefined,
      });
      if (!result.ok) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result, { status: 201 });
    }

    // Default: login
    const result = await loginUserFromSupabase({
      email: String(body.email || ""),
      username: body.username ? String(body.username) : undefined,
      password: String(body.password || ""),
    });

    if (!result.ok) {
      return NextResponse.json(result, {
        status: result.requireSignIn ? 404 : 401,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Authentication error",
      },
      { status: 500 }
    );
  }
}
