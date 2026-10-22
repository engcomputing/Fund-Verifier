-- ============================================================================
-- Fund-Verifier Supabase PostgreSQL Schema
-- ============================================================================

-- 1. Notes table (from Issue #1 Comment 1 & 2)
create table if not exists notes (
  id bigint primary key generated always as identity,
  title text not null
);

insert into notes (title)
values
  ('Today I created a Supabase project.'),
  ('I added some data and queried it from Next.js.'),
  ('It was awesome!');

alter table notes enable row level security;

create policy "Allow public read access to notes"
  on notes for select
  using (true);

-- 2. Users Directory Table (email, username, password stored in Supabase)
create table if not exists users (
  id text primary key,
  email text unique not null,
  username text unique not null,
  password text not null,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

alter table users enable row level security;

-- 3. Funds Table (VND currency co-owned accounts)
create table if not exists funds (
  id text primary key,
  name text not null,
  description text not null default '',
  balance_vnd bigint not null default 0 check (balance_vnd >= 0),
  creator_id text not null references users(id) on delete cascade,
  creator_username text not null,
  creator_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table funds enable row level security;

-- 4. Fund Co-Owners / Members Table
create table if not exists fund_members (
  id text primary key,
  fund_id text not null references funds(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  username text not null,
  email text not null,
  role text not null default 'co-owner', -- 'creator' | 'co-owner'
  status text not null default 'invited', -- 'active' | 'invited' | 'declined'
  invited_by_id text not null,
  invited_by_username text not null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique(fund_id, user_id)
);

alter table fund_members enable row level security;

-- 5. Fund Transactions Table (Add Fund / Deduct Fund history)
create table if not exists fund_transactions (
  id text primary key,
  fund_id text not null references funds(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  username text not null,
  email text not null,
  type text not null, -- 'initial' | 'add' | 'deduct'
  amount_vnd bigint not null check (amount_vnd >= 0),
  balance_after_vnd bigint not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table fund_transactions enable row level security;

-- 6. Withdrawal / Deduction Requests Table (with expiration & multi-approval enforcement)
create table if not exists withdrawal_requests (
  id text primary key,
  fund_id text not null references funds(id) on delete cascade,
  fund_name text not null,
  requester_id text not null references users(id) on delete cascade,
  requester_username text not null,
  requester_email text not null,
  amount_vnd bigint not null check (amount_vnd > 0),
  reason text not null default 'Co-owner fund deduction request',
  status text not null default 'Waiting for approval', -- 'Waiting for approval' | 'Approved' | 'Rejected' | 'Completed' | 'Expired'
  deducted boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table withdrawal_requests enable row level security;

-- 7. Withdrawal Co-Owner Approvals Table
-- Status values strictly match issue specification:
-- 'Approved' | 'Waiting for approval' | 'Rejected'
create table if not exists withdrawal_approvals (
  id text primary key,
  request_id text not null references withdrawal_requests(id) on delete cascade,
  fund_id text not null references funds(id) on delete cascade,
  co_owner_id text not null references users(id) on delete cascade,
  co_owner_username text not null,
  co_owner_email text not null,
  status text not null default 'Waiting for approval', -- 'Approved' | 'Waiting for approval' | 'Rejected'
  face_verified boolean not null default false,
  head_movements jsonb not null default '[]'::jsonb,
  mcp_server text not null default 'yunleng',
  ai_model text not null default 'openrouter/free',
  updated_at timestamptz not null default now(),
  unique(request_id, co_owner_id)
);

alter table withdrawal_approvals enable row level security;

-- 8. Notifications Table (Top-right Notification Box)
create table if not exists notifications (
  id text primary key,
  recipient_id text not null references users(id) on delete cascade,
  recipient_email text not null,
  recipient_username text not null,
  sender_id text not null,
  sender_username text not null,
  sender_email text not null,
  type text not null, -- 'fund_invitation' | 'withdrawal_verification' | 'withdrawal_update'
  title text not null,
  message text not null,
  fund_id text not null,
  fund_name text not null,
  amount_vnd bigint,
  member_record_id text,
  withdrawal_request_id text,
  action_status text not null default 'pending', -- 'pending' | 'accepted' | 'declined' | 'verified'
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;
