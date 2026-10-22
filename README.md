# VietBank Fund-Verifier

**Remote Multi-Owner Joint Bank Account & Real-Time Face-ID Head-Movement Liveness Verification Platform**

Built with **Next.js**, **TypeScript**, **Node.js**, **Supabase**, **Vercel**, **Kilo Gateway 5-API-Key JWT Rotator ($0 Free AI Models)**, and **MCP Servers** (**Yunleng**, **Tide Raziel**, **Everything Claude Code**, and **Microsoft Playwright MCP**).

---

## Key Features

1. **Supabase Authentication & User Directory (`users` table)**:
   - Sign in (register) with **Email** (all email providers accepted), **Username**, and **Password** saved directly into the Supabase directory.
   - If a user attempts to log in with an email address that is not registered in the Supabase database, the system prompts and requires the user to Sign In (register) first.
2. **Top-Right Corner Notification Box (`notifications` table)**:
   - Real-time notification center on the top-right corner of the main banking interface:
     - **Co-Ownership Invitations**: Shows **`Decline`** and **`Accept`** buttons when invited to co-own a fund.
     - **Co-Owner Deduction Verification Requests**: Shows **`Decline`** and **`Verify`** buttons when another co-owner requests to deduct funds.
3. **Yunleng MCP Real-Time Face Recognition & Anti-AI Spoofing Head Movement Verification**:
   - Clicking **`Verify`** opens the live camera verification modal (`navigator.mediaDevices.getUserMedia`), powered by **Yunleng MCP** (`https://github.com/ChenLaoshiYF/yunleng`) and **Kilo Gateway Free Vision Models**.
   - Requires the co-owner to enable camera permission and swipe/move their head in all 4 directions in real time (**Left**, **Right**, **Up**, **Down**) to prevent AI-spoofed faces.
4. **Co-Owned Funds in VND (`funds` & `fund_members` tables)**:
   - Create a fund with an initial balance in **VND** and invite co-owners by username or email (verified against the Supabase `users` directory).
   - **Add Fund**: Input any amount in VND (`> 0`) and click **Submit** to add money immediately.
   - **Deduct Fund**: Input any amount in VND (`> 0` and `< current fund balance`) and click **Submit** to send verification requests to all remaining co-owners.
   - **3 Co-Owner Approval Status Labels**: Track every co-owner's verification decision via **`Approved`**, **`Waiting for approval`**, or **`Rejected`** with strict server-side multi-approval enforcement and expiration rules.
5. **Kilo Gateway 5-API-Key JWT Rotator & 1-Minute Free Model Catalog Sync (`src/lib/kilo-gateway.ts`)**:
   - Rotates automatically across `KILO_GATEWAY_API_1`, `KILO_GATEWAY_API_2`, `KILO_GATEWAY_API_3`, `KILO_GATEWAY_API_4`, and `KILO_GATEWAY_API_5` on rate-limit, invalid key, or failure, and restores keys when their rate-limit resets.
   - Defaults to `openrouter/free` (`openrouter-free`) and `kilo-auto/free` (`auto/free`), enforces `$0 / Mtok` input and output pricing, switches immediately if a model is rate-limited, and syncs the free model list every **1 minute**.
6. **CI/CD & Code Security Workflows**:
   - `nextjs.yaml` (`.github/workflows/nextjs.yaml`)
   - `nodejs.yaml` (`.github/workflows/nodejs.yaml`)
   - `codeql.yaml` (`.github/workflows/codeql.yaml`)
   - `vercel.json` for Vercel deployment.
