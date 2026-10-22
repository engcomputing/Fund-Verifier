import { NextRequest, NextResponse } from "next/server";
import {
  declineWithdrawalRequest,
  respondToFundInvitation,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body.type || "fund_invitation");
    const decision = String(body.decision || "").toLowerCase();

    if (type === "fund_invitation") {
      if (decision !== "accept" && decision !== "decline") {
        return NextResponse.json(
          { ok: false, error: "Decision must be 'accept' or 'decline'." },
          { status: 400 }
        );
      }
      const result = await respondToFundInvitation({
        userId: String(body.userId || ""),
        notificationId: String(body.notificationId || ""),
        decision: decision as "accept" | "decline",
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (type === "withdrawal_verification" && decision === "decline") {
      const result = await declineWithdrawalRequest({
        coOwnerId: String(body.userId || ""),
        requestId: String(body.requestId || ""),
        notificationId: body.notificationId
          ? String(body.notificationId)
          : undefined,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid notification response request." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to process notification response",
      },
      { status: 500 }
    );
  }
}
