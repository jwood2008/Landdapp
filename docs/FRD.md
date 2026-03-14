# Functional Requirements Document (FRD)

**Product:** RWA Platform — Real World Asset Tokenization Dashboard
**Company:** Wood Land Holdings LLC
**Version:** 1.0
**Date:** March 2026

---

## 1. Purpose

This document defines the functional behavior of the RWA Platform — what the system must do from the user's perspective. It is the authoritative reference for feature behavior, business rules, and UI requirements.

---

## 2. Authentication & Access

### FR-AUTH-01: Registration
- The system shall allow users to register with an email address and password
- Password minimum: 8 characters
- The system shall send an email confirmation link upon registration
- Users shall not access the dashboard until email is confirmed

### FR-AUTH-02: Login
- The system shall authenticate users via email/password
- Failed login attempts shall display a generic error (do not reveal whether email exists)
- Successful login redirects to `/dashboard`

### FR-AUTH-03: Session Management
- Sessions shall persist using secure HTTP-only cookies managed by Supabase Auth
- Session shall expire per Supabase default (1 week)
- Expired sessions shall redirect to `/login`

### FR-AUTH-04: Logout
- Logout button shall invalidate the server-side session
- After logout, user is redirected to `/login`
- Attempting to access dashboard after logout shall redirect to `/login`

### FR-AUTH-05: Role-Based Access
- Users have a `role` field: `investor` (default) or `admin`
- Admin users see an additional "Admin Panel" link in the sidebar
- Admin panel at `/admin` is inaccessible to non-admin users (middleware redirect)

---

## 3. Wallet Management

### FR-WALLET-01: Connect Wallet
- Authenticated users without a linked wallet shall see a wallet connection prompt on the dashboard
- Crossmark browser extension shall be the primary connection method (mainnet)
- The system shall store the connected wallet address in the `wallets` table with `is_primary = true`
- A user may only have one primary wallet at a time

### FR-WALLET-02: Dev/Testnet Mode
- An alternative input shall allow manual entry of an XRPL address (for testnet wallets not supported by Crossmark)
- Manually entered addresses shall be validated as valid XRPL addresses before saving

### FR-WALLET-03: Disconnect Wallet
- Disconnect action shall set `is_primary = false` for all of the user's wallets in Supabase
- Zustand wallet state shall be cleared
- The page shall refresh, returning the user to the wallet connection prompt
- The investor's holdings shall not be displayed after disconnect

### FR-WALLET-04: Wallet Display
- Connected wallet address shall be displayed in truncated form: first 8 + last 6 characters
- Full address shall not be displayed in the UI by default

---

## 4. Holdings Sync

### FR-SYNC-01: Automatic Sync on Load
- On dashboard load, the system shall automatically sync the investor's XRPL token holdings
- Sync shall execute silently in the background; the user shall not be blocked

### FR-SYNC-02: Network Detection
- Before querying holdings, the system shall detect which network the wallet is on (mainnet or testnet) using the XRPL `account_info` method
- If `account_info` succeeds on mainnet, use mainnet. If not, fall back to testnet.
- The detected network shall be logged for debugging purposes

### FR-SYNC-03: Trustline Matching
- The system shall query `account_lines` on the investor's wallet for the detected network
- Each trustline shall be matched to an asset in the `assets` table by `token_symbol` AND `issuer_wallet`
- Matched trustlines shall be upserted into `investor_holdings` with the current balance

### FR-SYNC-04: Sync Result Display
- After sync, the UI shall display:
  - Number of holdings synced (e.g. "Synced 1 holding")
  - A warning if no trustlines were found
  - An error message if the sync API call fails
- A "Refresh Holdings" button shall allow manual re-sync at any time

### FR-SYNC-05: Stale Data Handling
- The `last_synced_at` timestamp shall be stored with each holding
- If the sync fails, the system shall display the last cached data with the timestamp

---

## 5. Investor Dashboard

### FR-INV-01: Portfolio Summary
- The dashboard shall display:
  - Total portfolio value (sum of token_balance × nav_per_token across all holdings)
  - Total tokens held
  - Number of distinct assets held
- Values shall update after each sync

### FR-INV-02: Holdings Table
- A table shall display each asset holding with:
  - Asset name
  - Token symbol
  - Token balance (formatted with commas)
  - Current NAV per token
  - Total holding value (balance × NAV)
- If no holdings, display a message directing the user to sync

### FR-INV-03: Recent Distributions
- Display the 5 most recent distribution payments received by the investor's wallet
- Each row shall show: date, event type, amount, currency, asset name
- Link to full distributions page

### FR-INV-04: Yield Projector
- Shown only if the investor has at least one holding
- Inputs:
  - Annual yield percentage (default: asset's `annual_yield`, adjustable by user)
  - Annual appreciation rate (default: 0%, adjustable)
  - Projection years (1–20)
- Output: year-by-year table with NAV/token, portfolio value, annual distribution, cumulative distributions, total return %
- Calculations update in real-time as inputs change

### FR-INV-05: Announcements Feed
- Display all announcements from the `announcements` table
- Sort: pinned first, then by date descending
- Each announcement shows: category badge, date, title (expandable), body
- Investors can expand/collapse individual announcements
- Feed is read-only for investors

---

## 6. Issuer Dashboard

The issuer dashboard is displayed automatically when the connected wallet address matches `issuer_wallet` in the `assets` table.

### FR-ISS-01: Issuer Detection
- On dashboard load, the server shall query `assets` where `issuer_wallet = primaryWallet.address`
- If a match is found, render `IssuerDashboard` instead of the investor view
- The issuer dashboard is accessible only to the wallet holding the issuer role on-chain

### FR-ISS-02: Network Badge
- Display a colored badge indicating which XRPL network the issuer wallet is on (mainnet: green, testnet: amber)

### FR-ISS-03: Token Stats
Display four stat cards:
- **Total Supply**: configured total token supply from `assets` table
- **Circulating**: sum of all external holder balances (live from XRPL)
- **Reserved by Issuer**: tokens still held by the issuer (not yet distributed)
- **Token Holders**: count of unique external holder addresses

### FR-ISS-04: Holder Distribution Table
- Display all external token holders (non-issuer addresses) with trustlines
- Columns: rank, address (truncated, links to XRPL explorer), visual distribution bar, balance, % of supply
- Addresses shall link to the appropriate XRPL explorer (mainnet or testnet)
- If no holders, display "No external holders found"

### FR-ISS-05: Recent Payments
- Display the 10 most recent outgoing payments from the issuer wallet (live from XRPL)
- Columns: transaction hash (links to explorer), recipient address, amount, date
- If no payments, display "No outgoing payments found"

### FR-ISS-06: Refresh
- A "Refresh" button shall re-fetch live data from XRPL
- While loading, the button shall display a spinning icon and be disabled
- Stats shall show loading skeleton cards during initial load

---

## 7. Distribution Calculator

### FR-DIST-01: Input
The issuer shall input:
- Total distribution amount (numeric)
- Currency: RLUSD, XRP, or USD (noted, not executed on-chain)
- Event type: Lease Income, Q1/Q2/Q3/Q4 Distribution, Special Distribution, Return of Capital, Other
- Optional notes

### FR-DIST-02: Calculation
- System shall automatically compute:
  - 10% reserve = total × 0.10
  - 90% distributable = total × 0.90
  - Per-holder amount = distributable × (holder.balance / circulating_supply)
- Computed values shall update as the issuer types

### FR-DIST-03: Preview Table
- Display a table showing each holder's address, their % share, and their computed distribution amount
- Table shall be visible before confirming

### FR-DIST-04: Record Distribution
- On confirm, the system shall:
  1. Insert a record into `distributions` (event_type, total_amount, currency, reserve_amount, distributable_amount, notes, asset_id)
  2. Insert one record per holder into `distribution_payments` (distribution_id, wallet_address, amount, percent_share)
- Display success confirmation after save
- Note: Actual on-chain payments are performed separately by the issuer via Crossmark

### FR-DIST-05: Access Control
- Only the issuer can see or use the Distribution Calculator
- Investors do not see this component

---

## 8. NAV Update

### FR-NAV-01: Input
The issuer shall input:
- New total property valuation (USD)
- Event type: Annual Appraisal, Market Update, Sale/Refinance, Internal Estimate
- Optional notes

### FR-NAV-02: Auto-Computation
- System shall compute: `new_nav = new_valuation / token_supply`
- Display both the new valuation and new NAV per token before confirming
- Display the previous values for comparison

### FR-NAV-03: Record Update
On confirm:
1. Insert record into `valuations` (previous_valuation, new_valuation, previous_nav, new_nav, event_type, notes, asset_id)
2. Update `assets` table: `current_valuation = new_valuation`, `nav_per_token = new_nav`

### FR-NAV-04: Investor Impact
- Updated NAV shall be reflected in investor dashboard on next load/sync
- Investors see no "NAV updated" event directly — it is surfaced via announcements if the issuer posts one

---

## 9. Distributions History (Investor)

### FR-DISTPAGE-01: Full History
- A dedicated `/dashboard/distributions` page shall display all distribution payments for the investor's wallet
- Sorted by date descending
- Columns: date, asset name, event type, amount, currency

### FR-DISTPAGE-02: Empty State
- If no distributions found, display "No distribution payments recorded yet"

---

## 10. Assets Page (Investor)

### FR-ASSETS-01: Assets List
- `/dashboard/assets` shall display all active assets the investor has a holding in
- Each asset card shows: asset name, token symbol, NAV per token, annual yield %, current valuation

### FR-ASSETS-02: Asset Detail
- Clicking an asset navigates to `/dashboard/assets/[id]`
- Detail page shows: full asset description, issuer address, token supply, NAV history chart (future), investor's specific holding in this asset

---

## 11. Settings (Investor)

### FR-SETTINGS-01: Wallet Management
- `/dashboard/settings` shall display the user's linked wallet address
- Allow the user to disconnect their wallet
- Future: allow linking additional wallets

### FR-SETTINGS-02: Account Info
- Display the user's email address
- Future: allow email/password update

---

## 12. Announcements (Issuer Post)

### FR-ANN-01: Post Form
- Shown only when `isIssuer = true`
- Fields: title (required), body (required), category (select), pinned (checkbox)
- Submit inserts into `announcements` table with `asset_id` of the issuer's asset
- Success confirmation displayed for 3 seconds

### FR-ANN-02: Validation
- Title and body are required; submit button disabled until both are filled
- No character limit enforced at v1.0 (future: 500 char body limit)

---

## 13. Admin Panel

### FR-ADMIN-01: Asset Management
- Admins can create a new tokenized asset with: name, symbol, issuer wallet, total supply, current valuation, NAV per token, annual yield
- Admins can view all assets

### FR-ADMIN-02: Access
- Admin panel is accessible only at `/admin`
- Middleware redirects non-admin users away from `/admin`

---

## 14. Business Rules

| Rule | Description |
|------|-------------|
| BR-01 | Distribution reserve is always 10% of the gross distribution amount |
| BR-02 | Distributable amount is always 90% of the gross distribution amount |
| BR-03 | Pro-rata share is computed against circulating supply (not total supply) |
| BR-04 | Issuer's own holdings are excluded from the holder distribution table |
| BR-05 | NAV per token = current_valuation ÷ token_supply |
| BR-06 | Only one wallet per user may be `is_primary = true` at a time |
| BR-07 | The platform records distributions but does not execute on-chain payments |
| BR-08 | All monetary values displayed in USD unless explicitly labeled otherwise |
| BR-09 | XRPL holder balances always sourced live at time of issuer dashboard load |
| BR-10 | The platform does not provide investment advice; all financial data is informational only |

---

*Document Version 1.0 — Wood Land Holdings LLC — RWA Platform*
