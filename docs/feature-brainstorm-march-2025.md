# TierraDex — Feature Brainstorm & Analysis

**Date:** March 21, 2026
**Source:** Feedback from real estate / ag-land industry contact
**Purpose:** Structured analysis of each suggested feature — feasibility, approach, open questions, and how it fits into what TierraDex already has.

---

## 1. Private Permission Domains (Issuer Invites N Investors)

### The Idea
An issuer tokenizes a parcel and creates a "private domain" — only their hand-picked investors (e.g., 10 people) can hold that token. Think of it like a private placement rather than a public offering.

### What We Already Have
TierraDex already uses **XRPL Authorized Trust Lines** (RequireAuth flag). This means an investor can't hold a token unless the issuer explicitly approves their trust line. So the on-chain mechanism is already there.

### What's Missing
The current flow is reactive — investors request trust lines and the issuer approves/rejects. A true "private domain" flips this: the issuer proactively **invites** specific people, and only those people can even see or interact with the asset.

### Approach

**Tier 1 — Invite-Only Visibility (UI layer)**
- Issuer creates an asset and marks it as "Private" (vs. "Open" or "Public").
- Issuer enters wallet addresses or email addresses of invited investors.
- The asset only appears in the dashboard/marketplace for those invited investors.
- Everyone else simply never sees it.
- Database: add an `access_type` field to `assets` ('public' | 'private') and an `asset_invitations` table mapping asset_id → investor wallet/email.

**Tier 2 — Invite Codes / Links**
- Issuer generates a unique invite link per asset (or per investor).
- Investor clicks link → lands on the asset page → can request trust line.
- Useful for issuers who want to share via email/text without needing to know wallet addresses upfront.

**Tier 3 — Issuer-Managed Investor Groups**
- Issuer creates named groups (e.g., "Family Trust," "Ranch Partners").
- Assigns investors to groups, assigns assets to groups.
- Reusable across multiple assets — if the same 10 people invest in multiple parcels, the issuer doesn't re-invite every time.

### Open Questions
- Do private assets appear in the marketplace at all? Probably not — secondary trading would be restricted to within the invited group.
- Regulatory angle: private placements (Reg D, Reg S) have specific rules about solicitation. The invite-only model aligns well with this — worth noting in any compliance docs.
- Cap on investors? SEC Reg D 506(b) limits to 35 non-accredited investors (unlimited accredited). The platform could enforce this.

### Complexity: Medium
Most of this is UI + RLS policy work. The XRPL layer already supports it.

---

## 2. Farmer / Renter Relationship (Issuer ↔ Farmer/Tenant)

### The Idea
In ag land, the issuer (landowner) often leases to a farmer/operator who pays rent. TierraDex should model this relationship explicitly so rent payments flow through the app and investors can see them.

### What We Already Have
- **Oracle system** already monitors XRPL for incoming payments from "operator wallets" and auto-distributes to token holders.
- **Asset contracts** store lease terms (tenant name, annual amount, frequency, escalation).
- But the farmer/tenant is just a name in a text field — they're not a first-class user in the system.

### What's Missing
The farmer has no presence in the app. They can't log in, can't see their lease, can't make payments through the platform. The issuer has to manually configure operator wallets and hope the farmer sends payments to the right address.

### Approach

**New Role: `tenant` (or `farmer` / `operator`)**

The system currently has three roles: `investor`, `issuer`, `admin`. Add a fourth: `tenant`.

**Tenant capabilities:**
- View their active leases (which parcels, what terms, payment schedule)
- See payment history (what they've paid, what's upcoming)
- Make rent payments directly through the app (XRP or fiat via on-ramp)
- Upload proof of insurance, crop reports, or other lease-required docs
- Receive notifications for upcoming payment due dates

**Issuer capabilities (new):**
- Invite a tenant to a specific asset
- Set lease terms within the app (not just a contract PDF)
- View tenant payment status (on-time, late, missed)
- Send payment reminders
- Rate/review tenant history (useful if the issuer has multiple parcels)

**Investor visibility (new):**
- See tenant info (name, lease term, payment track record) — builds confidence
- See occupancy status: leased vs. vacant
- Payment health indicator: "Tenant has made 12/12 payments on time"

### Data Model Additions
```
tenants
  - id, user_id (links to auth), name, contact_info
  - created_at

asset_leases (replaces/extends asset_contracts)
  - id, asset_id, tenant_id
  - annual_rent, payment_frequency, escalation_rate
  - start_date, end_date, status ('active' | 'expired' | 'terminated')
  - auto_distribute (boolean)

lease_payments
  - id, lease_id, amount, currency
  - due_date, paid_date, status ('upcoming' | 'paid' | 'late' | 'missed')
  - xrpl_tx_hash, payment_method ('xrpl' | 'fiat' | 'manual')
```

### Open Questions
- Does the farmer pay in XRP or fiatf? If fiat, we need an on-ramp or just manual recording. If XRP, the oracle can auto-detect it.
- Tenant privacy: how much tenant info should investors see? Full name and payment history, or just anonymized stats?
- Multi-tenant: can one parcel have multiple tenants (e.g., different sections leased to different farmers)?
- Tenant incentives: does the tenant benefit from using the app vs. just writing a check? Maybe: digital receipts, payment history for credit, lease renewal notifications.

### Complexity: Medium-High
New role, new UI flows, new database tables. But it builds naturally on the existing oracle + distribution system.

---

## 3. Third-Party Land Valuation Integration

### The Idea
Instead of relying on the issuer to self-report land valuations (obvious conflict of interest), integrate with companies that already do professional land appraisals. The platform would automatically pull or verify valuations, giving investors confidence that the numbers are real.

### The Landscape — Who Does This?

**Agricultural Land Valuation Sources:**
- **USDA NASS** (National Agricultural Statistics Service) — publishes county-level farmland values annually. Free, public data. API available.
- **Farmers National Company** — ag land appraisals, management, auctions.
- **Peoples Company** — Iowa-based, farmland valuations and brokerage.
- **Murray Wise Associates** — ag land appraisal and auction.
- **AcreValue** (by Granular/Corteva) — parcel-level land value estimates using satellite data + comparable sales. Has an API.
- **NCREIF Farmland Index** — institutional-grade farmland performance data (requires membership).
- **County assessor records** — public, but inconsistent format across jurisdictions.

**General Real Estate:**
- **Zillow / Redfin APIs** — residential focus, less useful for ag.
- **CoStar** — commercial real estate data. Expensive.
- **CoreLogic** — property data + analytics. Enterprise pricing.

### Approach

**Tier 1 — Manual Third-Party Upload with Verification Badge**
- Issuer uploads an appraisal PDF from a recognized firm.
- Platform extracts key data (appraised value, date, appraiser name/license).
- Asset gets a "Third-Party Verified" badge with the appraisal date.
- Investors can view the appraisal document.
- Simple, no API needed, works today.

**Tier 2 — Automated Valuation Cross-Check**
- Pull USDA NASS county-level data (free, public API).
- Pull AcreValue parcel estimates (if API access available).
- Compare issuer's stated valuation against these benchmarks.
- Show a "Valuation Health" indicator:
  - ✅ Within 15% of benchmark → "Consistent with market data"
  - ⚠️ 15-30% deviation → "Above/below market benchmarks — review recommended"
  - 🔴 >30% deviation → "Significant deviation — independent appraisal recommended"
- This doesn't replace a real appraisal but flags obvious red flags.

**Tier 3 — Full Oracle-Based Valuation Feed**
- Partner with one or more valuation providers.
- Asset's `oracle_method` set to `'external_feed'` (already in schema).
- Oracle periodically pulls updated valuation from provider API.
- NAV (Net Asset Value) per token auto-updates.
- Price history chart shows valuation over time.
- Distribution amounts cross-checked against property income expectations for the given valuation.

### Distribution Cross-Check Logic
This is the "check that distributions and all of that is correct" part:
- If a $1M property is yielding 15% annually, that's unusual for ag land (typical: 3-6%). Flag it.
- If distributions suddenly spike or drop without a corresponding lease change, flag it.
- Compare yield-to-value ratio against regional benchmarks.
- Show investors a "Distribution Health" score alongside the valuation data.

### Open Questions
- Cost: AcreValue and similar APIs charge per query. Budget?
- Coverage: USDA data is county-level averages — not parcel-specific. Good for sanity checks, not precise valuation.
- Frequency: How often should valuations refresh? Ag land doesn't move fast — annually or semi-annually is probably fine.
- Legal: Can we display third-party valuation data? Licensing terms vary.
- International: If TierraDex expands beyond US, each country has different valuation systems.

### Complexity: Tier 1 is Low, Tier 2 is Medium, Tier 3 is High

---

## 4. Voting / Governance

### The Idea
When you have hundreds of thousands of token holders for a piece of land, how do they make collective decisions? Zoning changes, lease renewals, selling the property, capital improvements — someone has to decide.

### Models to Consider

**Model A: Traditional Stock-Style (Weighted by Ownership %)**
- 1 token = 1 vote, weighted by holdings.
- If you own 5% of tokens, your vote counts as 5% of total.
- Proposals have a deadline. If you miss the vote, you miss it.
- Quorum requirement: e.g., 30% of tokens must vote for the result to be valid.
- Simple, understood, legally precedented.

**Pros:** Familiar to investors. Aligns voting power with economic interest (skin in the game). Easy to implement on XRPL (snapshot token balances at vote start).

**Cons:** Whale dominance — one holder with 40% can override everyone. Small holders feel powerless. Low participation expected (stockholder votes typically get 30-50% participation even in public companies).

**Model B: Quadratic Voting**
- Voting power = √(tokens held).
- 100 tokens = 10 voting power, 10,000 tokens = 100 voting power.
- Reduces whale dominance while still giving larger holders more say.
- Used in some DAO governance (Gitcoin, etc.).

**Pros:** More democratic than pure token-weighted. Prevents one whale from dictating outcomes.

**Cons:** Less intuitive for traditional investors. Sybil attacks possible (split holdings across wallets to gain more √ voting power) — but XRPL's account reserve cost makes this expensive.

**Model C: Delegated Voting (Liquid Democracy)**
- Token holders can delegate their vote to someone they trust.
- Delegates accumulate voting power from their delegators.
- Delegators can override and vote directly on any specific proposal.
- Mimics representative democracy.

**Pros:** Solves the participation problem — most people delegate and only engage when they care. Expertise-driven: people can delegate to someone who understands ag land.

**Cons:** Complex UX. Risk of delegate cartels. Need a delegate discovery/reputation system.

**Model D: XRPL-Style Consensus (Adapted)**
- XRPL consensus isn't really voting — it's a mechanism for validators to agree on transaction ordering. Not directly applicable to governance.
- However, the *philosophy* is interesting: trusted nodes (UNL) reach agreement, and the network follows.
- Adapted version: "Trusted Committee" model — token holders elect a small committee (5-9 people) who make day-to-day decisions. Major decisions (sell property, change lease terms) go to full token holder vote.

**Pros:** Fast decision-making for routine matters. Full vote only when it matters.

**Cons:** Committee selection politics. Risk of committee acting against majority interest. Need removal/recall mechanism.

### My Recommendation: Hybrid Approach
Start with **Model A (token-weighted)** for simplicity and legal clarity, with these additions:
- **Proposal categories** with different thresholds:
  - Routine (maintenance, minor lease amendments): Committee or simple majority
  - Significant (lease renewal, capital improvements): 60% supermajority
  - Critical (sell property, change token structure): 75% supermajority + 40% quorum
- **Delegation option** for passive investors
- **Vote reminder notifications** with clear deadlines
- **Results binding on-chain**: vote outcome recorded to XRPL (memo field or future hooks)

### Implementation Sketch
```
proposals
  - id, asset_id, title, description, category
  - created_by (user_id), status ('draft' | 'active' | 'closed' | 'executed')
  - start_date, end_date
  - quorum_required (%), approval_threshold (%)
  - result ('passed' | 'failed' | 'no_quorum')

votes
  - id, proposal_id, voter_wallet, token_balance_at_snapshot
  - vote ('for' | 'against' | 'abstain')
  - delegated_from (wallet, nullable)
  - xrpl_tx_hash (optional, for on-chain record)

vote_delegations
  - id, asset_id, delegator_wallet, delegate_wallet
  - active (boolean)
```

### Open Questions
- Legal enforceability: are token-weighted votes legally binding for real property decisions? Depends on LLC operating agreement structure. The LLC agreement should reference the token governance mechanism.
- Gas/transaction costs: if 500k people vote, that's 500k XRPL transactions if recorded on-chain. At 12 drops each that's cheap (~6 XRP total), but the API throughput matters. Alternative: off-chain votes with Merkle proof of results posted on-chain.
- Voter apathy: expect <20% participation for routine votes. Is that okay? Quorum requirements need to be realistic.
- Proxy voting: does delegation satisfy SEC proxy rules? Needs legal review.

### Complexity: High
Governance is simple to build (it's just polls with weighted votes) but very hard to design correctly. The legal and social dynamics matter more than the code.

---

## 5. Oracle Deep Dive — Real-Time Data Feeds

### The Idea
Expand beyond the current lease-payment oracle to pull in diverse real-time data that affects land value and investor decisions.

### What We Have
Current oracle: monitors XRPL for payments from operator wallets → validates against lease contracts → auto-distributes. It's narrow — only watches for one type of event (incoming payments).

### What Else Could an Oracle Feed In?

**Category 1: Financial Data**
- **Commodity prices** (corn, soybeans, wheat, cattle) — directly impacts ag land income
- **Interest rates** — affects land financing and relative attractiveness
- **Comparable sales** — nearby parcels selling signals market movement
- **Rental rate indices** — USDA publishes state/county cash rent data

**Category 2: Physical/Environmental Data**
- **Weather data** — drought, flood, frost events affect crop yield → income
- **Soil quality scores** — USDA Web Soil Survey API (SSURGO data)
- **Satellite imagery** — NDVI (vegetation index) shows crop health. Sentinel-2 is free.
- **Water rights / water table levels** — critical in western US

**Category 3: Legal/Regulatory**
- **Zoning changes** — county planning department records
- **Tax assessments** — county assessor updates
- **Environmental regulations** — wetland designations, conservation easements
- **Eminent domain proceedings** — public record but hard to monitor

**Category 4: Operational**
- **Lease payment status** (current oracle handles this)
- **Insurance status** — is the property insured? Policy expiry?
- **Property tax payment status** — is the LLC current on taxes?
- **Maintenance/improvement records** — capital expenditures logged

### Architecture Options

**Option A: Centralized Oracle (Current)**
- TierraDex server pulls data from APIs, validates, stores in DB.
- Simple, fast, full control.
- Single point of failure / trust.

**Option B: Multi-Source Aggregation**
- Pull same data point from 2-3 sources.
- Median or consensus value used.
- More reliable, catches source errors.
- Example: land value from USDA + AcreValue + county assessor → median.

**Option C: Decentralized Oracle Network**
- Use Chainlink or Band Protocol (if available on XRPL sidechain / EVM Sidechain).
- Third parties stake collateral to provide accurate data.
- Trustless but adds complexity and cost.
- XRPL doesn't natively support Chainlink — would need the EVM sidechain or a bridge.

**Option D: XRPL Native Price Oracle (New Feature)**
- XRPL has been discussing native oracle functionality (XLS-47d amendment proposal).
- If/when available, could use native XRPL oracle for price feeds.
- Keep an eye on this — it would be the cleanest integration.

### Practical First Steps
1. **USDA NASS API** — free, reliable, covers county-level land values and cash rents. Integrate this first.
2. **Weather API** (OpenWeather or NOAA) — free tier available. Show weather alerts for parcel locations.
3. **AcreValue API** — parcel-level estimates. Reach out for API access/pricing.
4. **XRP/USD price feed** — already somewhat in play via `xrp-price.ts`. Ensure distributions show USD-equivalent values.

### Open Questions
- Data freshness vs. cost: real-time feeds cost money. Ag land data doesn't change fast — daily or weekly pulls are probably sufficient for most data.
- Trust model: who vouches for the oracle data? If TierraDex runs the oracle, investors have to trust TierraDex. Is that acceptable, or do we need third-party attestation?
- Alert system: when oracle data shows something unusual (drought in the area, plummeting commodity prices), should investors be notified? Probably yes.
- Historical data: store oracle snapshots over time to show trends (land value trajectory, rainfall patterns, etc.).

### Complexity: Medium per data source, High overall
Each API integration is straightforward. The challenge is building a coherent dashboard that synthesizes all this data into actionable insights without overwhelming the investor.

---

## 6. Ownership Transition — Who Owns the Land When the Issuer Sells All Tokens?

### The Problem
This is the deepest question here. In traditional land ownership, the deed has a name on it. In tokenized land, if the original owner sells 100% of their tokens, what happens?

The land is held by an LLC. The tokens represent membership interests in that LLC. The LLC owns the land. So the real question is: **who controls the LLC when the original managing member sells out?**

### Scenarios

**Scenario A: The Issuer Sells Everything**
- Issuer started with 100% of tokens, sells to the public, now holds 0%.
- They have zero economic interest. Should they still manage the property?
- Traditional answer: no. They're a hired manager at best, a liability at worst.

**Scenario B: Gradual Dilution**
- Issuer keeps 20%, sells 80%. Still the largest single holder.
- They maintain economic alignment. Management makes sense.
- But what if someone else accumulates 30%? Who manages then?

**Scenario C: Hostile Accumulation**
- One investor quietly buys 51% of tokens on the secondary market.
- Do they automatically become the managing member? Should they?
- In traditional stocks, this triggers a change-of-control. In tokenized land?

### Models for Ownership Transition

**Model 1: Majority Token Holder = Manager**
- Whoever holds the most tokens is the de facto manager.
- Simple, automatic, no voting needed.
- **Problem:** Managing land is actual work (taxes, insurance, leases, maintenance). A passive investor who accumulated tokens for price appreciation doesn't want to mow the lawn.
- **Problem:** What if holdings are spread evenly? 500 investors each holding 0.2% — nobody is "majority."

**Model 2: Elected Manager (Vote)**
- When the original issuer's holdings drop below a threshold (e.g., 10%), a management election is triggered.
- Any token holder can nominate themselves (or someone else).
- Token-weighted vote determines the new manager.
- Fixed term (e.g., 2 years) with re-election.

**Problem:** Why would anyone want to do this? It's a lot of work for...what?

**Model 3: Professional Property Manager**
- When no single holder wants to manage, the LLC hires a professional property management company.
- The manager is paid a fee (e.g., 5-8% of rental income — industry standard for ag land management).
- Token holders vote to select/replace the management company.
- This is probably the most realistic outcome for widely-held tokenized land.

**Model 4: DAO-Style Autonomous Management**
- The oracle + smart contract system manages everything automatically.
- Lease payments flow in, distributions flow out, no human manager needed.
- Property taxes paid automatically. Insurance renewed automatically.
- Works for stable, leased ag land. Breaks down when decisions are needed (sell the land? Accept a new tenant? Approve a zoning change?).

### The Incentive Problem
Your contact nailed it: "What advantage? It can be a lot of work."

**Why would someone volunteer to manage tokenized land?**

Possible incentives:
- **Management fee**: Manager receives X% of rental income (deducted before distribution). Industry standard for ag land managers is 5-8%.
- **Extra token allocation**: Manager receives a small annual token mint as compensation (dilutive, so requires holder approval).
- **Reduced platform fees**: Manager pays lower TierraDex fees.
- **Reputation / track record**: If TierraDex grows, being a proven land manager on the platform could be a business in itself. Think "verified manager" badge with a track record of properties managed, distributions made, investor satisfaction.
- **Decision-making power**: Some people want control. If you manage 10,000 acres of tokenized farmland, you have significant influence in that region.

### Recommended Framework

```
Ownership Tier System:
┌─────────────────────────────────────────────────────┐
│ Issuer holds > 50%   → Issuer is Managing Member    │
│ Issuer holds 10-50%  → Issuer manages unless voted  │
│                        out by 60% supermajority      │
│ Issuer holds < 10%   → Management election triggered │
│ No single holder >5% → Professional manager hired    │
│                        (voted on by token holders)   │
└─────────────────────────────────────────────────────┘

Manager Compensation:
- Base: 5% of gross rental income
- Performance bonus: if distributions exceed projected yield
- Penalty: if distributions miss projected yield by >20% for 2 quarters
- Removal: 60% supermajority vote at any time
```

### Legal Reality Check
All of this has to be encoded in the **LLC Operating Agreement** before tokenization. The operating agreement is the legal backbone — the tokens represent what the agreement says they represent. If the agreement doesn't address management transition, the tokens are just numbers.

**Critical:** The operating agreement should specify:
- How managing member is selected/replaced
- What triggers a management change
- Manager compensation structure
- Fiduciary duties of the manager
- What happens in deadlock (no majority)

### Open Questions
- State law matters: LLC governance varies by state. Delaware, Wyoming, and Nevada are most flexible for tokenized structures.
- SEC implications: if the management structure changes, does the token's security status change? Probably not if the LLC agreement contemplated it, but needs legal review.
- Insurance: who carries liability insurance when management changes? This is a real operational issue.
- Transition period: when management changes, there needs to be a handoff process (account access, tax records, tenant relationships). How long? 30 days? 90 days?

### Complexity: Low (code), Very High (legal/structural)
The code is straightforward — it's just voting + role assignment. The hard part is the legal framework and the incentive design. This should be designed with a securities attorney before any code is written.

---

## Summary Matrix

| Feature | Code Complexity | Legal Complexity | Value to Platform | Recommended Priority |
|---------|----------------|-----------------|-------------------|---------------------|
| Private Permission Domains | Medium | Medium (Reg D alignment) | High — unlocks institutional/private deals | 1st |
| Farmer/Tenant Relationship | Medium-High | Low | High — completes the income cycle | 2nd |
| Third-Party Valuations | Low → High (by tier) | Low | High — builds investor trust | 3rd (start Tier 1) |
| Voting / Governance | Medium | Very High | Medium now, Critical at scale | 4th (design now, build later) |
| Oracle Expansion | Medium per source | Low | Medium — nice-to-have for v1 | 5th |
| Ownership Transition | Low (code) | Very High | Critical at scale | Design with attorney NOW, build later |

---

## Next Steps

1. **Legal consultation** — Before building governance or ownership transition, get a securities attorney to draft template LLC operating agreement language. This is foundational.
2. **Private domains** — Quickest win. Builds on existing RequireAuth. Opens up private placement market.
3. **Tenant role** — Extends the existing oracle system naturally. Makes the platform feel complete.
4. **Valuation Tier 1** — Upload + badge system. Low effort, high trust signal.
5. **Governance design doc** — Deeper spec on voting mechanics. Don't build yet, but have the design ready.
6. **Oracle roadmap** — Prioritize USDA NASS and weather data as first external feeds.
