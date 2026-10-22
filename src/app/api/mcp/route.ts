import { NextRequest, NextResponse } from "next/server";
import {
  HeadDirection,
  MCP_SERVERS_CATALOG,
  verifyCoOwnerFaceWithYunleng,
} from "@/lib/mcp-integration";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mcpServers: MCP_SERVERS_CATALOG,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tool = String(body.tool || "verify_face_liveness");

    if (tool === "list_cameras") {
      return NextResponse.json({
        ok: true,
        mcpServer: "yunleng",
        cameras: [
          {
            id: "0",
            name: "Integrated Face-ID WebRTC Camera",
            type: "local_webcam",
            resolution: "640x480",
            status: "ready",
          },
        ],
      });
    }

    if (tool === "verify_face_liveness") {
      const res = verifyCoOwnerFaceWithYunleng({
        coOwnerId: String(body.coOwnerId || "usr_demo"),
        coOwnerEmail: String(body.coOwnerEmail || "demo@vietbank.vn"),
        coOwnerUsername: String(body.coOwnerUsername || "demo_user"),
        cameraPermissionGranted: Boolean(body.cameraPermissionGranted),
        headMovements: (Array.isArray(body.headMovements)
          ? body.headMovements
          : []) as HeadDirection[],
        frameDataUrl: body.frameDataUrl ? String(body.frameDataUrl) : undefined,
      });
      return NextResponse.json({ ok: res.verified, ...res });
    }

    return NextResponse.json({
      ok: true,
      mcpServer: "yunleng",
      tool,
      status: "executed",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "MCP invocation failed",
      },
      { status: 500 }
    );
  }
}
