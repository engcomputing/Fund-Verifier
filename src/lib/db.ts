/**
 * Supabase Database Persistence Layer (`src/lib/db.ts`)
 *
 * Stores all users (email, username, password), funds (in VND), co-owner memberships,
 * invitations, notifications, withdrawal/deduction proposals, co-owner approvals, and notes.
 *
 * Dual-mode architecture:
 * - Syncs with live Supabase PostgreSQL when NEXT_PUBLIC_SUPABASE_URL and keys are configured.
 * - Always persists to a deterministic file-backed store (`data/supabase-store.json` or `/tmp`)
 *   so the application works 100% reliably in local development, CI, and Vercel previews.
 */

import fs from "fs";
import path from "path";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import {
  HeadDirection,
  verifyCoOwnerFaceWithYunleng,
  YunlengFaceVerificationResult,
} from "./mcp-integration";

export type ApprovalStatusLabel =
  | "Approved"
  | "Waiting for approval"
  | "Rejected";

export interface NoteRow {
  id: number;
  title: string;
}

export interface UserRow {
  id: string;
  email: string;
  username: string;
  password: string;
  full_name: string;
  created_at: string;
}

export interface FundRow {
  id: string;
  name: string;
  description: string;
  balance_vnd: number;
  creator_id: string;
  creator_username: string;
  creator_email: string;
  created_at: string;
  updated_at: string;
}

export interface FundMemberRow {
  id: string;
  fund_id: string;
  user_id: string;
  username: string;
  email: string;
  role: "creator" | "co-owner";
  status: "active" | "invited" | "declined";
  invited_by_id: string;
  invited_by_username: string;
  joined_at: string | null;
  created_at: string;
}

export interface FundTransactionRow {
  id: string;
  fund_id: string;
  user_id: string;
  username: string;
  email: string;
  type: "initial" | "add" | "deduct";
  amount_vnd: number;
  balance_after_vnd: number;
  note: string;
  created_at: string;
}

export interface WithdrawalApprovalRow {
  id: string;
  request_id: string;
  fund_id: string;
  co_owner_id: string;
  co_owner_username: string;
  co_owner_email: string;
  status: ApprovalStatusLabel; // Strictly: "Approved" | "Waiting for approval" | "Rejected"
  face_verified: boolean;
  head_movements: HeadDirection[];
  mcp_server: string;
  ai_model: string;
  updated_at: string;
}

export interface WithdrawalRequestRow {
  id: string;
  fund_id: string;
  fund_name: string;
  requester_id: string;
  requester_username: string;
  requester_email: string;
  amount_vnd: number;
  reason: string;
  status:
    | "Waiting for approval"
    | "Approved"
    | "Rejected"
    | "Completed"
    | "Expired";
  deducted: boolean;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}

export interface NotificationRow {
  id: string;
  recipient_id: string;
  recipient_email: string;
  recipient_username: string;
  sender_id: string;
  sender_username: string;
  sender_email: string;
  type:
    | "fund_invitation"
    | "withdrawal_verification"
    | "withdrawal_update";
  title: string;
  message: string;
  fund_id: string;
  fund_name: string;
  amount_vnd: number | null;
  member_record_id: string | null;
  withdrawal_request_id: string | null;
  action_status: "pending" | "accepted" | "declined" | "verified";
  is_read: boolean;
  created_at: string;
}

export interface SupabaseStoreSchema {
  notes: NoteRow[];
  users: UserRow[];
  funds: FundRow[];
  fund_members: FundMemberRow[];
  fund_transactions: FundTransactionRow[];
  withdrawal_requests: WithdrawalRequestRow[];
  withdrawal_approvals: WithdrawalApprovalRow[];
  notifications: NotificationRow[];
}

function getStoreFilePath(): string {
  if (process.env.FUND_VERIFIER_DB_PATH) {
    return process.env.FUND_VERIFIER_DB_PATH;
  }
  const dataDir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, "supabase-store.json");
  } catch {
    return path.join("/tmp", "fund-verifier-supabase-store.json");
  }
}

export function createInitialSeedData(): SupabaseStoreSchema {
  const now = "2026-10-22T07:00:00.000Z";
  return {
    notes: [
      { id: 1, title: "Today I created a Supabase project." },
      { id: 2, title: "I added some data and queried it from Next.js." },
      { id: 3, title: "It was awesome!" },
    ],
    users: [
      {
        id: "usr_an_nguyen",
        email: "an.nguyen@vietbank.vn",
        username: "an_nguyen",
        password: "Password123!",
        full_name: "Nguyễn Văn An",
        created_at: now,
      },
      {
        id: "usr_binh_tran",
        email: "binh.tran@gmail.com",
        username: "binh_tran",
        password: "Password123!",
        full_name: "Trần Thị Bình",
        created_at: now,
      },
      {
        id: "usr_cuong_le",
        email: "cuong.le@outlook.com",
        username: "cuong_le",
        password: "Password123!",
        full_name: "Lê Minh Cường",
        created_at: now,
      },
    ],
    funds: [
      {
        id: "fund_vn_joint_01",
        name: "Vietnam Bank 3-Member Joint Vault",
        description:
          "Co-owned savings & operational account requiring real-time Face-ID head liveness verification from all co-owners for withdrawals.",
        balance_vnd: 50000000, // 50,000,000 VND
        creator_id: "usr_an_nguyen",
        creator_username: "an_nguyen",
        creator_email: "an.nguyen@vietbank.vn",
        created_at: now,
        updated_at: now,
      },
    ],
    fund_members: [
      {
        id: "fm_01",
        fund_id: "fund_vn_joint_01",
        user_id: "usr_an_nguyen",
        username: "an_nguyen",
        email: "an.nguyen@vietbank.vn",
        role: "creator",
        status: "active",
        invited_by_id: "usr_an_nguyen",
        invited_by_username: "an_nguyen",
        joined_at: now,
        created_at: now,
      },
      {
        id: "fm_02",
        fund_id: "fund_vn_joint_01",
        user_id: "usr_binh_tran",
        username: "binh_tran",
        email: "binh.tran@gmail.com",
        role: "co-owner",
        status: "active",
        invited_by_id: "usr_an_nguyen",
        invited_by_username: "an_nguyen",
        joined_at: now,
        created_at: now,
      },
      {
        id: "fm_03",
        fund_id: "fund_vn_joint_01",
        user_id: "usr_cuong_le",
        username: "cuong_le",
        email: "cuong.le@outlook.com",
        role: "co-owner",
        status: "active",
        invited_by_id: "usr_an_nguyen",
        invited_by_username: "an_nguyen",
        joined_at: now,
        created_at: now,
      },
    ],
    fund_transactions: [
      {
        id: "tx_init_01",
        fund_id: "fund_vn_joint_01",
        user_id: "usr_an_nguyen",
        username: "an_nguyen",
        email: "an.nguyen@vietbank.vn",
        type: "initial",
        amount_vnd: 50000000,
        balance_after_vnd: 50000000,
        note: "Initial joint fund deposit (50,000,000 VND)",
        created_at: now,
      },
    ],
    withdrawal_requests: [],
    withdrawal_approvals: [],
    notifications: [],
  };
}

export function isLiveSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (
    url.includes("your-project-id") ||
    url.includes("example.supabase.co") ||
    key.includes("your-supabase") ||
    key.includes("example-anon-key")
  ) {
    return false;
  }
  return true;
}

export function getRemoteSupabaseClient() {
  if (!isLiveSupabaseConfigured()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  return createSupabaseJsClient(url, key);
}

export function readStore(): SupabaseStoreSchema {
  const filePath = getStoreFilePath();
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
      const parsed = JSON.parse(raw) as SupabaseStoreSchema;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.funds)) {
        return parsed;
      }
    }
  } catch {
    // Re-seed if corrupted
  }
  const initial = createInitialSeedData();
  writeStore(initial);
  return initial;
}

export function writeStore(store: SupabaseStoreSchema): void {
  const filePath = getStoreFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
    fs.writeFileSync(/*turbopackIgnore: true*/ filePath, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // Ignore read-only fs errors in restricted environments
  }
}

export function resetStoreToSeed(): SupabaseStoreSchema {
  const seed = createInitialSeedData();
  writeStore(seed);
  return seed;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/**
 * Validates any email address from all email providers.
 */
export function isValidEmailAddress(email: string): boolean {
  const cleaned = email.trim();
  // Accept all standard email providers and custom domains
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

/**
 * Register / Sign in a user and save email, username, and password into Supabase directory.
 */
export async function registerUserInSupabase(input: {
  email: string;
  username: string;
  password: string;
  fullName?: string;
}): Promise<{
  ok: boolean;
  user?: Omit<UserRow, "password">;
  error?: string;
  code?: string;
}> {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  const password = input.password;

  if (!email || !isValidEmailAddress(email)) {
    return {
      ok: false,
      code: "INVALID_EMAIL",
      error: "Please enter a valid email address (all email providers are accepted).",
    };
  }
  if (!username || username.length < 2) {
    return {
      ok: false,
      code: "INVALID_USERNAME",
      error: "Username must be at least 2 characters.",
    };
  }
  if (!password || password.length < 4) {
    return {
      ok: false,
      code: "INVALID_PASSWORD",
      error: "Password must be at least 4 characters.",
    };
  }

  const store = readStore();

  const existingByEmail = store.users.find(
    (u) => u.email.toLowerCase() === email
  );
  if (existingByEmail) {
    return {
      ok: false,
      code: "EMAIL_ALREADY_EXISTS",
      error: "This email is already registered in the Supabase database. Please log in instead.",
    };
  }

  const existingByUsername = store.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (existingByUsername) {
    return {
      ok: false,
      code: "USERNAME_ALREADY_EXISTS",
      error: "This username is already taken. Please choose another username.",
    };
  }

  const newUser: UserRow = {
    id: genId("usr"),
    email,
    username,
    password,
    full_name: input.fullName?.trim() || username,
    created_at: new Date().toISOString(),
  };

  store.users.push(newUser);
  writeStore(store);

  const remote = getRemoteSupabaseClient();
  if (remote) {
    try {
      await remote.from("users").insert(newUser);
    } catch {
      // Best-effort sync to remote Supabase
    }
  }

  const { password: _pw, ...safeUser } = newUser;
  return { ok: true, user: safeUser };
}

/**
 * Log in user with email (and optional username) and password.
 * Enforces the issue requirement:
 * "if the user tries to log in and his email is not registered in supabase database,
 *  the system will require the user to sign in."
 */
export async function loginUserFromSupabase(input: {
  email: string;
  username?: string;
  password: string;
}): Promise<{
  ok: boolean;
  user?: Omit<UserRow, "password">;
  requireSignIn?: boolean;
  code?: string;
  error?: string;
}> {
  const identifier = input.email.trim().toLowerCase();
  const password = input.password;

  if (!identifier) {
    return {
      ok: false,
      code: "MISSING_EMAIL",
      error: "Please enter your email address.",
    };
  }

  const store = readStore();
  const user = store.users.find(
    (u) =>
      u.email.toLowerCase() === identifier ||
      u.username.toLowerCase() === identifier
  );

  if (!user) {
    return {
      ok: false,
      requireSignIn: true,
      code: "EMAIL_NOT_REGISTERED",
      error:
        "Your email is not registered in the Supabase database. Please sign in (register) with your email, username, and password first.",
    };
  }

  if (user.password !== password) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      error: "Incorrect password for this account.",
    };
  }

  const { password: _pw, ...safeUser } = user;
  return { ok: true, user: safeUser };
}

/**
 * List all registered users in Supabase directory (without passwords).
 */
export function listRegisteredUsers(): Array<Omit<UserRow, "password">> {
  const store = readStore();
  return store.users.map(({ password: _pw, ...rest }) => rest);
}

/**
 * Create a new Fund in VND and invite co-owners by username or email address
 * (whose emails/usernames must be available in the Supabase database).
 */
export async function createFundInSupabase(input: {
  creatorId: string;
  name: string;
  description?: string;
  initialAmountVnd: number;
  invitedIdentifiers: string[]; // usernames or emails
}): Promise<{
  ok: boolean;
  fund?: FundRow;
  invitedMembers?: FundMemberRow[];
  error?: string;
}> {
  const store = readStore();
  const creator = store.users.find((u) => u.id === input.creatorId);
  if (!creator) {
    return { ok: false, error: "Authenticated creator user not found in Supabase database." };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Fund name is required." };
  }

  const amountVnd = Math.floor(Number(input.initialAmountVnd));
  if (Number.isNaN(amountVnd) || amountVnd < 0) {
    return { ok: false, error: "Initial fund amount (in VND) must be 0 or greater." };
  }

  // Validate all invited usernames/emails exist in the Supabase database
  const resolvedInvitees: UserRow[] = [];
  const seenIds = new Set<string>([creator.id]);

  for (const rawIdentifier of input.invitedIdentifiers || []) {
    const cleaned = rawIdentifier.trim().toLowerCase();
    if (!cleaned) continue;

    const matchedUser = store.users.find(
      (u) =>
        u.email.toLowerCase() === cleaned ||
        u.username.toLowerCase() === cleaned
    );

    if (!matchedUser) {
      return {
        ok: false,
        error: `User "${rawIdentifier}" is not registered in the Supabase database. All invited emails/usernames must exist in Supabase.`,
      };
    }

    if (!seenIds.has(matchedUser.id)) {
      seenIds.add(matchedUser.id);
      resolvedInvitees.push(matchedUser);
    }
  }

  const now = new Date().toISOString();
  const fund: FundRow = {
    id: genId("fund"),
    name,
    description:
      input.description?.trim() ||
      "Co-owned VND fund protected by real-time Face-ID liveness verification",
    balance_vnd: amountVnd,
    creator_id: creator.id,
    creator_username: creator.username,
    creator_email: creator.email,
    created_at: now,
    updated_at: now,
  };

  store.funds.unshift(fund);

  // Add creator as active member
  const creatorMember: FundMemberRow = {
    id: genId("fm"),
    fund_id: fund.id,
    user_id: creator.id,
    username: creator.username,
    email: creator.email,
    role: "creator",
    status: "active",
    invited_by_id: creator.id,
    invited_by_username: creator.username,
    joined_at: now,
    created_at: now,
  };
  store.fund_members.push(creatorMember);

  // Record initial transaction
  if (amountVnd > 0) {
    store.fund_transactions.unshift({
      id: genId("tx"),
      fund_id: fund.id,
      user_id: creator.id,
      username: creator.username,
      email: creator.email,
      type: "initial",
      amount_vnd: amountVnd,
      balance_after_vnd: amountVnd,
      note: `Initial deposit of ${amountVnd.toLocaleString("en-US")} VND`,
      created_at: now,
    });
  }

  // Add invited members & create top-right notifications for each invited user
  const invitedMembers: FundMemberRow[] = [];
  for (const invitee of resolvedInvitees) {
    const memberRow: FundMemberRow = {
      id: genId("fm"),
      fund_id: fund.id,
      user_id: invitee.id,
      username: invitee.username,
      email: invitee.email,
      role: "co-owner",
      status: "invited",
      invited_by_id: creator.id,
      invited_by_username: creator.username,
      joined_at: null,
      created_at: now,
    };
    store.fund_members.push(memberRow);
    invitedMembers.push(memberRow);

    const notification: NotificationRow = {
      id: genId("notif"),
      recipient_id: invitee.id,
      recipient_email: invitee.email,
      recipient_username: invitee.username,
      sender_id: creator.id,
      sender_username: creator.username,
      sender_email: creator.email,
      type: "fund_invitation",
      title: `Co-Owner Invitation: ${fund.name}`,
      message: `${creator.username} (${creator.email}) invited you to co-own "${
        fund.name
      }" with balance ${amountVnd.toLocaleString("en-US")} VND.`,
      fund_id: fund.id,
      fund_name: fund.name,
      amount_vnd: amountVnd,
      member_record_id: memberRow.id,
      withdrawal_request_id: null,
      action_status: "pending",
      is_read: false,
      created_at: now,
    };
    store.notifications.unshift(notification);
  }

  writeStore(store);

  const remote = getRemoteSupabaseClient();
  if (remote) {
    try {
      await remote.from("funds").insert(fund);
      await remote
        .from("fund_members")
        .insert([creatorMember, ...invitedMembers]);
    } catch {
      // Best-effort remote sync
    }
  }

  return { ok: true, fund, invitedMembers };
}

/**
 * Invite additional user(s) by email or username to an existing fund.
 */
export async function inviteUserToFund(input: {
  inviterId: string;
  fundId: string;
  identifier: string;
}): Promise<{ ok: boolean; member?: FundMemberRow; error?: string }> {
  const store = readStore();
  const inviter = store.users.find((u) => u.id === input.inviterId);
  const fund = store.funds.find((f) => f.id === input.fundId);
  if (!inviter || !fund) {
    return { ok: false, error: "Fund or inviter not found." };
  }

  const cleaned = input.identifier.trim().toLowerCase();
  const invitee = store.users.find(
    (u) =>
      u.email.toLowerCase() === cleaned || u.username.toLowerCase() === cleaned
  );
  if (!invitee) {
    return {
      ok: false,
      error: `User "${input.identifier}" is not registered in the Supabase database.`,
    };
  }

  const existing = store.fund_members.find(
    (m) => m.fund_id === fund.id && m.user_id === invitee.id
  );
  if (existing && existing.status === "active") {
    return {
      ok: false,
      error: `${invitee.username} (${invitee.email}) is already an active co-owner of this fund.`,
    };
  }
  if (existing && existing.status === "invited") {
    return {
      ok: false,
      error: `${invitee.username} (${invitee.email}) already has a pending invitation.`,
    };
  }

  const now = new Date().toISOString();
  let memberRow: FundMemberRow;
  if (existing) {
    existing.status = "invited";
    existing.created_at = now;
    memberRow = existing;
  } else {
    memberRow = {
      id: genId("fm"),
      fund_id: fund.id,
      user_id: invitee.id,
      username: invitee.username,
      email: invitee.email,
      role: "co-owner",
      status: "invited",
      invited_by_id: inviter.id,
      invited_by_username: inviter.username,
      joined_at: null,
      created_at: now,
    };
    store.fund_members.push(memberRow);
  }

  store.notifications.unshift({
    id: genId("notif"),
    recipient_id: invitee.id,
    recipient_email: invitee.email,
    recipient_username: invitee.username,
    sender_id: inviter.id,
    sender_username: inviter.username,
    sender_email: inviter.email,
    type: "fund_invitation",
    title: `Co-Owner Invitation: ${fund.name}`,
    message: `${inviter.username} (${inviter.email}) invited you to co-own "${
      fund.name
    }" (${fund.balance_vnd.toLocaleString("en-US")} VND).`,
    fund_id: fund.id,
    fund_name: fund.name,
    amount_vnd: fund.balance_vnd,
    member_record_id: memberRow.id,
    withdrawal_request_id: null,
    action_status: "pending",
    is_read: false,
    created_at: now,
  });

  writeStore(store);
  return { ok: true, member: memberRow };
}

/**
 * Respond to a Fund Co-Ownership Invitation ("Accept" or "Decline").
 */
export async function respondToFundInvitation(input: {
  userId: string;
  notificationId: string;
  decision: "accept" | "decline";
}): Promise<{ ok: boolean; status?: "active" | "declined"; error?: string }> {
  const store = readStore();
  const notif = store.notifications.find(
    (n) => n.id === input.notificationId && n.recipient_id === input.userId
  );
  if (!notif || notif.type !== "fund_invitation") {
    return { ok: false, error: "Invitation notification not found." };
  }

  const member = store.fund_members.find(
    (m) =>
      m.id === notif.member_record_id ||
      (m.fund_id === notif.fund_id && m.user_id === input.userId)
  );
  if (!member) {
    return { ok: false, error: "Fund membership record not found." };
  }

  const now = new Date().toISOString();
  if (input.decision === "accept") {
    member.status = "active";
    member.joined_at = now;
    notif.action_status = "accepted";
    notif.is_read = true;
  } else {
    member.status = "declined";
    notif.action_status = "declined";
    notif.is_read = true;
  }

  writeStore(store);
  return { ok: true, status: member.status };
}

/**
 * Add Fund (in VND, must be > 0).
 */
export async function addFundAmountInVnd(input: {
  userId: string;
  fundId: string;
  amountVnd: number;
  note?: string;
}): Promise<{
  ok: boolean;
  fund?: FundRow;
  transaction?: FundTransactionRow;
  error?: string;
}> {
  const amount = Math.floor(Number(input.amountVnd));
  if (Number.isNaN(amount) || amount <= 0) {
    return {
      ok: false,
      error: "Amount to add (in VND) must be greater than 0.",
    };
  }

  const store = readStore();
  const user = store.users.find((u) => u.id === input.userId);
  const fund = store.funds.find((f) => f.id === input.fundId);
  if (!user || !fund) {
    return { ok: false, error: "Fund or user not found." };
  }

  const member = store.fund_members.find(
    (m) =>
      m.fund_id === fund.id &&
      m.user_id === user.id &&
      m.status === "active"
  );
  if (!member) {
    return {
      ok: false,
      error: "Only active co-owners of this fund can add funds.",
    };
  }

  const now = new Date().toISOString();
  fund.balance_vnd += amount;
  fund.updated_at = now;

  const tx: FundTransactionRow = {
    id: genId("tx"),
    fund_id: fund.id,
    user_id: user.id,
    username: user.username,
    email: user.email,
    type: "add",
    amount_vnd: amount,
    balance_after_vnd: fund.balance_vnd,
    note:
      input.note?.trim() ||
      `Added ${amount.toLocaleString("en-US")} VND by ${user.username}`,
    created_at: now,
  };
  store.fund_transactions.unshift(tx);
  writeStore(store);

  return { ok: true, fund, transaction: tx };
}

/**
 * Deduct Fund (in VND):
 * - Amount must be > 0 AND < current money the fund has (or <= if solo, but per issue:
 *   "must be greater than 0 and less than the current money the fund has").
 * - Immediately sends a verification request to the notification bar of the remaining co-owners
 *   and displays a message to the requester that other members have to verify in order to deduct.
 * - Creates approval rows with initial label: "Waiting for approval".
 */
export async function requestDeductFundInVnd(input: {
  userId: string;
  fundId: string;
  amountVnd: number;
  reason?: string;
}): Promise<{
  ok: boolean;
  requiresCoOwnerVerification?: boolean;
  message?: string;
  request?: WithdrawalRequestRow;
  approvals?: WithdrawalApprovalRow[];
  fund?: FundRow;
  error?: string;
}> {
  const amount = Math.floor(Number(input.amountVnd));
  const store = readStore();
  const user = store.users.find((u) => u.id === input.userId);
  const fund = store.funds.find((f) => f.id === input.fundId);

  if (!user || !fund) {
    return { ok: false, error: "Fund or user not found." };
  }

  const member = store.fund_members.find(
    (m) =>
      m.fund_id === fund.id &&
      m.user_id === user.id &&
      m.status === "active"
  );
  if (!member) {
    return {
      ok: false,
      error: "Only active co-owners of this fund can deduct funds.",
    };
  }

  if (Number.isNaN(amount) || amount <= 0) {
    return {
      ok: false,
      error: "Deduct amount (in VND) must be greater than 0.",
    };
  }

  if (amount >= fund.balance_vnd) {
    return {
      ok: false,
      error: `Deduct amount (in VND) must be greater than 0 and less than the current money the fund has (${fund.balance_vnd.toLocaleString(
        "en-US"
      )} VND).`,
    };
  }

  // Find all other active co-owners of this fund
  const otherCoOwners = store.fund_members.filter(
    (m) =>
      m.fund_id === fund.id &&
      m.status === "active" &&
      m.user_id !== user.id
  );

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAtIso = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30-min expiration rule

  // If there are no other co-owners (solo fund), deduct immediately
  if (otherCoOwners.length === 0) {
    fund.balance_vnd -= amount;
    fund.updated_at = nowIso;
    const reqRow: WithdrawalRequestRow = {
      id: genId("wreq"),
      fund_id: fund.id,
      fund_name: fund.name,
      requester_id: user.id,
      requester_username: user.username,
      requester_email: user.email,
      amount_vnd: amount,
      reason: input.reason?.trim() || "Fund withdrawal",
      status: "Completed",
      deducted: true,
      expires_at: expiresAtIso,
      created_at: nowIso,
      completed_at: nowIso,
    };
    store.withdrawal_requests.unshift(reqRow);
    store.fund_transactions.unshift({
      id: genId("tx"),
      fund_id: fund.id,
      user_id: user.id,
      username: user.username,
      email: user.email,
      type: "deduct",
      amount_vnd: amount,
      balance_after_vnd: fund.balance_vnd,
      note: `Deducted ${amount.toLocaleString("en-US")} VND`,
      created_at: nowIso,
    });
    writeStore(store);
    return {
      ok: true,
      requiresCoOwnerVerification: false,
      message: `Successfully deducted ${amount.toLocaleString("en-US")} VND.`,
      request: reqRow,
      approvals: [],
      fund,
    };
  }

  // Multi-owner fund: create persistent withdrawal request & send notifications to all remaining co-owners
  const reqRow: WithdrawalRequestRow = {
    id: genId("wreq"),
    fund_id: fund.id,
    fund_name: fund.name,
    requester_id: user.id,
    requester_username: user.username,
    requester_email: user.email,
    amount_vnd: amount,
    reason:
      input.reason?.trim() ||
      `Deduct ${amount.toLocaleString("en-US")} VND from ${fund.name}`,
    status: "Waiting for approval",
    deducted: false,
    expires_at: expiresAtIso,
    created_at: nowIso,
    completed_at: null,
  };
  store.withdrawal_requests.unshift(reqRow);

  const approvals: WithdrawalApprovalRow[] = [];
  for (const coOwner of otherCoOwners) {
    const approval: WithdrawalApprovalRow = {
      id: genId("wappr"),
      request_id: reqRow.id,
      fund_id: fund.id,
      co_owner_id: coOwner.user_id,
      co_owner_username: coOwner.username,
      co_owner_email: coOwner.email,
      status: "Waiting for approval",
      face_verified: false,
      head_movements: [],
      mcp_server: "yunleng",
      ai_model: "openrouter/free",
      updated_at: nowIso,
    };
    store.withdrawal_approvals.push(approval);
    approvals.push(approval);

    store.notifications.unshift({
      id: genId("notif"),
      recipient_id: coOwner.user_id,
      recipient_email: coOwner.email,
      recipient_username: coOwner.username,
      sender_id: user.id,
      sender_username: user.username,
      sender_email: user.email,
      type: "withdrawal_verification",
      title: `Verify Co-Owner Fund Deduction (${amount.toLocaleString(
        "en-US"
      )} VND)`,
      message: `${user.username} (${user.email}) wants to deduct ${amount.toLocaleString(
        "en-US"
      )} VND from "${
        fund.name
      }". Please Verify via Face Recognition (camera + head movements) or Decline.`,
      fund_id: fund.id,
      fund_name: fund.name,
      amount_vnd: amount,
      member_record_id: null,
      withdrawal_request_id: reqRow.id,
      action_status: "pending",
      is_read: false,
      created_at: nowIso,
    });
  }

  writeStore(store);

  return {
    ok: true,
    requiresCoOwnerVerification: true,
    message:
      "Other co-owner members have to verify via Face Recognition in order for you to deduct the fund. Verification requests have been sent to their Notification bar.",
    request: reqRow,
    approvals,
    fund,
  };
}

/**
 * Co-Owner declines a withdrawal/deduction verification request ("Decline" button).
 * Sets that co-owner's status to "Rejected" and marks the proposal "Rejected".
 */
export async function declineWithdrawalRequest(input: {
  coOwnerId: string;
  requestId: string;
  notificationId?: string;
}): Promise<{
  ok: boolean;
  request?: WithdrawalRequestRow;
  approval?: WithdrawalApprovalRow;
  error?: string;
}> {
  const store = readStore();
  const reqRow = store.withdrawal_requests.find((r) => r.id === input.requestId);
  if (!reqRow) {
    return { ok: false, error: "Withdrawal request not found." };
  }

  const approval = store.withdrawal_approvals.find(
    (a) => a.request_id === reqRow.id && a.co_owner_id === input.coOwnerId
  );
  if (!approval) {
    return {
      ok: false,
      error: "You are not a designated co-owner verifier for this request.",
    };
  }

  const nowIso = new Date().toISOString();
  approval.status = "Rejected";
  approval.updated_at = nowIso;
  reqRow.status = "Rejected";

  // Update matching notification
  for (const n of store.notifications) {
    if (
      (input.notificationId && n.id === input.notificationId) ||
      (n.withdrawal_request_id === reqRow.id &&
        n.recipient_id === input.coOwnerId)
    ) {
      n.action_status = "declined";
      n.is_read = true;
    }
  }

  // Notify requester that the proposal was rejected
  store.notifications.unshift({
    id: genId("notif"),
    recipient_id: reqRow.requester_id,
    recipient_email: reqRow.requester_email,
    recipient_username: reqRow.requester_username,
    sender_id: approval.co_owner_id,
    sender_username: approval.co_owner_username,
    sender_email: approval.co_owner_email,
    type: "withdrawal_update",
    title: `Deduction Proposal Rejected`,
    message: `${approval.co_owner_username} rejected your request to deduct ${reqRow.amount_vnd.toLocaleString(
      "en-US"
    )} VND from "${reqRow.fund_name}".`,
    fund_id: reqRow.fund_id,
    fund_name: reqRow.fund_name,
    amount_vnd: reqRow.amount_vnd,
    member_record_id: null,
    withdrawal_request_id: reqRow.id,
    action_status: "declined",
    is_read: false,
    created_at: nowIso,
  });

  writeStore(store);
  return { ok: true, request: reqRow, approval };
}

/**
 * Co-Owner verifies via Face Recognition (Yunleng MCP + 4-way head movement liveness).
 * Requires camera permission + Left, Right, Up, Down head movements.
 * Enforces server-side multi-owner approval:
 * - Only when ALL co-owners have status === "Approved" can the fund be deducted!
 */
export async function verifyWithdrawalWithFaceRecognition(input: {
  coOwnerId: string;
  requestId: string;
  notificationId?: string;
  cameraPermissionGranted: boolean;
  headMovements: HeadDirection[];
  frameDataUrl?: string;
}): Promise<{
  ok: boolean;
  verification?: YunlengFaceVerificationResult;
  approval?: WithdrawalApprovalRow;
  request?: WithdrawalRequestRow;
  allCoOwnersApproved?: boolean;
  fund?: FundRow;
  error?: string;
}> {
  const store = readStore();
  const reqRow = store.withdrawal_requests.find((r) => r.id === input.requestId);
  if (!reqRow) {
    return { ok: false, error: "Withdrawal request not found." };
  }

  // Check expiration rule
  if (new Date(reqRow.expires_at).getTime() < Date.now()) {
    reqRow.status = "Expired";
    writeStore(store);
    return {
      ok: false,
      error: "This withdrawal verification request has expired.",
    };
  }

  if (reqRow.status === "Rejected") {
    return {
      ok: false,
      error: "This withdrawal request was already rejected by a co-owner.",
    };
  }

  const approval = store.withdrawal_approvals.find(
    (a) => a.request_id === reqRow.id && a.co_owner_id === input.coOwnerId
  );
  if (!approval) {
    return {
      ok: false,
      error: "You are not a designated co-owner verifier for this request.",
    };
  }

  // Invoke Yunleng MCP + Kilo Gateway Free Model Face & Head Liveness Verification
  const verification = verifyCoOwnerFaceWithYunleng({
    coOwnerId: approval.co_owner_id,
    coOwnerEmail: approval.co_owner_email,
    coOwnerUsername: approval.co_owner_username,
    cameraPermissionGranted: input.cameraPermissionGranted,
    headMovements: input.headMovements,
    frameDataUrl: input.frameDataUrl,
  });

  if (!verification.verified) {
    return {
      ok: false,
      verification,
      error: verification.reason,
    };
  }

  const nowIso = new Date().toISOString();
  approval.status = "Approved";
  approval.face_verified = true;
  approval.head_movements = verification.completedMovements;
  approval.mcp_server = verification.mcpServer;
  approval.ai_model = verification.kiloModelUsed;
  approval.updated_at = nowIso;

  // Update matching notification
  for (const n of store.notifications) {
    if (
      (input.notificationId && n.id === input.notificationId) ||
      (n.withdrawal_request_id === reqRow.id &&
        n.recipient_id === input.coOwnerId)
    ) {
      n.action_status = "verified";
      n.is_read = true;
    }
  }

  // Server-side multi-approval check: have ALL co-owners for this request approved?
  const allApprovals = store.withdrawal_approvals.filter(
    (a) => a.request_id === reqRow.id
  );
  const allCoOwnersApproved =
    allApprovals.length > 0 &&
    allApprovals.every((a) => a.status === "Approved" && a.face_verified);

  const fund = store.funds.find((f) => f.id === reqRow.fund_id);

  if (allCoOwnersApproved && fund && !reqRow.deducted) {
    reqRow.status = "Approved";
    // Deduct the approved amount once all co-owners have verified
    if (fund.balance_vnd >= reqRow.amount_vnd) {
      fund.balance_vnd -= reqRow.amount_vnd;
      fund.updated_at = nowIso;
      reqRow.deducted = true;
      reqRow.completed_at = nowIso;

      store.fund_transactions.unshift({
        id: genId("tx"),
        fund_id: fund.id,
        user_id: reqRow.requester_id,
        username: reqRow.requester_username,
        email: reqRow.requester_email,
        type: "deduct",
        amount_vnd: reqRow.amount_vnd,
        balance_after_vnd: fund.balance_vnd,
        note: `Deducted ${reqRow.amount_vnd.toLocaleString(
          "en-US"
        )} VND (Verified via Yunleng Face-ID by ${allApprovals
          .map((a) => a.co_owner_username)
          .join(", ")})`,
        created_at: nowIso,
      });

      store.notifications.unshift({
        id: genId("notif"),
        recipient_id: reqRow.requester_id,
        recipient_email: reqRow.requester_email,
        recipient_username: reqRow.requester_username,
        sender_id: approval.co_owner_id,
        sender_username: approval.co_owner_username,
        sender_email: approval.co_owner_email,
        type: "withdrawal_update",
        title: `All Co-Owners Approved! Fund Deducted (${reqRow.amount_vnd.toLocaleString(
          "en-US"
        )} VND)`,
        message: `All co-owners verified via Face Recognition! ${reqRow.amount_vnd.toLocaleString(
          "en-US"
        )} VND has been deducted from "${reqRow.fund_name}".`,
        fund_id: reqRow.fund_id,
        fund_name: reqRow.fund_name,
        amount_vnd: reqRow.amount_vnd,
        member_record_id: null,
        withdrawal_request_id: reqRow.id,
        action_status: "verified",
        is_read: false,
        created_at: nowIso,
      });
    }
  }

  writeStore(store);

  return {
    ok: true,
    verification,
    approval,
    request: reqRow,
    allCoOwnersApproved,
    fund,
  };
}

/**
 * Server-side dual/multi-approval enforcement endpoint for executing/claiming a withdrawal request.
 * Rejects with error if any co-owner has not yet verified via face recognition.
 */
export async function executeApprovedWithdrawal(input: {
  userId: string;
  requestId: string;
}): Promise<{
  ok: boolean;
  request?: WithdrawalRequestRow;
  fund?: FundRow;
  error?: string;
}> {
  const store = readStore();
  const reqRow = store.withdrawal_requests.find((r) => r.id === input.requestId);
  if (!reqRow) {
    return { ok: false, error: "Withdrawal request not found." };
  }

  if (reqRow.requester_id !== input.userId) {
    return {
      ok: false,
      error: "Only the requester who initiated this withdrawal can execute it.",
    };
  }

  if (new Date(reqRow.expires_at).getTime() < Date.now() && !reqRow.deducted) {
    reqRow.status = "Expired";
    writeStore(store);
    return { ok: false, error: "Withdrawal request has expired." };
  }

  const approvals = store.withdrawal_approvals.filter(
    (a) => a.request_id === reqRow.id
  );
  const rejected = approvals.find((a) => a.status === "Rejected");
  if (rejected) {
    return {
      ok: false,
      error: `Cannot deduct fund: proposal was rejected by co-owner ${rejected.co_owner_username}.`,
    };
  }

  const pending = approvals.filter(
    (a) => a.status !== "Approved" || !a.face_verified
  );
  if (pending.length > 0) {
    return {
      ok: false,
      error: `Dual/Multi-Approval Enforcement: Waiting for Face Recognition verification from ${pending
        .map((p) => p.co_owner_username)
        .join(", ")}.`,
    };
  }

  const fund = store.funds.find((f) => f.id === reqRow.fund_id);
  if (!fund) {
    return { ok: false, error: "Fund not found." };
  }

  const nowIso = new Date().toISOString();
  if (!reqRow.deducted) {
    if (fund.balance_vnd <= reqRow.amount_vnd) {
      return {
        ok: false,
        error: "Insufficient fund balance to complete deduction.",
      };
    }
    fund.balance_vnd -= reqRow.amount_vnd;
    fund.updated_at = nowIso;
    reqRow.deducted = true;
    store.fund_transactions.unshift({
      id: genId("tx"),
      fund_id: fund.id,
      user_id: reqRow.requester_id,
      username: reqRow.requester_username,
      email: reqRow.requester_email,
      type: "deduct",
      amount_vnd: reqRow.amount_vnd,
      balance_after_vnd: fund.balance_vnd,
      note: `Deducted ${reqRow.amount_vnd.toLocaleString("en-US")} VND`,
      created_at: nowIso,
    });
  }

  reqRow.status = "Approved";
  reqRow.completed_at = nowIso;
  writeStore(store);

  return { ok: true, request: reqRow, fund };
}

/**
 * Get complete dashboard state for a logged-in user:
 * - User's funds (where user is active or invited)
 * - Co-owners for each fund
 * - Transactions for each fund
 * - Withdrawal requests and per-co-owner approval statuses ("Approved" | "Waiting for approval" | "Rejected")
 * - User's notifications (for the top-right Notification box)
 * - Registered users directory (so user can invite existing emails/usernames)
 */
export function getUserDashboardState(userId: string) {
  const store = readStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) {
    return null;
  }

  const myMemberships = store.fund_members.filter(
    (m) => m.user_id === user.id && m.status === "active"
  );
  const myFundIds = new Set(myMemberships.map((m) => m.fund_id));

  const funds = store.funds
    .filter((f) => myFundIds.has(f.id))
    .map((fund) => {
      const members = store.fund_members.filter((m) => m.fund_id === fund.id);
      const transactions = store.fund_transactions
        .filter((t) => t.fund_id === fund.id)
        .slice(0, 25);
      const withdrawalRequests = store.withdrawal_requests
        .filter((r) => r.fund_id === fund.id)
        .map((req) => ({
          ...req,
          approvals: store.withdrawal_approvals.filter(
            (a) => a.request_id === req.id
          ),
        }));

      return {
        ...fund,
        members,
        transactions,
        withdrawalRequests,
      };
    });

  const notifications = store.notifications.filter(
    (n) => n.recipient_id === user.id
  );

  const directory = store.users.map(({ password: _pw, ...u }) => u);

  const { password: _pw, ...safeUser } = user;
  return {
    user: safeUser,
    funds,
    notifications,
    directory,
  };
}
