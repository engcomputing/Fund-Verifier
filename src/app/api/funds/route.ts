import { NextRequest, NextResponse } from "next/server";
import {
  addFundAmountInVnd,
  createFundInSupabase,
  inviteUserToFund,
  requestDeductFundInVnd,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "create") {
      const result = await createFundInSupabase({
        creatorId: String(body.creatorId || ""),
        name: String(body.name || ""),
        description: body.description ? String(body.description) : undefined,
        initialAmountVnd: Number(body.initialAmountVnd ?? 0),
        invitedIdentifiers: Array.isArray(body.invitedIdentifiers)
          ? body.invitedIdentifiers.map(String)
          : [],
      });
      return NextResponse.json(result, { status: result.ok ? 201 : 400 });
    }

    if (action === "invite") {
      const result = await inviteUserToFund({
        inviterId: String(body.inviterId || ""),
        fundId: String(body.fundId || ""),
        identifier: String(body.identifier || ""),
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === "add_fund") {
      const result = await addFundAmountInVnd({
        userId: String(body.userId || ""),
        fundId: String(body.fundId || ""),
        amountVnd: Number(body.amountVnd),
        note: body.note ? String(body.note) : undefined,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === "deduct_fund") {
      const result = await requestDeductFundInVnd({
        userId: String(body.userId || ""),
        fundId: String(body.fundId || ""),
        amountVnd: Number(body.amountVnd),
        reason: body.reason ? String(body.reason) : undefined,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown fund action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Fund operation failed",
      },
      { status: 500 }
    );
  }
}
