import { NextRequest, NextResponse } from "next/server";
import { getUserDashboardState, listRegisteredUsers } from "@/lib/db";
import { kiloGateway } from "@/lib/kilo-gateway";
import { MCP_SERVERS_CATALOG } from "@/lib/mcp-integration";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      directory: listRegisteredUsers(),
      kilo: kiloGateway.getStatusSnapshot(),
      mcpServers: MCP_SERVERS_CATALOG,
    });
  }

  const dashboard = getUserDashboardState(userId);
  if (!dashboard) {
    return NextResponse.json(
      { ok: false, error: "User not found in Supabase database." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    ...dashboard,
    kilo: kiloGateway.getStatusSnapshot(),
    mcpServers: MCP_SERVERS_CATALOG,
  });
}
