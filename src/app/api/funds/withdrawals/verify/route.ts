import { NextRequest, NextResponse } from "next/server";
import {
  declineWithdrawalRequest,
  executeApprovedWithdrawal,
  verifyWithdrawalWithFaceRecognition,
} from "@/lib/db";
import { HeadDirection } from "@/lib/mcp-integration";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "verify").toLowerCase();

    if (action === "decline") {
      const result = await declineWithdrawalRequest({
        coOwnerId: String(body.coOwnerId || body.userId || ""),
        requestId: String(body.requestId || ""),
        notificationId: body.notificationId
          ? String(body.notificationId)
          : undefined,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === "execute") {
      const result = await executeApprovedWithdrawal({
        userId: String(body.userId || ""),
        requestId: String(body.requestId || ""),
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 403 });
    }

    // Default: "verify" via Yunleng MCP Face Recognition & 4-directional head movement
    const headMovements: HeadDirection[] = Array.isArray(body.headMovements)
      ? body.headMovements
      : [];

    const result = await verifyWithdrawalWithFaceRecognition({
      coOwnerId: String(body.coOwnerId || body.userId || ""),
      requestId: String(body.requestId || ""),
      notificationId: body.notificationId
        ? String(body.notificationId)
        : undefined,
      cameraPermissionGranted: Boolean(body.cameraPermissionGranted),
      headMovements,
      frameDataUrl: body.frameDataUrl ? String(body.frameDataUrl) : undefined,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Verification error",
      },
      { status: 500 }
    );
  }
}
