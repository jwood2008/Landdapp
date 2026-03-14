# Technical Requirements Document (TRD)

**Product:** RWA Platform — Real World Asset Tokenization Dashboard
**Company:** Wood Land Holdings LLC
**Version:** 1.0
**Date:** March 2026

---

## 1. Purpose

This document defines the technical architecture, stack, infrastructure, data models, API contracts, and non-functional requirements for the RWA Platform. It is the authoritative reference for engineering decisions.

---

## 2. Technology Stack

### 2.1 Frontend
| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 14 (App Router) | Server components default; `'use client'` only when required |
| Language | TypeScript | 5.x | Strict mode enabled |
| Styling | Tailwind CSS | 3.x | CSS variables for theming |
| Component Library | shadcn/ui | v4 | Uses `@base-ui/react`, NOT Radix UI — no `asChild` prop |
| Icons | lucide-react | Latest | |
| State Management | Zustand | 4.x | `persist` middleware for wallet state |
| Routing | Next.js App Router | — | Route groups: `(auth)`, `(dashboard)` |

### 2.2 Backend
| Layer | Technology | Notes |
|-------|-----------|-------|
| API Routes | Next.js API routes (`/app/api/`) | Server-side only |
| Database | Supabase (PostgreSQL) | Hosted, managed |
| Auth | Supabase Auth | Email/password; SSR session via cookies |
| Supabase Client | `@supabase/ssr` | `createServerClient` for server; `createBrowserClient` for client |
| Blockchain | XRPL (XRP Ledger) | JSON-RPC via public nodes |

### 2.3 Infrastructure
| Service | Provider | Notes |
|---------|----------|-------|
| Hosting | Vercel (assumed) | Next.js native deployment |
| Database | Supabase Cloud | Postgres + Auth + Storage |
| XRPL Mainnet | `xrplcluster.com` | Public cluster |
| XRPL Testnet | `s.altnet.rippletest.net:51234` | Ripple testnet |
| Wallet Extension | Crossmark | Browser extension; mainnet only |

---

## 3. Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + auth guard
│   │   └── dashboard/
│   │       ├── page.tsx            # Main dashboard (investor or issuer)
│   │       ├── assets/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── distributions/page.tsx
│   │       └── settings/page.tsx
│   ├── admin/
│   │   ├── layout.tsx              # Admin auth guard
│   │   ├── page.tsx
│   │   └── assets/new/page.tsx
│   ├── agency/page.tsx             # Dev-only; not in sidebar
│   ├── api/
│   │   ├── sync-holdings/route.ts
│   │   └── issuer-stats/route.ts
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Landing / redirect
├── components/
│   ├── dashboard/
│   │   ├── portfolio-summary.tsx
│   │   ├── holdings-table.tsx
│   │   ├── recent-distributions.tsx
│   │   ├── wallet-prompt.tsx
│   │   ├── sync-holdings.tsx
│   │   ├── issuer-dashboard.tsx
│   │   ├── distribution-calculator.tsx
│   │   ├── nav-update-form.tsx
│   │   ├── yield-calculator.tsx
│   │   └── announcements-feed.tsx
│   ├── layout/
│   │   └── sidebar.tsx
│   ├── ui/                         # shadcn/ui base components
│   └── wallet/
│       └── connect-button.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts               # createClient() for server components
│   │   ├── client.ts               # createClient() for browser components
│   │   └── middleware.ts           # Session refresh
│   └── utils.ts                    # cn() and shared utilities
├── store/
│   └── wallet.ts                   # Zustand wallet store
└── types/
    └── database.ts                 # Supabase-generated types + custom types
```

---

## 4. Database Schema

### 4.1 Core Tables

```sql
-- Managed by Supabase Auth; extended with custom fields
CREATE TABLE public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id),
  email       text,
  role        text DEFAULT 'investor',   -- 'investor' | 'admin'
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id) ON DELETE CASCADE,
  address     text NOT NULL,
  is_primary  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.assets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name          text NOT NULL,
  token_symbol        text NOT NULL,
  issuer_wallet       text NOT NULL,
  token_supply        numeric NOT NULL,
  current_valuation   numeric NOT NULL,
  nav_per_token       numeric NOT NULL,        -- current_valuation / token_supply
  annual_yield        numeric DEFAULT 8,        -- percentage
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE public.investor_holdings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  text NOT NULL,
  asset_id        uuid REFERENCES public.assets(id),
  token_balance   numeric NOT NULL DEFAULT 0,
  last_synced_at  timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(wallet_address, asset_id)
);

CREATE TABLE public.distributions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id              uuid REFERENCES public.assets(id),
  event_type            text NOT NULL,
  total_amount          numeric NOT NULL,
  currency              text NOT NULL DEFAULT 'RLUSD',
  reserve_amount        numeric NOT NULL,        -- 10%
  distributable_amount  numeric NOT NULL,        -- 90%
  notes                 text,
  created_by            uuid REFERENCES public.users(id),
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE public.distribution_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id  uuid REFERENCES public.distributions(id) ON DELETE CASCADE,
  wallet_address   text NOT NULL,
  amount           numeric NOT NULL,
  percent_share    numeric NOT NULL,
  tx_hash          text,                         -- populated after on-chain payment
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE public.valuations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id             uuid REFERENCES public.assets(id),
  previous_valuation   numeric NOT NULL,
  new_valuation        numeric NOT NULL,
  previous_nav         numeric NOT NULL,
  new_nav              numeric NOT NULL,
  event_type           text NOT NULL,
  notes                text,
  created_by           uuid REFERENCES public.users(id),
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE public.announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  category    text NOT NULL DEFAULT 'general',  -- general|distribution|valuation|legal|urgent
  pinned      boolean DEFAULT false,
  asset_id    uuid REFERENCES public.assets(id),
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamptz DEFAULT now()
);
```

### 4.2 Dev-Only Tables (not exposed in app UI)

```sql
CREATE TABLE public.agency_divisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  tagline     text,
  emoji       text,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.agency_agents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id  uuid REFERENCES public.agency_divisions(id),
  name         text NOT NULL,
  specialty    text,
  when_to_use  text,
  sort_order   integer DEFAULT 0,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
```

---

## 5. Row-Level Security (RLS)

All tables have RLS enabled. The following policies are in effect:

### 5.1 Admin Helper Function

```sql
-- CRITICAL: Prevents infinite recursion in RLS policies
-- Never query public.users directly in policies — use this function instead
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') $$;
```

### 5.2 Policy Patterns

```sql
-- wallets: users see only their own; admins see all
CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wallets_admin_all" ON public.wallets
  FOR ALL USING (public.is_admin());

-- investor_holdings: users see holdings for their wallets
CREATE POLICY "holdings_select_own" ON public.investor_holdings
  FOR SELECT USING (
    wallet_address IN (SELECT address FROM public.wallets WHERE user_id = auth.uid())
  );
CREATE POLICY "holdings_insert_own" ON public.investor_holdings
  FOR INSERT WITH CHECK (
    wallet_address IN (SELECT address FROM public.wallets WHERE user_id = auth.uid())
  );
CREATE POLICY "holdings_update_own" ON public.investor_holdings
  FOR UPDATE USING (
    wallet_address IN (SELECT address FROM public.wallets WHERE user_id = auth.uid())
  );

-- assets: all authenticated users can read active assets
CREATE POLICY "assets_select_authenticated" ON public.assets
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "assets_admin_all" ON public.assets
  FOR ALL USING (public.is_admin());

-- announcements: all authenticated users can read
CREATE POLICY "announcements_select_authenticated" ON public.announcements
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- Insert controlled by RLS + application logic (isIssuer check in UI)
```

---

## 6. API Routes

### 6.1 POST `/api/sync-holdings`

**Purpose:** Sync investor's XRPL token holdings to the database.

**Authentication:** Session-based (reads user cookies via `createServerClient`)

**Request body:**
```json
{ "walletAddress": "rXXXXXX..." }
```

**Logic:**
1. Validate user session; confirm wallet belongs to authenticated user
2. Call `detectNetwork(walletAddress)` → `account_info` on mainnet; if error, returns `testnet`
3. Call `account_lines` on the detected network
4. Match each line to `assets` table by `currency = token_symbol` AND `account = issuer_wallet`
5. Upsert matched holdings into `investor_holdings`
6. Return `{ synced: number, network: string }`

**Error responses:**
- `401` — Not authenticated
- `400` — Invalid wallet address
- `500` — XRPL unreachable or DB error

### 6.2 POST `/api/issuer-stats`

**Purpose:** Fetch live token distribution stats from XRPL for the issuer dashboard.

**Authentication:** Session-based

**Request body:**
```json
{
  "issuerAddress": "rXXXXXX...",
  "tokenSymbol": "WOD",
  "tokenSupply": 1000000
}
```

**Logic:**
1. Call `detectNetwork(issuerAddress)` → `account_info`
2. Call `account_lines` on issuer address for detected network
3. Filter lines where `currency = tokenSymbol` AND `balance < 0` (negative = external holder owes issuer)
4. Compute each holder's balance as `Math.abs(balance)`, percent as `balance / totalCirculating * 100`
5. Compute `circulating = sum of holder balances`, `reservedByIssuer = tokenSupply - circulating`
6. Call `account_tx` on issuer for recent payment transactions
7. Return full stats object

**Response:**
```json
{
  "network": "mainnet",
  "tokenSymbol": "WOD",
  "totalSupply": 1000000,
  "circulating": 850000,
  "reservedByIssuer": 150000,
  "holderCount": 12,
  "holders": [
    { "address": "rXXX...", "balance": 100000, "percent": 11.76, "limit": 200000 }
  ],
  "recentPayments": [
    { "hash": "ABCD...", "destination": "rXXX...", "amount": "1000 RLUSD", "date": "2026-03-01" }
  ]
}
```

---

## 7. XRPL Integration

### 7.1 Network Detection

```typescript
async function detectNetwork(address: string): Promise<'mainnet' | 'testnet'> {
  const mainnetRes = await fetch('https://xrplcluster.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'account_info',
      params: [{ account: address, ledger_index: 'current' }]
    })
  })
  const data = await mainnetRes.json()
  if (!data.result?.error) return 'mainnet'
  return 'testnet'
}
```

### 7.2 RPC Node URLs

| Network | URL |
|---------|-----|
| Mainnet | `https://xrplcluster.com` |
| Testnet | `https://s.altnet.rippletest.net:51234` |

### 7.3 Key RPC Methods Used

| Method | Purpose |
|--------|---------|
| `account_info` | Detect which network a wallet exists on |
| `account_lines` | Get trustlines (holdings for investors; holder distribution for issuer) |
| `account_tx` | Get recent payment transactions sent by the issuer |

### 7.4 Holder Balance Logic

On the XRPL, when an account issues a token, trustlines held by other accounts appear as **negative balances** from the issuer's perspective. The platform takes `Math.abs()` of these values:

```typescript
const holders = lines
  .filter(l => l.currency === tokenSymbol && parseFloat(l.balance) < 0)
  .map(l => ({
    address: l.account,
    balance: Math.abs(parseFloat(l.balance)),
    limit: parseFloat(l.limit_peer),
  }))
```

---

## 8. Supabase Client Usage

### 8.1 Server Components
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
// Reads cookies from the incoming request; returns user-scoped client
```

### 8.2 API Routes
```typescript
import { createServerClient } from '@supabase/ssr'
// Must pass request cookies explicitly
// DO NOT use service role key — sb_secret_ prefix is NOT a JWT
```

### 8.3 Client Components
```typescript
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
// Browser-side client; inherits session from cookie
```

### 8.4 Middleware
- `src/middleware.ts` runs on every request
- Refreshes the Supabase session token
- Redirects unauthenticated users from `/dashboard` → `/login`
- Redirects non-admin users from `/admin` → `/dashboard`

---

## 9. State Management

### 9.1 Zustand Wallet Store

```typescript
interface WalletState {
  address: string | null
  isConnected: boolean
  setWallet: (address: string) => void
  clearWallet: () => void
}
```

- Persisted to `localStorage` via Zustand `persist` middleware
- Key: `wallet-store`
- Cleared on disconnect via `clearWallet()`

### 9.2 Server State
All database-derived state is fetched server-side in Server Components and passed as props. No client-side data fetching library (SWR, React Query) is used at v1.0.

Exception: `IssuerDashboard` fetches live XRPL data client-side on mount via `/api/issuer-stats`.

---

## 10. Non-Functional Requirements

### 10.1 Performance
| Metric | Target |
|--------|--------|
| Dashboard initial load (TTFB) | < 1.5s |
| Holdings sync API response | < 3s |
| Issuer stats API response | < 5s (XRPL latency dependent) |
| Client-side JS bundle (gzipped) | < 150kB |

### 10.2 Security
- All API routes validate user session before processing
- No secret keys exposed to the client
- Service role key (`sb_secret_`) never used in client-accessible code
- RLS enforced on all database tables
- All user-supplied inputs validated before database writes
- XRPL explorer links use `rel="noopener noreferrer"` on all `target="_blank"` anchors
- No SQL built from string concatenation — all queries use Supabase parameterized client

### 10.3 Reliability
- XRPL queries have a 10-second timeout
- If mainnet is unreachable, testnet fallback is attempted
- Holdings sync failure does not crash the dashboard; cached data is shown
- Issuer stats failure shows an inline error message, not a crash

### 10.4 Accessibility
- All interactive elements are keyboard navigable
- Color is not the sole indicator of state (badges include text labels)
- Focus visible on all interactive elements
- ARIA labels on icon-only buttons

### 10.5 Browser Support
- Chrome (latest 2 versions) — primary (required for Crossmark)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile browsers: not supported at v1.0

---

## 11. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Never expose to client
SUPABASE_SERVICE_ROLE_KEY=     # Only used in trusted server contexts if needed
```

---

## 12. Deployment

### 12.1 Build
```bash
npm run build    # Next.js production build
```

### 12.2 Environment
- Node.js 18+
- All environment variables must be set before build
- `NEXT_PUBLIC_*` variables are inlined at build time

### 12.3 Database Migrations
- Supabase migrations managed via SQL scripts in `/supabase/migrations/` (if initialized)
- All schema changes must be tested against a staging Supabase project before applying to production
- RLS policies must be applied in the same migration as the table they protect

---

## 13. Known Technical Constraints

| Constraint | Detail |
|-----------|--------|
| Crossmark mainnet only | Testnet wallets require manual address entry |
| No on-chain execution | Distribution payments are recorded in DB only; on-chain execution is manual via Crossmark |
| Single asset per issuer wallet | Platform assumes one asset per issuer address at v1.0 |
| No real-time updates | Dashboard requires a page reload or manual sync for fresh data; no WebSocket/subscription |
| XRPL pagination | `account_lines` returns up to 400 lines; pagination not implemented at v1.0 (sufficient for current scale) |
| Supabase free tier limits | 500MB storage, 2GB bandwidth/month — sufficient for v1.0; upgrade before production scale |

---

*Document Version 1.0 — Wood Land Holdings LLC — RWA Platform*
