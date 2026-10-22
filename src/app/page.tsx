"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import FaceVerificationModal from "@/components/FaceVerificationModal";

interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  created_at: string;
}

interface FundMember {
  id: string;
  fund_id: string;
  user_id: string;
  username: string;
  email: string;
  role: "creator" | "co-owner";
  status: "active" | "invited" | "declined";
  invited_by_username: string;
}

interface FundTransaction {
  id: string;
  type: "initial" | "add" | "deduct";
  username: string;
  amount_vnd: number;
  balance_after_vnd: number;
  note: string;
  created_at: string;
}

interface WithdrawalApproval {
  id: string;
  request_id: string;
  co_owner_id: string;
  co_owner_username: string;
  co_owner_email: string;
  status: "Approved" | "Waiting for approval" | "Rejected";
  face_verified: boolean;
  head_movements: string[];
  mcp_server: string;
  ai_model: string;
  updated_at: string;
}

interface WithdrawalRequest {
  id: string;
  fund_id: string;
  fund_name: string;
  requester_id: string;
  requester_username: string;
  requester_email: string;
  amount_vnd: number;
  reason: string;
  status: string;
  deducted: boolean;
  expires_at: string;
  created_at: string;
  approvals: WithdrawalApproval[];
}

interface FundItem {
  id: string;
  name: string;
  description: string;
  balance_vnd: number;
  creator_id: string;
  creator_username: string;
  creator_email: string;
  created_at: string;
  members: FundMember[];
  transactions: FundTransaction[];
  withdrawalRequests: WithdrawalRequest[];
}

interface NotificationItem {
  id: string;
  recipient_id: string;
  sender_username: string;
  sender_email: string;
  type: "fund_invitation" | "withdrawal_verification" | "withdrawal_update";
  title: string;
  message: string;
  fund_id: string;
  fund_name: string;
  amount_vnd: number | null;
  withdrawal_request_id: string | null;
  action_status: "pending" | "accepted" | "declined" | "verified";
  is_read: boolean;
  created_at: string;
}

interface KiloKeyStatus {
  slot: 1 | 2 | 3 | 4 | 5;
  envName: string;
  maskedToken: string;
  isJwtFormat: boolean;
  status: "active" | "rate_limited" | "invalid" | "failed";
  failureCount: number;
  lastError: string | null;
}

interface FreeAiModel {
  id: string;
  name: string;
  provider: string;
  inputPricePerMtok: number;
  outputPricePerMtok: number;
  visionCapable: boolean;
  status: "available" | "rate_limited";
}

interface KiloSnapshot {
  activeKeySlot: number;
  activeKeyEnvName: string;
  activeModel: string;
  refreshIntervalSeconds: number;
  lastCatalogRefreshAt: string;
  keys: KiloKeyStatus[];
  freeModels: FreeAiModel[];
}

interface McpServerInfo {
  id: string;
  name: string;
  url: string;
  status: string;
  role: string;
  tools: string[];
}

export default function FundVerifierApp() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signin">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard state
  const [funds, setFunds] = useState<FundItem[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [directory, setDirectory] = useState<UserProfile[]>([]);
  const [kiloSnapshot, setKiloSnapshot] = useState<KiloSnapshot | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([]);

  // Top-right Notification Box state
  const [notificationBoxOpen, setNotificationBoxOpen] = useState(true);

  // Create Fund state
  const [newFundName, setNewFundName] = useState("");
  const [newFundAmountVnd, setNewFundAmountVnd] = useState("");
  const [newFundInvitesInput, setNewFundInvitesInput] = useState("");
  const [createFundMsg, setCreateFundMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Selected Fund Operation ("add" vs "deduct")
  const [fundActionTab, setFundActionTab] = useState<"add" | "deduct">("add");
  const [operationAmountVnd, setOperationAmountVnd] = useState("");
  const [operationNote, setOperationNote] = useState("");
  const [operationFeedback, setOperationFeedback] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  // Invite additional co-owner to existing fund
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteFeedback, setInviteFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Face Verification Modal state
  const [verifyModalTarget, setVerifyModalTarget] = useState<{
    requestId: string;
    notificationId?: string;
    fundName: string;
    requesterUsername: string;
    amountVnd: number;
  } | null>(null);

  // Load initial directory + Kilo + MCP metadata
  const fetchDashboard = useCallback(async (uid?: string) => {
    try {
      const targetId = uid;
      const url = targetId
        ? `/api/dashboard?userId=${encodeURIComponent(targetId)}`
        : `/api/dashboard`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        if (Array.isArray(data.directory)) {
          setDirectory(data.directory);
        }
        if (data.kilo) {
          setKiloSnapshot(data.kilo);
        }
        if (Array.isArray(data.mcpServers)) {
          setMcpServers(data.mcpServers);
        }
        if (data.authenticated && data.user) {
          setFunds(data.funds || []);
          setNotifications(data.notifications || []);
          setSelectedFundId((prev) => {
            if (prev && data.funds?.some((f: FundItem) => f.id === prev)) {
              return prev;
            }
            return data.funds?.[0]?.id || null;
          });
        }
      }
    } catch {
      // Ignore transient poll errors
    }
  }, []);

  useEffect(() => {
    fetchDashboard(currentUser?.id);
    const interval = setInterval(() => {
      fetchDashboard(currentUser?.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser?.id, fetchDashboard]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setAuthLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          email: authEmail,
          username: authUsername,
          password: authPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (data.requireSignIn || data.code === "EMAIL_NOT_REGISTERED") {
          setAuthMode("signin");
          setAuthNotice(
            data.error ||
              "Your email is not registered in the Supabase database. Please sign in (register) with your email, username, and password."
          );
          if (!authUsername && authEmail.includes("@")) {
            setAuthUsername(authEmail.split("@")[0]);
          }
        } else {
          setAuthError(data.error || "Authentication failed.");
        }
        setAuthLoading(false);
        return;
      }

      setCurrentUser(data.user);
      setOperationFeedback(null);
      setCreateFundMsg(null);
      await fetchDashboard(data.user.id);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Authentication network error"
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleQuickSwitchUser(user: UserProfile) {
    setCurrentUser(user);
    setOperationFeedback(null);
    setCreateFundMsg(null);
    setInviteFeedback(null);
    await fetchDashboard(user.id);
  }

  function toggleInviteUsernameInCreate(emailOrUsername: string) {
    const existing = newFundInvitesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (existing.includes(emailOrUsername)) {
      setNewFundInvitesInput(
        existing.filter((x) => x !== emailOrUsername).join(", ")
      );
    } else {
      setNewFundInvitesInput([...existing, emailOrUsername].join(", "));
    }
  }

  async function handleCreateFund(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setCreateFundMsg(null);

    const invitedIdentifiers = newFundInvitesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          creatorId: currentUser.id,
          name: newFundName,
          initialAmountVnd: Number(newFundAmountVnd || 0),
          invitedIdentifiers,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCreateFundMsg({
          type: "error",
          text: data.error || "Failed to create fund.",
        });
        return;
      }

      setCreateFundMsg({
        type: "success",
        text: `Fund "${data.fund.name}" created with ${Number(
          data.fund.balance_vnd
        ).toLocaleString("en-US")} VND! ${
          invitedIdentifiers.length > 0
            ? `Invitations sent to ${invitedIdentifiers.join(", ")} on their Notification bar.`
            : ""
        }`,
      });
      setNewFundName("");
      setNewFundAmountVnd("");
      setNewFundInvitesInput("");
      setSelectedFundId(data.fund.id);
      await fetchDashboard(currentUser.id);
    } catch (err) {
      setCreateFundMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Error creating fund",
      });
    }
  }

  async function handleFundSubmitOperation(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !selectedFund) return;
    setOperationFeedback(null);

    const amount = Number(operationAmountVnd);
    if (fundActionTab === "add") {
      if (Number.isNaN(amount) || amount <= 0) {
        setOperationFeedback({
          type: "error",
          text: "Amount to add (in VND) must be greater than 0.",
        });
        return;
      }

      const res = await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_fund",
          userId: currentUser.id,
          fundId: selectedFund.id,
          amountVnd: amount,
          note: operationNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setOperationFeedback({
          type: "error",
          text: data.error || "Failed to add funds.",
        });
        return;
      }

      setOperationFeedback({
        type: "success",
        text: `Successfully added ${amount.toLocaleString(
          "en-US"
        )} VND to "${selectedFund.name}". New balance: ${Number(
          data.fund.balance_vnd
        ).toLocaleString("en-US")} VND.`,
      });
      setOperationAmountVnd("");
      setOperationNote("");
      await fetchDashboard(currentUser.id);
      return;
    }

    // Deduct Fund
    if (Number.isNaN(amount) || amount <= 0 || amount >= selectedFund.balance_vnd) {
      setOperationFeedback({
        type: "error",
        text: `Deduct amount (in VND) must be greater than 0 and less than the current money the fund has (${selectedFund.balance_vnd.toLocaleString(
          "en-US"
        )} VND).`,
      });
      return;
    }

    const res = await fetch("/api/funds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "deduct_fund",
        userId: currentUser.id,
        fundId: selectedFund.id,
        amountVnd: amount,
        reason: operationNote,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setOperationFeedback({
        type: "error",
        text: data.error || "Failed to request fund deduction.",
      });
      return;
    }

    setOperationFeedback({
      type: data.requiresCoOwnerVerification ? "warning" : "success",
      text:
        data.message ||
        "Other co-owners must verify via Face Recognition in order for you to deduct the fund.",
    });
    setOperationAmountVnd("");
    setOperationNote("");
    await fetchDashboard(currentUser.id);
  }

  async function handleInviteToExistingFund(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !selectedFund || !inviteIdentifier.trim()) return;
    setInviteFeedback(null);

    const res = await fetch("/api/funds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "invite",
        inviterId: currentUser.id,
        fundId: selectedFund.id,
        identifier: inviteIdentifier.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setInviteFeedback({
        type: "error",
        text: data.error || "Could not invite user.",
      });
      return;
    }

    setInviteFeedback({
      type: "success",
      text: `Invitation sent to ${data.member.username} (${data.member.email})! It is now in their Notification box.`,
    });
    setInviteIdentifier("");
    await fetchDashboard(currentUser.id);
  }

  async function handleRespondFundInvitation(
    notificationId: string,
    decision: "accept" | "decline"
  ) {
    if (!currentUser) return;
    await fetch("/api/notifications/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "fund_invitation",
        userId: currentUser.id,
        notificationId,
        decision,
      }),
    });
    await fetchDashboard(currentUser.id);
  }

  async function handleDeclineWithdrawalVerification(
    requestId: string,
    notificationId?: string
  ) {
    if (!currentUser) return;
    await fetch("/api/notifications/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "withdrawal_verification",
        userId: currentUser.id,
        requestId,
        notificationId,
        decision: "decline",
      }),
    });
    await fetchDashboard(currentUser.id);
  }

  async function handleExecuteApprovedWithdrawal(requestId: string) {
    if (!currentUser) return;
    const res = await fetch("/api/funds/withdrawals/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "execute",
        userId: currentUser.id,
        requestId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setOperationFeedback({
        type: "error",
        text: data.error || "Cannot execute deduction yet.",
      });
      return;
    }
    setOperationFeedback({
      type: "success",
      text: `Deduction of ${Number(
        data.request.amount_vnd
      ).toLocaleString("en-US")} VND confirmed and completed!`,
    });
    await fetchDashboard(currentUser.id);
  }

  async function handleRotateKiloKey() {
    const res = await fetch("/api/kilo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rotate_key",
        reason: "rate_limited",
      }),
    });
    const data = await res.json();
    if (data.snapshot) setKiloSnapshot(data.snapshot);
  }

  async function handleRestoreKiloKey(slot: number) {
    const res = await fetch("/api/kilo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "restore_key",
        slot,
      }),
    });
    const data = await res.json();
    if (data.snapshot) setKiloSnapshot(data.snapshot);
  }

  async function handleFailoverKiloModel() {
    const res = await fetch("/api/kilo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "failover_model",
      }),
    });
    const data = await res.json();
    if (data.snapshot) setKiloSnapshot(data.snapshot);
  }

  const selectedFund =
    funds.find((f) => f.id === selectedFundId) || funds[0] || null;
  const pendingNotificationsCount = notifications.filter(
    (n) => n.action_status === "pending"
  ).length;

  // ============================================================================
  // VIEW 1: AUTHENTICATION (LOG IN / SIGN IN VIA EMAIL, USERNAME, PASSWORD)
  // ============================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 text-white flex flex-col justify-between">
        {/* Header */}
        <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <span className="text-lg font-extrabold tracking-tight">
                  VietBank Fund-Verifier
                </span>
                <span className="block text-xs text-emerald-300">
                  Multi-Owner Joint Account & Real-Time Face-ID Liveness Security
                </span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                Supabase + Yunleng MCP + Kilo 5-Key Rotator Active
              </span>
            </div>
          </div>
        </header>

        {/* Main Auth Content */}
        <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-12 items-center">
          {/* Left Column: Banking Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
              <Camera className="h-3.5 w-3.5" />
              Remote Co-Owner Withdrawal Verification • Anti-AI Face Spoofing
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Co-Owned Bank Funds, Verified Remotely with{" "}
              <span className="text-emerald-400">
                Live Head-Movement Face ID
              </span>
              .
            </h1>

            <p className="text-slate-300 text-base leading-relaxed">
              In traditional Vietnam banking, withdrawing from a 3-member
              co-owned account requires all co-owners to travel to a bank branch
              in person. <strong>Fund-Verifier</strong> lets co-owners approve
              fund deductions remotely using <strong>Yunleng MCP</strong> real-time
              camera face recognition and 4-directional head movement liveness
              (Left, Right, Up, Down).
            </p>

            {/* Quick 1-Click Co-Owner Demo Logins */}
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Instant Demo Co-Owner Accounts (Pre-registered in Supabase)
                </span>
                <span className="text-[11px] text-slate-400">
                  Click any member to enter bank portal immediately
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {directory.slice(0, 3).map((u, idx) => (
                  <button
                    key={u.id}
                    type="button"
                    data-testid={`demo-login-${u.username}`}
                    onClick={() => handleQuickSwitchUser(u)}
                    className="flex flex-col items-start rounded-xl border border-white/10 bg-slate-900/80 p-3.5 text-left hover:border-emerald-400 hover:bg-slate-800/90 transition cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-400">
                      Co-Owner #{idx + 1}
                    </span>
                    <span className="mt-1 font-bold text-sm text-white">
                      {u.full_name}
                    </span>
                    <span className="text-xs text-slate-300">@{u.username}</span>
                    <span className="mt-1 text-[11px] text-slate-400 truncate w-full">
                      {u.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Log In / Sign In Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/15 bg-white text-slate-900 shadow-2xl p-6 sm:p-8">
              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 mb-6">
                <button
                  type="button"
                  data-testid="tab-login"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                  }}
                  className={`rounded-lg py-2.5 text-xs font-bold transition cursor-pointer ${
                    authMode === "login"
                      ? "bg-white text-slate-900 shadow"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  data-testid="tab-signin"
                  onClick={() => {
                    setAuthMode("signin");
                    setAuthError(null);
                  }}
                  className={`rounded-lg py-2.5 text-xs font-bold transition cursor-pointer ${
                    authMode === "signin"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Sign In (Register)
                </button>
              </div>

              <h2 className="text-xl font-extrabold text-slate-900">
                {authMode === "login"
                  ? "Log In to Your Bank Account"
                  : "Sign In & Save to Supabase Directory"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {authMode === "login"
                  ? "Enter your registered email and password. If your email is not in Supabase, you will be prompted to Sign In."
                  : "All email providers are accepted. Your email, username, and password will be saved into the Supabase directory."}
              </p>

              {authNotice && (
                <div
                  data-testid="auth-require-signin-alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-medium text-amber-950"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{authNotice}</span>
                </div>
              )}

              {authError && (
                <div
                  data-testid="auth-error-alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800"
                >
                  <XCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address (All Providers Accepted)
                  </label>
                  <input
                    type="email"
                    required
                    data-testid="auth-email-input"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@gmail.com, @outlook.com, @vietbank.vn..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username {authMode === "login" ? "(Optional)" : "(Required)"}
                  </label>
                  <input
                    type="text"
                    required={authMode === "signin"}
                    data-testid="auth-username-input"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    placeholder="e.g. minh_nguyen"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    data-testid="auth-password-input"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="auth-submit-btn"
                  disabled={authLoading}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
                >
                  {authLoading
                    ? "Authenticating with Supabase..."
                    : authMode === "login"
                    ? "Log In to Bank Portal"
                    : "Sign In & Save Account to Supabase"}
                </button>
              </form>
            </div>
          </div>
        </main>

        <footer className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
          VietBank Fund-Verifier • Powered by Supabase, Kilo Gateway ($0 Free
          Models), Yunleng MCP, Tide Raziel MCP, Everything Claude Code &
          Playwright MCP
        </footer>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: MAIN BANKING INTERFACE (AFTER LOGGED IN)
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Banking Header with Top-Right Notification Box */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-900 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-black">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight">
                  VietBank Fund-Verifier
                </span>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-400/30">
                  VND Co-Vault
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Logged in as{" "}
                <strong
                  data-testid="active-user-badge"
                  className="text-emerald-300"
                >
                  {currentUser.username} ({currentUser.email})
                </strong>
              </p>
            </div>
          </div>

          {/* Right Controls: Quick Co-Owner Switcher + Top-Right Notification Box */}
          <div className="flex items-center gap-3">
            {/* Switch Active Co-Owner Account (for fast multi-member testing) */}
            <div className="hidden md:flex items-center gap-1.5 rounded-xl bg-slate-800 p-1 border border-slate-700">
              <span className="px-2 text-[11px] font-semibold text-slate-400">
                Switch Member:
              </span>
              {directory.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  data-testid={`switch-user-${u.username}`}
                  onClick={() => handleQuickSwitchUser(u)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    u.id === currentUser.id
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {u.username}
                </button>
              ))}
            </div>

            {/* TOP-RIGHT CORNER NOTIFICATION BOX TRIGGER */}
            <div className="relative">
              <button
                type="button"
                data-testid="notification-box-toggle"
                onClick={() => setNotificationBoxOpen((prev) => !prev)}
                className="relative inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 transition cursor-pointer"
              >
                <Bell className="h-4 w-4 text-emerald-300" />
                <span>Notifications</span>
                <span
                  data-testid="notification-badge-count"
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                    pendingNotificationsCount > 0
                      ? "bg-amber-400 text-slate-950 animate-pulse"
                      : "bg-slate-700 text-slate-200"
                  }`}
                >
                  {pendingNotificationsCount}
                </span>
              </button>
            </div>

            <button
              type="button"
              data-testid="logout-btn"
              onClick={() => setCurrentUser(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-6 space-y-8">
        {/* TOP-RIGHT CORNER NOTIFICATION BOX PANEL */}
        {notificationBoxOpen && (
          <section
            data-testid="top-right-notification-box"
            className="ml-auto w-full rounded-2xl border-2 border-emerald-600/30 bg-white p-5 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Notification Box ({currentUser.username})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Co-ownership invitations (&ldquo;Accept&rdquo; or
                    &ldquo;Decline&rdquo;) and Co-owner Face-ID deduction
                    verifications (&ldquo;Verify&rdquo; or &ldquo;Decline&rdquo;)
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {pendingNotificationsCount} Action Required
              </span>
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
                No notifications yet for {currentUser.username} (
                {currentUser.email}).
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    data-testid={`notification-item-${notif.type}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition ${
                      notif.action_status === "pending"
                        ? "border-amber-300 bg-amber-50/60"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900">
                          {notif.title}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            notif.action_status === "pending"
                              ? "bg-amber-200 text-amber-900"
                              : notif.action_status === "accepted" ||
                                notif.action_status === "verified"
                              ? "bg-emerald-200 text-emerald-900"
                              : "bg-red-200 text-red-900"
                          }`}
                        >
                          {notif.action_status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{notif.message}</p>
                    </div>

                    {/* Action Buttons based on notification type */}
                    {notif.type === "fund_invitation" &&
                      notif.action_status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            data-testid="notif-invite-decline-btn"
                            onClick={() =>
                              handleRespondFundInvitation(notif.id, "decline")
                            }
                            className="rounded-xl border border-red-300 bg-white px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            data-testid="notif-invite-accept-btn"
                            onClick={() =>
                              handleRespondFundInvitation(notif.id, "accept")
                            }
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 cursor-pointer"
                          >
                            Accept
                          </button>
                        </div>
                      )}

                    {notif.type === "withdrawal_verification" &&
                      notif.action_status === "pending" &&
                      notif.withdrawal_request_id && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            data-testid="notif-verify-decline-btn"
                            onClick={() =>
                              handleDeclineWithdrawalVerification(
                                notif.withdrawal_request_id!,
                                notif.id
                              )
                            }
                            className="rounded-xl border border-red-300 bg-white px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            data-testid="notif-verify-face-btn"
                            onClick={() =>
                              setVerifyModalTarget({
                                requestId: notif.withdrawal_request_id!,
                                notificationId: notif.id,
                                fundName: notif.fund_name,
                                requesterUsername: notif.sender_username,
                                amountVnd: notif.amount_vnd || 0,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 cursor-pointer"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Verify
                          </button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* MAIN GRID: LEFT (CREATE FUND + FUNDS LIST) | RIGHT (SELECTED FUND WORKSPACE) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* LEFT COLUMN (5 cols): Create Fund + Co-Owned Funds List */}
          <div className="lg:col-span-5 space-y-6">
            {/* Create a Fund Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Create a Co-Owned Fund (VND)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Set initial amount in VND and invite Supabase users by
                    username or email
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateFund} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fund Name
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="create-fund-name-input"
                    value={newFundName}
                    onChange={(e) => setNewFundName(e.target.value)}
                    placeholder="e.g. Family Emergency Joint Savings"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Amount (in VND)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    data-testid="create-fund-amount-input"
                    value={newFundAmountVnd}
                    onChange={(e) => setNewFundAmountVnd(e.target.value)}
                    placeholder="e.g. 25000000"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Invite Co-Owners (Username or Email in Supabase)
                  </label>
                  <input
                    type="text"
                    data-testid="create-fund-invites-input"
                    value={newFundInvitesInput}
                    onChange={(e) => setNewFundInvitesInput(e.target.value)}
                    placeholder="e.g. binh.tran@gmail.com, cuong_le"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                  {/* Quick-select registered users from Supabase */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-[11px] text-slate-500 self-center mr-1">
                      Registered in Supabase:
                    </span>
                    {directory
                      .filter((u) => u.id !== currentUser.id)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleInviteUsernameInCreate(u.email)}
                          className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer"
                        >
                          + {u.username} ({u.email})
                        </button>
                      ))}
                  </div>
                </div>

                {createFundMsg && (
                  <div
                    data-testid="create-fund-feedback"
                    className={`rounded-xl p-3 text-xs font-medium ${
                      createFundMsg.type === "success"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {createFundMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  data-testid="create-fund-submit-btn"
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800 transition cursor-pointer"
                >
                  Create Fund & Send Invitations
                </button>
              </form>
            </div>

            {/* My Co-Owned Funds List */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                  Your Co-Owned Funds ({funds.length})
                </h2>
              </div>

              {funds.length === 0 ? (
                <p className="text-xs text-slate-500">
                  You don&apos;t belong to any funds yet. Create one above or
                  accept an invitation in your top-right Notification box.
                </p>
              ) : (
                <div className="space-y-3">
                  {funds.map((fund) => {
                    const isSelected = selectedFund?.id === fund.id;
                    const activeCoOwners = fund.members.filter(
                      (m) => m.status === "active"
                    );
                    return (
                      <button
                        key={fund.id}
                        type="button"
                        data-testid={`select-fund-${fund.id}`}
                        onClick={() => {
                          setSelectedFundId(fund.id);
                          setOperationFeedback(null);
                        }}
                        className={`w-full rounded-xl border p-4 text-left transition cursor-pointer ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">
                            {fund.name}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                            {activeCoOwners.length} Co-Owners
                          </span>
                        </div>
                        <div className="mt-2 text-lg font-extrabold text-emerald-700">
                          {Number(fund.balance_vnd).toLocaleString("en-US")} VND
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Co-owners:{" "}
                          {activeCoOwners.map((m) => m.username).join(", ")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (7 cols): Selected Fund Details ("Add Fund" vs "Deduct Fund" + Approvals) */}
          <div className="lg:col-span-7 space-y-6">
            {!selectedFund ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Select or create a fund on the left to manage funds and
                verifications.
              </div>
            ) : (
              <>
                {/* Fund Header & Balance Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                        Active Joint Bank Account
                      </span>
                      <h2
                        data-testid="selected-fund-name"
                        className="text-2xl font-extrabold text-slate-900 mt-0.5"
                      >
                        {selectedFund.name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedFund.description}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-900 to-slate-900 px-5 py-4 text-white min-w-[230px]">
                      <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
                        Current Saved Balance
                      </span>
                      <div
                        data-testid="selected-fund-balance"
                        className="text-2xl font-black mt-1 text-white"
                      >
                        {Number(selectedFund.balance_vnd).toLocaleString(
                          "en-US"
                        )}{" "}
                        VND
                      </div>
                    </div>
                  </div>

                  {/* Co-Owners Directory & Invite Bar inside Fund */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-slate-600" />
                        Fund Co-Owners & Membership Status
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedFund.members.map((m) => (
                        <div
                          key={m.id}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${
                            m.status === "active"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : m.status === "invited"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-red-200 bg-red-50 text-red-800"
                          }`}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span className="font-bold">{m.username}</span>
                          <span className="text-[11px] opacity-75">
                            ({m.email})
                          </span>
                          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            {m.status}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Invite another registered user to this fund */}
                    <form
                      onSubmit={handleInviteToExistingFund}
                      className="flex flex-col sm:flex-row gap-2 pt-1"
                    >
                      <input
                        type="text"
                        data-testid="invite-existing-fund-input"
                        value={inviteIdentifier}
                        onChange={(e) => setInviteIdentifier(e.target.value)}
                        placeholder="Invite another Supabase user by username or email..."
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                      />
                      <button
                        type="submit"
                        data-testid="invite-existing-fund-btn"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200 cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Invite Co-Owner
                      </button>
                    </form>
                    {inviteFeedback && (
                      <p
                        className={`text-xs font-medium ${
                          inviteFeedback.type === "success"
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {inviteFeedback.text}
                      </p>
                    )}
                  </div>

                  {/* ==========================================================
                      TWO OPTIONS INSIDE THE FUND: "Add Fund" vs "Deduct Fund"
                     ========================================================== */}
                  <div className="border-t border-slate-100 pt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        data-testid="option-add-fund-btn"
                        onClick={() => {
                          setFundActionTab("add");
                          setOperationFeedback(null);
                        }}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-extrabold transition cursor-pointer ${
                          fundActionTab === "add"
                            ? "border-emerald-600 bg-emerald-600 text-white shadow"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        Add Fund
                      </button>

                      <button
                        type="button"
                        data-testid="option-deduct-fund-btn"
                        onClick={() => {
                          setFundActionTab("deduct");
                          setOperationFeedback(null);
                        }}
                        className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-extrabold transition cursor-pointer ${
                          fundActionTab === "deduct"
                            ? "border-amber-600 bg-amber-600 text-white shadow"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <ArrowDownRight className="h-4 w-4" />
                        Deduct Fund
                      </button>
                    </div>

                    <form
                      onSubmit={handleFundSubmitOperation}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          {fundActionTab === "add"
                            ? "Add Fund (Input money in VND > 0)"
                            : `Deduct Fund (Input money in VND > 0 and < ${selectedFund.balance_vnd.toLocaleString(
                                "en-US"
                              )} VND)`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Amount (in VND)
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            data-testid="fund-operation-amount-input"
                            value={operationAmountVnd}
                            onChange={(e) =>
                              setOperationAmountVnd(e.target.value)
                            }
                            placeholder={
                              fundActionTab === "add"
                                ? "e.g. 10000000"
                                : "e.g. 5000000"
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Purpose / Note (Optional)
                          </label>
                          <input
                            type="text"
                            data-testid="fund-operation-note-input"
                            value={operationNote}
                            onChange={(e) => setOperationNote(e.target.value)}
                            placeholder={
                              fundActionTab === "add"
                                ? "Monthly savings contribution"
                                : "Supplier invoice payment"
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      </div>

                      {operationFeedback && (
                        <div
                          data-testid="fund-operation-feedback"
                          className={`rounded-xl p-3.5 text-xs font-semibold ${
                            operationFeedback.type === "success"
                              ? "border border-emerald-300 bg-emerald-50 text-emerald-950"
                              : operationFeedback.type === "warning"
                              ? "border border-amber-300 bg-amber-50 text-amber-950"
                              : "border border-red-300 bg-red-50 text-red-900"
                          }`}
                        >
                          {operationFeedback.text}
                        </div>
                      )}

                      <button
                        type="submit"
                        data-testid="fund-operation-submit-btn"
                        className={`w-full rounded-xl py-2.5 text-xs font-extrabold text-white shadow transition cursor-pointer ${
                          fundActionTab === "add"
                            ? "bg-emerald-600 hover:bg-emerald-500"
                            : "bg-slate-900 hover:bg-slate-800"
                        }`}
                      >
                        Submit
                      </button>
                    </form>
                  </div>
                </div>

                {/* ============================================================
                    CO-OWNER DEDUCTION PROPOSALS & 3 STATUS LABELS:
                    "Approved" | "Waiting for approval" | "Rejected"
                   ============================================================ */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-emerald-600" />
                        Co-Owner Deduction Approvals & Face-ID Verification Status
                      </h3>
                      <p className="text-xs text-slate-500">
                        Track which co-owner approves, is yet to approve, or
                        rejects each deduction proposal via the 3 labels:{" "}
                        <strong>Approved</strong>,{" "}
                        <strong>Waiting for approval</strong>, or{" "}
                        <strong>Rejected</strong>.
                      </p>
                    </div>
                  </div>

                  {selectedFund.withdrawalRequests.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">
                      No deduction requests submitted for this fund yet. Click
                      &ldquo;Deduct Fund&rdquo; above and submit an amount to
                      initiate co-owner Face-ID verification.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedFund.withdrawalRequests.map((req) => {
                        const allApproved =
                          req.approvals.length > 0 &&
                          req.approvals.every((a) => a.status === "Approved");
                        const myPendingApproval = req.approvals.find(
                          (a) =>
                            a.co_owner_id === currentUser.id &&
                            a.status === "Waiting for approval"
                        );

                        return (
                          <div
                            key={req.id}
                            data-testid={`withdrawal-request-card-${req.id}`}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="text-xs font-extrabold text-slate-900">
                                  Requester: {req.requester_username} (
                                  {req.requester_email})
                                </span>
                                <div className="text-base font-black text-emerald-700">
                                  Deduct Amount:{" "}
                                  {Number(req.amount_vnd).toLocaleString(
                                    "en-US"
                                  )}{" "}
                                  VND
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  {req.reason} • Expires:{" "}
                                  {new Date(req.expires_at).toLocaleTimeString()}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {myPendingApproval && (
                                  <button
                                    type="button"
                                    data-testid={`proposal-verify-btn-${req.id}`}
                                    onClick={() =>
                                      setVerifyModalTarget({
                                        requestId: req.id,
                                        fundName: req.fund_name,
                                        requesterUsername:
                                          req.requester_username,
                                        amountVnd: req.amount_vnd,
                                      })
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 cursor-pointer"
                                  >
                                    <Camera className="h-3.5 w-3.5" />
                                    Verify via Face-ID
                                  </button>
                                )}

                                {allApproved &&
                                  req.requester_id === currentUser.id && (
                                    <button
                                      type="button"
                                      data-testid={`confirm-deduct-btn-${req.id}`}
                                      onClick={() =>
                                        handleExecuteApprovedWithdrawal(req.id)
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 cursor-pointer"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                      {req.deducted
                                        ? "Deduction Completed ✓"
                                        : "Deduct Fund Now"}
                                    </button>
                                  )}
                              </div>
                            </div>

                            {/* Co-Owner Status Table with exact 3 labels */}
                            <div className="border-t border-slate-200 pt-3 space-y-2">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Co-Owner Verification Decisions:
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {req.approvals.map((appr) => (
                                  <div
                                    key={appr.id}
                                    data-testid={`co-owner-approval-${appr.co_owner_username}`}
                                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                                  >
                                    <div>
                                      <div className="font-bold text-slate-900">
                                        {appr.co_owner_username}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {appr.co_owner_email}
                                      </div>
                                    </div>

                                    {/* STRICT 3 LABELS: "Approved" | "Waiting for approval" | "Rejected" */}
                                    <span
                                      data-testid={`approval-label-${appr.co_owner_username}`}
                                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                                        appr.status === "Approved"
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                          : appr.status === "Rejected"
                                          ? "bg-red-100 text-red-800 border border-red-300"
                                          : "bg-amber-100 text-amber-900 border border-amber-300"
                                      }`}
                                    >
                                      {appr.status === "Approved" && (
                                        <Check className="h-3 w-3" />
                                      )}
                                      {appr.status ===
                                        "Waiting for approval" && (
                                        <Clock className="h-3 w-3" />
                                      )}
                                      {appr.status === "Rejected" && (
                                        <XCircle className="h-3 w-3" />
                                      )}
                                      {appr.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ====================================================================
            KILO GATEWAY 5-KEY JWT ROTATOR, $0 FREE MODELS & 4 MCP SERVERS PANEL
           ==================================================================== */}
        <section
          data-testid="kilo-mcp-infrastructure-panel"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Kilo Gateway 5-API-Key JWT Rotator & MCP Server Infrastructure
                </h2>
                <p className="text-xs text-slate-500">
                  Auto-rotates across KILO_GATEWAY_API_1..5 on rate-limit/failure
                  • Free Models ($0/Mtok input & output) synced every 1 min
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="simulate-key-rotation-btn"
                onClick={handleRotateKiloKey}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Simulate API Key Rate-Limit & Rotate
              </button>
              <button
                type="button"
                data-testid="simulate-model-failover-btn"
                onClick={handleFailoverKiloModel}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 cursor-pointer"
              >
                <Cpu className="h-3.5 w-3.5" />
                Switch Rate-Limited Model
              </button>
            </div>
          </div>

          {kiloSnapshot && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* 5 Kilo Gateway API Keys */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>5 JWT Kilo Gateway API Keys Rotator</span>
                  <span
                    data-testid="active-kilo-key-indicator"
                    className="text-emerald-700"
                  >
                    Active: {kiloSnapshot.activeKeyEnvName}
                  </span>
                </div>
                <div className="space-y-2">
                  {kiloSnapshot.keys.map((k) => (
                    <div
                      key={k.envName}
                      data-testid={`kilo-key-row-${k.slot}`}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs ${
                        k.slot === kiloSnapshot.activeKeySlot
                          ? "border-emerald-500 bg-emerald-50/70"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-900">
                          {k.envName}
                        </span>
                        <span className="ml-2 text-[11px] text-slate-500">
                          ({k.maskedToken} • JWT)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            k.status === "active"
                              ? "bg-emerald-200 text-emerald-900"
                              : "bg-red-200 text-red-900"
                          }`}
                        >
                          {k.status}
                        </span>
                        {k.status !== "active" && (
                          <button
                            type="button"
                            onClick={() => handleRestoreKiloKey(k.slot)}
                            className="text-[11px] font-bold text-emerald-700 underline cursor-pointer"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Free AI Models ($0/Mtok) & 4 MCP Servers */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>
                      Free AI Models ($0 Input / $0 Output per Mtok •{" "}
                      {kiloSnapshot.refreshIntervalSeconds}s Auto-Refresh)
                    </span>
                    <span
                      data-testid="active-kilo-model-indicator"
                      className="text-emerald-700 font-mono"
                    >
                      Default: {kiloSnapshot.activeModel}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {kiloSnapshot.freeModels.slice(0, 6).map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          m.id === kiloSnapshot.activeModel
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="font-mono font-bold text-slate-900 truncate">
                          {m.id}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                          <span>
                            In: ${m.inputPricePerMtok}/Mtok • Out: $
                            {m.outputPricePerMtok}/Mtok
                          </span>
                          <span className="font-semibold text-emerald-700">
                            {m.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4 Connected MCP Servers */}
                <div>
                  <div className="text-xs font-bold text-slate-700 mb-2">
                    Connected MCP Servers (Yunleng, Tide Raziel, Everything
                    Claude Code, Microsoft Playwright)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mcpServers.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {s.name}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {s.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {s.url}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Face Recognition & 4-Way Head Movement Modal */}
      {verifyModalTarget && (
        <FaceVerificationModal
          isOpen={true}
          onClose={() => setVerifyModalTarget(null)}
          coOwnerId={currentUser.id}
          coOwnerUsername={currentUser.username}
          coOwnerEmail={currentUser.email}
          requestId={verifyModalTarget.requestId}
          notificationId={verifyModalTarget.notificationId}
          fundName={verifyModalTarget.fundName}
          requesterUsername={verifyModalTarget.requesterUsername}
          amountVnd={verifyModalTarget.amountVnd}
          activeKiloKey={
            kiloSnapshot?.activeKeyEnvName || "KILO_GATEWAY_API_1"
          }
          activeKiloModel={kiloSnapshot?.activeModel || "openrouter/free"}
          onVerifiedSuccess={() => fetchDashboard(currentUser.id)}
        />
      )}
    </div>
  );
}
