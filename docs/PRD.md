# Product Requirements Document (PRD)

**Product:** RWA Platform — Real World Asset Tokenization Dashboard
**Company:** Wood Land Holdings LLC
**Token:** WOD (XRPL)
**Version:** 1.0
**Date:** March 2026
**Status:** In Development

---

## 1. Executive Summary

The RWA Platform is a web application that enables Wood Land Holdings LLC to tokenize real-world land assets on the XRP Ledger (XRPL), manage investor relationships, automate yield distributions, and maintain a transparent, auditable record of ownership and financial events. The platform serves two primary user types: token holders (investors) and the token issuer (Wood Land Holdings LLC).

The core value proposition is replacing paper-based cap tables, manual distribution calculations, and fragmented investor communications with a single, blockchain-anchored dashboard — reducing administrative overhead for the issuer while giving investors real-time visibility into their holdings.

---

## 2. Problem Statement

### For the Issuer (Wood Land Holdings LLC)
- Managing investor records, distributions, and communications across spreadsheets and email is error-prone and unscalable
- There is no automated way to calculate pro-rata distributions across token holders
- Tracking NAV (Net Asset Value) changes over time requires manual updates
- There is no investor-facing portal — investors have no self-service visibility

### For Investors
- Investors have no real-time view of their token holdings or current asset valuation
- Distribution history is communicated ad hoc with no structured record
- There is no way to project future yield based on current holdings
- Token ownership lives on the blockchain with no human-readable interface

---

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Investor onboarding | Time from registration to connected wallet | < 5 minutes |
| Holdings accuracy | Sync error rate | < 1% |
| Distribution transparency | All distribution events recorded and viewable | 100% |
| Issuer efficiency | Time to calculate + record a distribution | < 2 minutes |
| NAV tracking | Valuations recorded with history | 100% of update events |
| Investor engagement | Investors viewing announcements | > 80% open rate |

---

## 4. Users & Roles

### 4.1 Investor
A person or entity that holds WOD tokens representing fractional ownership of a tokenized land asset. Investors are onboarded by Wood Land Holdings LLC and must complete KYC before participating.

**Primary needs:**
- See current token balance and portfolio value
- View distribution history and upcoming distributions
- Project future yield
- Receive announcements from the issuer
- Manage their linked XRPL wallet

### 4.2 Issuer (Wood Land Holdings LLC)
The entity that created and issued the WOD token. The issuer's wallet address matches `issuer_wallet` in the assets table. The issuer has elevated capabilities.

**Primary needs:**
- View all token holders and their percentage of supply
- Calculate and record pro-rata distributions
- Update asset NAV as valuations change
- Post announcements to all investors
- View recent payment history sent from the issuer wallet

### 4.3 Admin
A platform-level administrator (Wood Land Holdings LLC staff) with access to the admin panel. Admins can create and manage assets, view platform-wide data, and manage users.

---

## 5. Core Features

### 5.1 Authentication & Onboarding
- Email/password registration and login via Supabase Auth
- Email confirmation required before dashboard access
- First-time users prompted to link an XRPL wallet after login

### 5.2 Wallet Connection
- Connect via Crossmark browser extension (mainnet)
- Wallet address stored in Supabase; one primary wallet per user
- Disconnect clears all session state and returns user to wallet prompt
- Dev/testnet mode: manual wallet address entry for testing

### 5.3 Holdings Sync
- On dashboard load, the platform syncs the investor's token balance from XRPL
- Network auto-detected (mainnet or testnet) via `account_info`
- Trustlines matched to assets by `token_symbol` + `issuer_wallet`
- Holdings cached in Supabase `investor_holdings` table
- Manual "Refresh Holdings" button available

### 5.4 Investor Dashboard
- Portfolio summary: total holdings value, token balance, NAV per token
- Holdings table: per-asset breakdown with current valuation
- Recent distributions received
- Yield projector: adjustable yield %, appreciation rate, year-by-year table
- Announcements feed: issuer posts, pinned items first

### 5.5 Issuer Dashboard
Triggered automatically when the connected wallet matches a token's `issuer_wallet`.

- Live token stats: total supply, circulating, reserved, holder count
- Holder distribution table: address, balance, % of supply, visual bar
- Recent payments sent from issuer wallet (on-chain)
- NAV Update tool: input new valuation → auto-computes new NAV → records to history
- Distribution Calculator: input total amount → 10% reserve → 90% distributable → per-holder breakdown → one-click record
- Announcements management: post, pin, categorize

### 5.6 Distribution System
- Issuer inputs total distribution amount and currency (RLUSD / XRP / USD)
- Platform calculates 10% reserve, 90% distributable
- Pro-rata split computed from live XRPL holder data
- Event recorded to `distributions` table with full per-holder breakdown in `distribution_payments`
- Historical distribution events viewable by investors in the Distributions page

### 5.7 NAV Management
- Issuer inputs new property valuation
- Platform auto-computes NAV per token (valuation ÷ token supply)
- Previous and new values recorded to `valuations` table
- `assets` table updated with current values
- Investors see updated NAV reflected immediately on next dashboard load

### 5.8 Announcements
- Issuer can post announcements with title, body, category, and optional pin
- Categories: General, Distribution, Valuation, Legal/Compliance, Urgent
- Pinned announcements shown at top of feed
- All authenticated investors see the feed on their dashboard
- Expandable/collapsible per announcement

### 5.9 Admin Panel
- Create and manage tokenized assets (name, symbol, supply, issuer wallet, NAV, yield)
- View platform-wide user and asset data
- Accessible only to users with `role = 'admin'`

---

## 6. User Flows

### Investor: First-Time Onboarding
1. Register with email/password
2. Confirm email
3. Log in → see wallet prompt
4. Connect Crossmark wallet
5. Dashboard auto-syncs holdings from XRPL
6. Investor sees their WOD balance and portfolio value

### Investor: Checking a Distribution
1. Log in → Dashboard loads
2. Scroll to Recent Distributions
3. Or navigate to Distributions page for full history
4. See date, amount received, event type for each payment

### Issuer: Recording a Distribution
1. Log in with issuer wallet connected
2. Issuer Dashboard loads automatically
3. Open Distribution Calculator panel
4. Enter total amount (e.g. $10,000 RLUSD), select event type
5. Review per-holder breakdown table
6. Click "Record Distribution" → saved to database
7. (Off-platform) Send actual on-chain payments via Crossmark

### Issuer: Updating NAV
1. On Issuer Dashboard, open NAV Update panel
2. Enter new property valuation
3. Review computed NAV per token
4. Confirm → saved to valuations history, assets table updated

---

## 7. Out of Scope (v1.0)

- On-chain payment execution (distributions recorded in DB but signed/sent separately via Crossmark)
- KYC/AML verification integration (handled off-platform by attorney/service)
- Secondary token transfers or marketplace
- Multi-asset portfolios per investor (one primary wallet, one asset focus)
- Mobile native application
- Fiat on/off ramp
- Reg D / Reg A+ automated compliance filings

---

## 8. Dependencies & Constraints

| Item | Detail |
|------|--------|
| XRPL | Mainnet + testnet; Crossmark wallet extension required |
| Supabase | Auth, database, RLS — no self-hosted alternative planned |
| Legal compliance | PPM, subscription agreements, and KYC must be handled externally before token issuance |
| Securities law | Platform is NOT a broker-dealer; no investment advice provided; all securities compliance is the issuer's responsibility |
| Accredited investors | Current structure assumes all investors are accredited (Reg D 506(b)) |

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| XRPL network congestion affecting sync | Low | Medium | Retry logic + manual refresh |
| Investor loses wallet access | Medium | High | Off-platform recovery process; document in operating agreement |
| Regulatory change affecting token classification | Medium | High | Securities attorney on retainer; platform technology-only disclaimer |
| Sync showing stale holdings | Medium | Medium | Timestamp displayed; auto-sync on load |
| Issuer wallet compromise | Low | Critical | Hardware wallet recommended; platform cannot prevent |

---

## 10. Future Roadmap (Post v1.0)

- KYC/AML integration (Persona, Parallel Markets)
- Automated on-chain distribution execution
- Multi-asset support (multiple tokenized properties)
- Investor transfer request workflow (with right-of-first-refusal enforcement)
- K-1 / tax document delivery via dashboard
- Mobile-responsive redesign
- White-label offering for other asset issuers

---

*Document Version 1.0 — Wood Land Holdings LLC — RWA Platform*
