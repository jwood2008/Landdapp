# Legal & Compliance Guidance Checklist

**Purpose:** Use this document to guide your client through the legal requirements for tokenizing their asset. You are NOT providing legal advice — you are showing them what needs to be done and connecting them with the right professionals.

**Important:** Always preface this conversation with: *"I handle the technology side of tokenization. For legal, compliance, and tax matters, you'll need qualified professionals. Here's what they'll need to address, and I can connect you with people who specialize in this."*

---

## PHASE 1 — Entity Structure

The asset must be held in a proper legal entity before tokenization can happen. Walk the client through these questions:

### If they already have an entity:

- [ ] Is it an LLC, LP, Corporation, or Trust?
- [ ] Is the operating agreement compatible with tokenized ownership?
  - Does it allow for digital representation of membership interests?
  - Does it allow for transfer of interests without unanimous consent?
  - Does it define how new members are admitted?
  - Does it specify voting rights vs economic rights separately?
- [ ] If the operating agreement doesn't support tokenization, it needs to be amended by their attorney BEFORE any tokens are issued.
- [ ] Is the entity in good standing with the state? (annual filings current, registered agent active)
- [ ] Has the entity filed BOI (Beneficial Ownership Information) with FinCEN? (Required as of 2024 for most LLCs)

### If they need to create an entity:

- [ ] Recommend forming an LLC (single-purpose SPV) to hold the asset
- [ ] The LLC should be formed in the state where the asset is located OR in a business-friendly state (Delaware, Wyoming, Nevada)
- [ ] The operating agreement needs to be drafted WITH tokenization in mind from day one — much easier than amending later
- [ ] Their attorney should include provisions for:
  - Tokenized membership interests as the official record of ownership
  - Transfer restrictions that mirror securities compliance requirements
  - Manager vs member roles clearly defined
  - Distribution mechanics (frequency, calculation, approval process)
  - What happens if a member loses access to their wallet

### Key question to ask:
> "Do you have an attorney who can draft or amend your operating agreement to support tokenized membership interests? If not, I can connect you with one who has done this before."

---

## PHASE 2 — Securities Compliance

This is the most critical legal step. Tokenized ownership interests are almost certainly securities under US law. The client MUST work with a securities attorney.

### Explain the basics:

> "When you sell ownership in an asset where investors expect to profit from your management efforts, that's a security under federal law. It doesn't matter that it's on a blockchain — the SEC looks at the economic reality. This isn't a problem, it just means we need to follow the right exemption."

### The three most common exemptions:

**Reg D 506(b) — Most likely starting point**
- [ ] Unlimited raise amount
- [ ] Up to 35 non-accredited investors (but recommend all accredited to keep it clean)
- [ ] NO general solicitation — you cannot advertise publicly
- [ ] Must have a pre-existing relationship with investors
- [ ] File Form D with SEC within 15 days of first sale
- [ ] State notice filings (Blue Sky) may be required — attorney handles this
- [ ] Cheapest and fastest to set up

**Reg D 506(c) — If they want to market publicly**
- [ ] Can use general solicitation (ads, social media, website)
- [ ] ALL investors MUST be verified accredited (third-party verification required)
- [ ] More expensive due to verification requirements
- [ ] File Form D with SEC within 15 days of first sale
- [ ] Good for clients with a public platform or large network

**Reg A+ — If they want retail/non-accredited investors**
- [ ] Mini-IPO, SEC qualification required
- [ ] Tier 1: up to $20M raise, Tier 2: up to $75M
- [ ] Open to non-accredited investors
- [ ] Expensive ($50k-$150k+ in legal fees)
- [ ] Slow (3-6+ months for SEC review)
- [ ] Only recommend for large, established clients

### Documents their attorney needs to prepare:

- [ ] **Private Placement Memorandum (PPM)** — The disclosure document that describes the investment, the risks, the terms, the asset, the management team, and everything an investor needs to make an informed decision
- [ ] **Subscription Agreement** — The contract each investor signs to purchase tokens/membership interests. Includes investor representations (accredited status, understanding of risks, etc.)
- [ ] **Operating Agreement (amended or new)** — Must reflect tokenized ownership structure
- [ ] **Investor Questionnaire / Accreditation Verification** — Documentation proving each investor qualifies

### Questions to ask the client:

1. Do you have a securities attorney? Have they done a tokenized or digital securities offering before?
2. Which exemption makes sense for your situation? (Guide based on their investor profile from the intake questionnaire)
3. Are all of your investors accredited? How do you know?
4. Do you have a pre-existing relationship with all potential investors? (Critical for 506(b))
5. Have you ever had any SEC, FINRA, or state securities enforcement actions against you?
6. Are you aware that you cannot publicly advertise this offering under 506(b)?

### Key question to ask:
> "Your securities attorney will handle the PPM, subscription agreement, and exemption filing. Do you have someone, or would you like me to connect you with an attorney who specializes in this?"

---

## PHASE 3 — KYC/AML Compliance

Every investor must go through Know Your Customer and Anti-Money Laundering verification. This is non-negotiable.

### What the client needs to understand:

- [ ] Every investor must provide government-issued ID and be verified
- [ ] Every investor must be screened against OFAC sanctions lists
- [ ] For accredited investors under 506(c), third-party accreditation verification is required (CPA letter, attorney letter, or verification service)
- [ ] Records must be maintained for the life of the investment plus 5 years minimum
- [ ] International investors add complexity — their attorney needs to advise on Reg S implications

### Options for handling KYC:

**Option A — Manual (small deals, <10 investors)**
- Client collects ID copies and accreditation letters directly
- Client or their attorney verifies and maintains records
- Lowest cost but doesn't scale

**Option B — Third-party service (recommended)**
- Services like Verify Investor, Parallel Markets, or North Capital handle accreditation verification
- KYC/identity services like Persona, Jumio, or Sumsub handle ID verification and OFAC screening
- Can be integrated into the onboarding flow on the platform
- Cost: typically $50-$150 per investor for accreditation, $1-$5 per KYC check

**Option C — Transfer agent / compliance partner**
- Full-service compliance partner handles KYC, AML, accreditation, subscription doc management
- Most expensive but most hands-off for the client
- Examples: Securitize, tZero, Vertalo

### Questions to ask the client:

1. How do you plan to verify your investors' identities and accreditation status?
2. Are any of your investors international? If so, which countries?
3. Are you comfortable requiring every investor to complete KYC before they can participate?
4. Do you want us to integrate KYC verification into the platform onboarding flow?

---

## PHASE 4 — Tax Structure & Reporting

This is their CPA's territory, but they need to understand what's coming.

### What the client needs to know:

- [ ] If the SPV is a multi-member LLC taxed as a partnership, the entity must file a Form 1065 annually
- [ ] Every investor/member receives a Schedule K-1 showing their share of income, deductions, gains, losses
- [ ] K-1s must be issued by March 15 (or extended deadline) each year
- [ ] The entity needs a separate EIN (Employer Identification Number)
- [ ] Distributions are generally NOT taxable income — they're returns of capital until basis is exceeded
- [ ] If secondary token transfers are allowed, the partnership may need a Section 754 election (ask their CPA)
- [ ] Each SPV is a separate entity = separate tax return = separate cost

### Questions to ask the client:

1. Do you have a CPA who handles partnership tax returns?
2. Are entity tax returns currently up to date?
3. Does your CPA understand that ownership is represented by blockchain tokens? (They don't need to be crypto experts, they just need to know the cap table lives on-chain)
4. How will you handle K-1 distribution to token holders? (The platform can help with this)
5. Are you aware of the ongoing annual cost for entity-level tax preparation?

### Key question to ask:
> "Your CPA will handle partnership returns and K-1s for investors. Do you have someone who does this, or do you need a referral?"

---

## PHASE 5 — Transfer Restrictions & Ongoing Compliance

Once tokens are issued, there are ongoing obligations.

### Transfer restrictions their attorney must define:

- [ ] Holding period — How long must an investor hold before they can transfer? (Reg D typically requires 6-12 month lockup)
- [ ] Whitelist requirement — Can tokens only be transferred to pre-approved wallets?
- [ ] Approval process — Does the managing member need to approve each transfer?
- [ ] Right of first refusal — Does the entity or other members get first right to buy before external transfer?
- [ ] Maximum investor count — Some exemptions limit the number of holders

### Ongoing obligations:

- [ ] Annual Form D amendments if there are material changes to the offering
- [ ] State notice filing renewals (varies by state)
- [ ] Annual financial reporting to investors (most PPMs require this)
- [ ] K-1 distribution annually
- [ ] Maintain current cap table and investor records
- [ ] Update BOI filings with FinCEN if ownership/control changes
- [ ] Insurance renewals and coverage reviews

### Questions to ask the client:

1. Who will be responsible for ongoing compliance? (Managing member, attorney, compliance service?)
2. Do you plan to allow secondary transfers of tokens, or is this a closed group?
3. How will you handle a situation where an investor wants out? (Buyback? Find replacement? Wait for exit event?)
4. What is the planned exit strategy for this investment? (Sale of asset, refinance, hold indefinitely?)

---

## PHASE 6 — Pre-Launch Checklist

Before any tokens are issued or any money changes hands, ALL of the following must be complete:

### Legal & Compliance
- [ ] Entity formed and in good standing
- [ ] Operating agreement drafted/amended with tokenization provisions
- [ ] Securities exemption chosen and PPM drafted
- [ ] Subscription agreement template finalized
- [ ] Transfer restriction policy documented
- [ ] BOI filed with FinCEN
- [ ] EIN obtained for the entity

### Investor Readiness
- [ ] KYC/AML process established
- [ ] Accreditation verification method chosen
- [ ] Investor communication plan in place
- [ ] Subscription document signing process ready (DocuSign, etc.)

### Financial
- [ ] Bank account opened for the entity
- [ ] CPA engaged for partnership returns
- [ ] Distribution schedule and calculation method documented
- [ ] Fee structure documented and disclosed in PPM

### Technology (Your Side)
- [ ] Token parameters configured (symbol, supply, decimals)
- [ ] XRPL trust lines ready
- [ ] Investor dashboard configured
- [ ] Wallet onboarding process tested
- [ ] Distribution engine configured
- [ ] Investor whitelist/authorization system active

### Final Confirmation
- [ ] Securities attorney has reviewed and approved the entire structure
- [ ] CPA has confirmed tax treatment and reporting process
- [ ] All current owners/members have signed off
- [ ] Form D ready to file within 15 days of first sale

---

## REFERRAL CONTACTS

Keep this section updated with professionals you trust and can refer clients to.

### Securities Attorneys
| Name | Firm | Location | Notes |
|------|------|----------|-------|
|      |      |          |       |
|      |      |          |       |

### CPAs / Tax Advisors
| Name | Firm | Location | Notes |
|------|------|----------|-------|
|      |      |          |       |
|      |      |          |       |

### KYC/Compliance Services
| Service | Website | Cost | Notes |
|---------|---------|------|-------|
|         |         |      |       |
|         |         |      |       |

---

## IMPORTANT DISCLAIMERS

**Always make clear to the client:**

1. You are a technology service provider, not a law firm, not a broker-dealer, not a financial advisor.
2. Nothing you say or provide constitutes legal, tax, or investment advice.
3. They are solely responsible for ensuring their offering complies with all applicable federal, state, and local laws.
4. You strongly recommend they engage qualified legal counsel and tax advisors before proceeding.
5. You reserve the right to decline to tokenize any asset that does not have proper legal documentation and compliance in place.

---

*Document Version 1.0*
*Land DAPP — Asset Tokenization Platform*
