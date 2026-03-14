# Oracle Architecture Reference

**Product:** RWA Platform
**Version:** 1.0
**Date:** March 2026

---

## What Is an Oracle?

An oracle is the bridge between real-world data (lease payments, property appraisals, bank statements) and your platform. Your app cannot see a bank account, read a lease contract, or verify an appraisal on its own — someone or something has to bring that data in. That is the oracle.

**The core fairness question:** Who controls the input, and how do investors verify it is accurate?

---

## The Trust Spectrum

```
Most trust required from investors          Least trust required from investors
             ↓                                              ↓
    Manual (issuer types it)       →       Chainlink (decentralized, automated)
```

The goal over time is to move right — reducing reliance on any single party's honesty.

---

## Oracle Levels

### Level 1 — Document-Backed Manual Entry (Build Now)
The issuer records income events manually and attaches supporting documents as proof.

**How it works:**
```
Lease payment received
    → Issuer opens dashboard
    → Enters amount + event type
    → Uploads: bank statement, wire confirmation, or signed receipt
    → Oracle calculates yield automatically
    → Investors see updated yield + can request documents
```

**Fairness mechanism:** The formula is fixed and auditable. The input requires the issuer to produce real documentation — falsifying a bank statement is fraud, creating legal accountability.

**Best for:** Private Reg D deals, small investor count, annual or quarterly distributions.

**What to include in PPM:** "Distributions are recorded by the managing member and supported by bank statements or payment receipts retained by the entity. Investors may request documentation upon written notice."

---

### Level 2 — Third-Party Attestation (Intermediate)
A CPA, property manager, or designated attestor must confirm income figures before they are recorded.

**How it works:**
```
Issuer enters lease amount
    → Attestor (CPA) receives notification
    → CPA logs in and approves the figure
    → Oracle records it only after approval
    → Distribution calculated and visible to investors
```

**Fairness mechanism:** Two independent parties must agree on the number. Collusion between issuer and CPA would constitute fraud.

**Best for:** Larger investor counts, higher dollar amounts, clients who want institutional credibility.

**What to include in PPM:** "All income figures are attested by [CPA Firm Name] prior to recording. Distribution records are available to investors upon request."

---

### Level 3 — Automated Bank Feed (Recommended at Scale)
The LLC's bank account is connected via API (Plaid or similar). When a payment lands, it automatically triggers a distribution record — no human input required.

**How it works:**
```
Tenant pays rent via ACH
    → Lands in LLC bank account
    → Plaid webhook fires automatically
    → App records distribution event
    → Oracle recalculates yield in real time
    → Investors see update immediately
```

**Fairness mechanism:** No issuer involvement in the data input. The bank is the source of truth. Automation eliminates human error and manipulation at the input stage.

**Best for:** High-frequency distributions (monthly), multiple assets, scaling to many investors.

**What to include in PPM:** "Distributions are triggered automatically upon receipt of funds in the entity's designated bank account via verified bank feed integration. No manual entry is required."

---

### Level 4 — Decentralized Oracle / Chainlink (On-Chain)
For property valuation, multiple independent data providers submit estimates, a median is taken, and the result is written on-chain. No single party controls the valuation figure.

**How it works:**
```
Multiple data providers submit property value estimates (CoStar, county assessor, Zillow API)
    → Chainlink aggregates and takes the median
    → Writes result on-chain: "Property value = $5,200,000"
    → Smart contract reads the value
    → NAV updates automatically across all token holders
```

**Fairness mechanism:** No single entity — not even the issuer — can manipulate the valuation. Any investor can verify the oracle on-chain independently.

**Best for:** Reg A+ (retail investors), DeFi integration, maximum transparency, institutional fundraising.

**What to include in PPM:** "Asset valuations are sourced from a decentralized oracle network aggregating [data sources]. The oracle address is [0x...] and is publicly verifiable on [network] at any time."

---

## Comparison Table

| Level | Method | Who Controls Input | Investor Verification | Cost | Build Complexity |
|-------|--------|-------------------|----------------------|------|-----------------|
| 1 | Manual + Documents | Issuer | Request documents | Low | Low (now) |
| 2 | Third-Party Attestation | Issuer + CPA | Request attestation records | Medium | Medium |
| 3 | Automated Bank Feed | Bank (automated) | Bank statement / Plaid report | Medium | Medium |
| 4 | Chainlink / Decentralized | No single party | On-chain, public | High | High |

---

## Oracle by Data Type

| Data | Best Method Now | Best Method at Scale |
|------|----------------|---------------------|
| Lease / rental income | Level 1 — Issuer records + document upload | Level 3 — Plaid bank feed |
| Property valuation | Level 1 — Formal appraisal uploaded | Level 4 — Chainlink aggregator |
| Token balances | Automated (XRPL account_lines) | Same |
| Distribution calculation | Automated (app formula, fixed) | Same |
| NAV per token | Automated (valuation ÷ supply) | Same |

---

## The Client Conversation

When onboarding a new client, oracle method is a **legal and trust decision**, not just a technical one. Cover this during intake:

> "Your investors will see yield numbers on the dashboard. We need to agree on how those numbers are sourced. The more automated and verified the source, the more trust your investors have — and the less liability you carry as the managing member. I recommend we start with document-backed manual entry and build toward an automated bank feed as you scale."

**The chosen method must be disclosed in:**
- The Private Placement Memorandum (PPM)
- The Operating Agreement (how NAV and distributions are calculated and recorded)
- Investor onboarding materials

---

## Roadmap for This Platform

| Phase | Oracle Setup | Trigger |
|-------|-------------|---------|
| Now | Level 1 — Manual + document upload | Launch / first clients |
| Growth | Level 2 — CPA attestation role | > 10 investors or > $500k AUM per asset |
| Scale | Level 3 — Plaid bank feed | > 3 assets or monthly distributions |
| Institutional | Level 4 — Chainlink on-chain | Reg A+ / DeFi integration / large raise |

---

## Key Principle

> The oracle method is only as fair as the weakest link in its data chain. No matter how automated the calculation, if the input can be manipulated, the output can be manipulated. Move up the trust ladder as your investor base and deal size grow.

---

*Document Version 1.0 — Wood Land Holdings LLC — RWA Platform*
