import { NextRequest, NextResponse } from "next/server";
import { kiloGateway } from "@/lib/kilo-gateway";

export async function GET() {
  return NextResponse.json({
    ok: true,
    ...kiloGateway.getStatusSnapshot(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "rotate_key") {
      const reason =
        body.reason === "invalid" || body.reason === "failed"
          ? body.reason
          : "rate_limited";
      const result = kiloGateway.rotateKeyOnFailure(
        reason,
        body.errorMessage || "Simulated rate limit / failure on current API key"
      );
      return NextResponse.json({
        ok: true,
        ...result,
        snapshot: kiloGateway.getStatusSnapshot(),
      });
    }

    if (action === "restore_key") {
      const slot = Number(body.slot) as 1 | 2 | 3 | 4 | 5;
      const restored = kiloGateway.restoreKeySlot(slot);
      return NextResponse.json({
        ok: true,
        restored,
        snapshot: kiloGateway.getStatusSnapshot(),
      });
    }

    if (action === "failover_model") {
      const result = kiloGateway.failoverModelOnRateLimit(
        body.modelId ? String(body.modelId) : undefined
      );
      return NextResponse.json({
        ok: true,
        ...result,
        snapshot: kiloGateway.getStatusSnapshot(),
      });
    }

    if (action === "sync_catalog") {
      const syncResult = Array.isArray(body.catalog)
        ? kiloGateway.syncModelCatalog(body.catalog)
        : await kiloGateway.refreshFromRemoteGateway();
      return NextResponse.json({
        ok: true,
        syncResult,
        snapshot: kiloGateway.getStatusSnapshot(),
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown Kilo action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Kilo Gateway operation failed",
      },
      { status: 500 }
    );
  }
}
