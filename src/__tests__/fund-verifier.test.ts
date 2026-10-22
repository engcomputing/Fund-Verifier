import { beforeEach, describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import {
  KiloGatewayManager,
  MODEL_REFRESH_INTERVAL_MS,
  isStrictlyFreeModel,
} from "@/lib/kilo-gateway";
import {
  MCP_SERVERS_CATALOG,
  verifyCoOwnerFaceWithYunleng,
} from "@/lib/mcp-integration";
import {
  addFundAmountInVnd,
  createFundInSupabase,
  declineWithdrawalRequest,
  executeApprovedWithdrawal,
  getUserDashboardState,
  loginUserFromSupabase,
  registerUserInSupabase,
   requestDeductFundInVnd,
  resetStoreToSeed,
  respondToFundInvitation,
  verifyWithdrawalWithFaceRecognition,
} from "@/lib/db";

describe("Fund-Verifier Complete Verification Suite", () => {
  beforeEach(() => {
    process.env.FUND_VERIFIER_DB_PATH = path.join(
      os.tmpdir(),
      `fund-verifier-test-${ process.pid }.json`
    );
    resetStoreToSeed();
  });

  describe("1. Kilo Gateway 5-API-Key JWT Rotator & $0 Free Model Manager", () => {
    it("initializes 5 JWT-related Kilo Gateway API keys (KILO_GATEWAY_API_1..5) and auto-rotates on failure or rate-limit", () => {
      const manager = new KiloGatewayManager({
        KILO_GATEWAY_API_1: "eyJhbGciOiJIUzI1NiJ9.eyJzbG90IjoxfQ.sig1",
        KILO_GATEWAY_API_2: "eyJhbGciOiJIUzI1NiJ9.eyJzbG90IjoyfQ.sig2",
        KILO_GATEWAY_API_3: "eyJhbGciOiJIUzI1NiJ9.eyJzbG90IjozfQ.sig3",
        KILO_GATEWAY_API_4: "eyJhbGciOiJIUzI1NiJ9.eyJzbG90Ijo0fQ.sig4",
        KILO_GATEWAY_API_5: "eyJhbGciOiJIUzI1NiJ9.eyJzbG90Ijo1fQ.sig5",
      });

      const snapshot = manager.getStatusSnapshot();
      expect(snapshot.keys).toHaveLength(5);
      expect(snapshot.keys.map((k) => k.envName)).toEqual([
        "KILO_GATEWAY_API_1",
        "KILO_GATEWAY_API_2",
        "KILO_GATEWAY_API_3",
        "KILO_GATEWAY_API_4",
        "KILO_GATEWAY_API_5",
      ]);
      expect(snapshot.activeKeyEnvName).toBe("KILO_GATEWAY_API_1");

      // Simulate key 1 rate-limited -> rotates to key 2
      const rot1 = manager.rotateKeyOnFailure(
        "rate_limited",
        "429 Too Many Requests",
        5000,
        1000
      );
      expect(rot1.previousKey.envName).toBe("KILO_GATEWAY_API_1");
      expect(rot1.currentKey.envName).toBe("KILO_GATEWAY_API_2");

      // Simulate key 2 invalid -> rotates to key 3
      const rot2 = manager.rotateKeyOnFailure(
        "invalid",
        "401 Unauthorized",
        5000,
        1000
      );
      expect(rot2.currentKey.envName).toBe("KILO_GATEWAY_API_3");

      // After cooldown expires (t = 7000 > 1000 + 5000), key 1 is automatically restored to active
      manager.checkRestorations(7000);
      const restoredKey1 = manager.getStatusSnapshot().keys[0];
      expect(restoredKey1.status).toBe("active");
    });

    it("enforces $0/Mtok input/output pricing, 1-minute refresh interval, and immediate model failover", () => {
      const manager = new KiloGatewayManager();
      expect(MODEL_REFRESH_INTERVAL_MS).toBe(60_000);

      // Default model is openrouter/free (also resolvable via openrouter-free and auto/free)
      expect(manager.getActiveModel("openrouter-free").id).toBe(
        "openrouter/free"
      );
      expect(manager.getActiveModel("auto/free").id).toBe("kilo-auto/free");

      // All models in catalog strictly have $0 input and $0 output per Mtok
      for (const model of manager.getStatusSnapshot().freeModels) {
        expect(model.inputPricePerMtok).toBe(0);
        expect(model.outputPricePerMtok).toBe(0);
        expect(isStrictlyFreeModel(model)).toBe(true);
      }

      // Immediate failover when default model is rate-limited
      const failover = manager.failoverModelOnRateLimit("openrouter/free");
      expect(failover.previousModel).toBe("openrouter/free");
      expect(failover.currentModel.id).not.toBe("openrouter/free");
      expect(failover.currentModel.inputPricePerMtok).toBe(0);

      // 1-minute catalog sync adds new $0 models and removes models that are no longer $0
      const syncRes = manager.syncModelCatalog([
        {
          id: "stepfun/step-3.7-flash:free",
          name: "StepFun 3.7 Free",
          pricing: { prompt: "0", completion: "0" },
        },
        {
          id: "paid-provider/expensive-model",
          name: "Paid Model",
          pricing: { prompt: "2.50", completion: "10.00" },
        },
        {
          id: "qwen/qwen3-coder:free", // Suppose this model ceased being free
          pricing: { prompt: "0.50", completion: "1.00" },
        },
      ]);

      expect(syncRes.added).toContain("stepfun/step-3.7-flash:free");
      expect(syncRes.added).not.toContain("paid-provider/expensive-model");
      expect(syncRes.removed).toContain("qwen/qwen3-coder:free");
    });
  });

  describe("2. MCP Servers & Yunleng Face Recognition Liveness Verification", () => {
    it("includes all 4 required MCP servers (Yunleng, Tide Raziel, Everything Claude Code, Playwright)", () => {
      const ids = MCP_SERVERS_CATALOG.map((s) => s.id);
      expect(ids).toEqual([
        "yunleng",
        "tide-raziel",
        "everything-claude-code",
        "playwright-mcp",
      ]);
    });

    it("rejects face verification if camera is off or any of the 4 head movements (left, right, up, down) is missing", () => {
      const noCam = verifyCoOwnerFaceWithYunleng({
        coOwnerId: "usr_binh_tran",
        coOwnerEmail: "binh.tran@gmail.com",
        coOwnerUsername: "binh_tran",
        cameraPermissionGranted: false,
        headMovements: ["left", "right", "up", "down"],
      });
      expect(noCam.verified).toBe(false);

      const partialMoves = verifyCoOwnerFaceWithYunleng({
        coOwnerId: "usr_binh_tran",
        coOwnerEmail: "binh.tran@gmail.com",
        coOwnerUsername: "binh_tran",
        cameraPermissionGranted: true,
        headMovements: ["left", "right"], // missing up, down
      });
      expect(partialMoves.verified).toBe(false);
      expect(partialMoves.missingMovements).toEqual(["up", "down"]);

      const fullMoves = verifyCoOwnerFaceWithYunleng({
        coOwnerId: "usr_binh_tran",
        coOwnerEmail: "binh.tran@gmail.com",
        coOwnerUsername: "binh_tran",
        cameraPermissionGranted: true,
        headMovements: ["left", "right", "up", "down"],
      });
      expect(fullMoves.verified).toBe(true);
      expect(fullMoves.antiSpoofingPassed).toBe(true);
    });
  });

  describe("3. Supabase Authentication, Fund Creation, Invitations & Dual/Multi-Owner Deduction Workflow", () => {
    it("requires user to sign in (register) when logging in with an email not in the Supabase database", async () => {
      const loginUnregistered = await loginUserFromSupabase({
        email: "new.customer@yahoo.com",
        password: "MySecretPassword",
      });
      expect(loginUnregistered.ok).toBe(false);
      expect(loginUnregistered.requireSignIn).toBe(true);
      expect(loginUnregistered.code).toBe("EMAIL_NOT_REGISTERED");

      // Now sign in (register) and save into Supabase database
      const reg = await registerUserInSupabase({
        email: "new.customer@yahoo.com",
        username: "new_customer",
        password: "MySecretPassword",
      });
      expect(reg.ok).toBe(true);
      expect(reg.user?.email).toBe("new.customer@yahoo.com");

      // Subsequent login succeeds
      const loginAfter = await loginUserFromSupabase({
        email: "new.customer@yahoo.com",
        password: "MySecretPassword",
      });
      expect(loginAfter.ok).toBe(true);
      expect(loginAfter.user?.username).toBe("new_customer");
    });

    it("creates a fund in VND, sends invitations to Notification bar, and handles Accept / Decline", async () => {
      const createRes = await createFundInSupabase({
        creatorId: "usr_an_nguyen",
        name: "Hanoi Business Co-Fund",
        initialAmountVnd: 30000000,
        invitedIdentifiers: ["binh.tran@gmail.com", "cuong_le"],
      });
      expect(createRes.ok).toBe(true);
      expect(createRes.fund?.balance_vnd).toBe(30000000);
      expect(createRes.invitedMembers).toHaveLength(2);

      // Check Binh's notification bar has the invitation
      const binhDash = getUserDashboardState("usr_binh_tran");
      const inviteNotif = binhDash?.notifications.find(
        (n) =>
          n.type === "fund_invitation" && n.fund_id === createRes.fund!.id
      );
      expect(inviteNotif).toBeDefined();

      // Binh clicks "Accept"
      const acceptRes = await respondToFundInvitation({
        userId: "usr_binh_tran",
        notificationId: inviteNotif!.id,
        decision: "accept",
      });
      expect(acceptRes.ok).toBe(true);
      expect(acceptRes.status).toBe("active");
    });

    it("enforces Add Fund (> 0 VND), Deduct Fund (> 0 and < balance VND), 3 approval labels, and multi-owner face verification", async () => {
      // 1. Add Fund (10,000,000 VND to existing 50,000,000 VND 3-member joint fund)
      const addRes = await addFundAmountInVnd({
        userId: "usr_an_nguyen",
        fundId: "fund_vn_joint_01",
        amountVnd: 10000000,
      });
      expect(addRes.ok).toBe(true);
      expect(addRes.fund?.balance_vnd).toBe(60000000);

      // 2. Reject invalid deduct amounts (<= 0 or >= current balance)
      const invalidZero = await requestDeductFundInVnd({
        userId: "usr_an_nguyen",
        fundId: "fund_vn_joint_01",
        amountVnd: 0,
      });
      expect(invalidZero.ok).toBe(false);

      const invalidTooHigh = await requestDeductFundInVnd({
        userId: "usr_an_nguyen",
        fundId: "fund_vn_joint_01",
        amountVnd: 60000000, // Equal to current balance -> must be strictly less than current balance
      });
      expect(invalidTooHigh.ok).toBe(false);

      // 3. Valid Deduct Fund request (15,000,000 VND from 60,000,000 VND)
      const deductReq = await requestDeductFundInVnd({
        userId: "usr_an_nguyen",
        fundId: "fund_vn_joint_01",
        amountVnd: 15000000,
      });
      expect(deductReq.ok).toBe(true);
      expect(deductReq.requiresCoOwnerVerification).toBe(true);
      expect(deductReq.approvals).toHaveLength(2);
      // Both remaining co-owners start with "Waiting for approval"
      expect(deductReq.approvals?.map((a) => a.status)).toEqual([
        "Waiting for approval",
        "Waiting for approval",
      ]);

      const requestId = deductReq.request!.id;

      // Server-side enforcement blocks early deduction before co-owners verify
      const earlyExec = await executeApprovedWithdrawal({
        userId: "usr_an_nguyen",
        requestId,
      });
      expect(earlyExec.ok).toBe(false);

      // Co-owner 1 (Binh) verifies via Face Recognition (camera + 4 head movements)
      const verifyBinh = await verifyWithdrawalWithFaceRecognition({
        coOwnerId: "usr_binh_tran",
        requestId,
        cameraPermissionGranted: true,
        headMovements: ["left", "right", "up", "down"],
      });
      expect(verifyBinh.ok).toBe(true);
      expect(verifyBinh.approval?.status).toBe("Approved");
      expect(verifyBinh.allCoOwnersApproved).toBe(false);

      // Balance is still 60,000,000 VND because Co-owner 2 (Cuong) is still "Waiting for approval"
      const dashMid = getUserDashboardState("usr_an_nguyen");
      const fundMid = dashMid?.funds.find((f) => f.id === "fund_vn_joint_01");
      expect(fundMid?.balance_vnd).toBe(60000000);

      // Co-owner 2 (Cuong) verifies via Face Recognition
      const verifyCuong = await verifyWithdrawalWithFaceRecognition({
        coOwnerId: "usr_cuong_le",
        requestId,
        cameraPermissionGranted: true,
        headMovements: ["left", "right", "up", "down"],
      });
      expect(verifyCuong.ok).toBe(true);
      expect(verifyCuong.approval?.status).toBe("Approved");
      expect(verifyCuong.allCoOwnersApproved).toBe(true);

      // Now all co-owners are "Approved" and 15,000,000 VND is deducted (60,000,000 -> 45,000,000 VND)
      expect(verifyCuong.fund?.balance_vnd).toBe(45000000);
    });

    it("marks status as 'Rejected' when a co-owner declines a deduction verification request", async () => {
      const deductReq = await requestDeductFundInVnd({
        userId: "usr_an_nguyen",
        fundId: "fund_vn_joint_01",
        amountVnd: 5000000,
      });
      const requestId = deductReq.request!.id;

      const declineRes = await declineWithdrawalRequest({
        coOwnerId: "usr_binh_tran",
        requestId,
      });
      expect(declineRes.ok).toBe(true);
      expect(declineRes.approval?.status).toBe("Rejected");
      expect(declineRes.request?.status).toBe("Rejected");

      // Cannot execute a rejected withdrawal
      const execRejected = await executeApprovedWithdrawal({
        userId: "usr_an_nguyen",
        requestId,
      });
      expect(execRejected.ok).toBe(false);
    });
  });
});
