# Asset Tokenization Intake Questionnaire

**Purpose:** Ask these questions during your initial client meeting to gather everything needed to tokenize their asset. These are universal — tailor slightly based on the asset type before the meeting.

---

## SECTION 1 — About You (The Client)

1. What is your full legal name and title/role?
2. What is the best way to contact you? (phone, email, both)
3. Have you ever been involved in a securities offering before? (Reg D, Reg A+, etc.)
4. Do you have a securities attorney? If so, who?
5. Do you have a CPA or accountant? If so, who?
6. Do you have any experience with crypto, digital wallets, or blockchain?

---

## SECTION 2 — The Asset

7. What exactly is the asset you want to tokenize? Describe it in detail.
8. What type of asset is it? (real estate, aircraft, equipment, business, intellectual property, other)
9. Where is the asset physically located? (full address, county, state, country)
10. What is the current use of the asset? (income-producing, vacant, under development, operational, other)
11. What do you believe the asset is worth today?
12. What is that valuation based on? (appraisal, market comps, purchase price, revenue multiple, other)
13. When was the last formal appraisal, if any? Who conducted it?
14. Is the asset currently generating income? If yes:
    - How much per month/year?
    - What is the source? (rent, revenue, licensing, etc.)
    - How consistent is this income?
15. What are the annual carrying costs? (taxes, insurance, maintenance, management fees, utilities, etc.)
16. Are there any tenants, lessees, or contracts tied to this asset?
    - If yes, what are the terms? (lease length, rates, renewal options)
17. Are there any liens, mortgages, or encumbrances on the asset?
18. Is there any outstanding debt on the asset?
    - If yes: Who is the lender? What is the balance, interest rate, and maturity date?
    - Does the lender need to consent to any ownership restructuring or transfer?
19. Are there any environmental, zoning, regulatory, or permitting issues?
20. Is there any pending or threatened litigation involving this asset?
21. Is there anything else about this asset I should know that could affect tokenization?

---

## SECTION 3 — Ownership & Legal Structure

22. Who currently owns the asset? (individual, LLC, trust, partnership, corporation, multiple parties)
23. If it's held in an entity:
    - What type of entity? (LLC, LP, Corp, Trust, etc.)
    - What state/jurisdiction is it formed in?
    - When was it formed?
    - Who is the registered agent?
24. How many current owners/members/partners are there?
25. Who is the managing member or decision-maker?
26. Can you provide a copy of the operating agreement or governing documents?
27. Does the operating agreement allow for:
    - Transfer of membership interests?
    - Issuance of new membership interests?
    - Digital/tokenized representation of ownership?
28. Are there any restrictions on transferring ownership in the current docs? (right of first refusal, board approval, etc.)
29. Are there any existing side agreements, buyout provisions, or preferential rights among current owners?
30. Are ALL current owners aware of and aligned on tokenizing this asset?
31. Has the entity ever issued membership interests or equity to outside investors before?

---

## SECTION 4 — Goals & Intent

32. What is the primary goal of tokenizing this asset?
    - [ ] Raise new capital
    - [ ] Provide liquidity to existing owners
    - [ ] Bring in new investors/partners
    - [ ] Simplify cap table management
    - [ ] Automate distributions
    - [ ] Estate planning / generational transfer
    - [ ] Other: _______________
33. How much capital are you looking to raise, if any?
34. What percentage of the asset are you willing to tokenize? (100%? Retain majority? Keep 51% control?)
35. Do you want to retain management control regardless of how much ownership you sell?
36. Do you have existing investors/partners that need to be converted to token holders?
    - If yes, how many and do they all agree to this transition?
37. How many new investors are you targeting? (ballpark: 5? 25? 100?)
38. What is the minimum investment amount you would accept?
39. Is there a maximum investment amount per investor?
40. Is there a timeline or deadline driving this? (capital need, closing date, regulatory window, etc.)

---

## SECTION 5 — Token Design & Economics

41. How should the token supply map to ownership?
    - Example: 1,000,000 tokens = 100% ownership, so 10,000 tokens = 1%
    - Do you have a preference on total supply?
42. Should there be different classes of tokens? (voting vs non-voting, preferred vs common)
43. How will investors make money?
    - [ ] Cash flow distributions (rental income, revenue, etc.)
    - [ ] Appreciation (asset value goes up, token value goes up)
    - [ ] Both
44. How often should distributions occur? (monthly, quarterly, semi-annually, annually)
45. Is there a preferred return for investors? If yes, what percentage?
46. Is there a waterfall structure? (preferred return first, then profit split, etc.)
    - If yes, describe the tiers.
47. Are there any fees?
    - Management fee? What %?
    - Acquisition/setup fee?
    - Performance/incentive fee?
    - Other?
48. How should operating expenses be handled relative to distributions? (deducted before distributions? Separate line item?)
49. Do you want transfer restrictions on the tokens?
    - [ ] Holding/lockup period (how long?)
    - [ ] Transfers only to approved/whitelisted wallets
    - [ ] Approval required per transfer
    - [ ] No restrictions
50. Should investors be able to sell/transfer tokens to other people, or is this a closed group?
51. If secondary transfers are allowed, does the entity or managing member want a right of first refusal?

---

## SECTION 6 — Investor Profile

52. Who are your target investors?
    - [ ] People I already know (friends, family, business contacts)
    - [ ] Accredited investors I will find/network with
    - [ ] General public / non-accredited investors
53. Are your investors primarily US-based, international, or both?
54. Are all of your investors accredited? (net worth > $1M excluding primary residence, or income > $200k/$300k joint for last 2 years)
55. Are your investors comfortable with:
    - Setting up a digital wallet?
    - Holding a blockchain-based token as their proof of ownership?
    - Receiving distributions in crypto or do they require fiat (USD)?

---

## SECTION 7 — Operations & Management

56. Who manages the asset day-to-day? Will that change after tokenization?
57. Who handles the bookkeeping and accounting for this asset/entity?
58. How are you currently reporting to investors or partners, if at all?
59. What does the insurance situation look like? (policy type, carrier, coverage amount)
60. Has the entity filed BOI (Beneficial Ownership Information) with FinCEN?
61. Are entity tax returns current and up to date?

---

## SECTION 8 — Oracle Method (How Yield & Valuation Stay Current)

This section determines how the platform keeps the token's yield and NAV up to date after launch.
Explain each option to the client and document their choice in the operating agreement.

**"Your token's yield and valuation need to reflect reality over time. Here's how we can handle that:"**

62. **Manual Oracle** — You update yield and valuation yourself, typically after each formal appraisal or fiscal year end.
    - Best for: low-frequency assets, clients with annual appraisal cycles
    - Client responsibility: update the platform after each appraisal or material change
    - Operating agreement language: "Managing member shall update the NAV no less than annually, or upon any material change in asset value."
    - [ ] Client understands they are responsible for keeping NAV current

63. **Lease Income Oracle (Recommended for income-producing assets)** — The platform automatically recalculates annual yield from actual recorded distribution income. Every time a lease distribution is recorded, yield = trailing 12-month lease income ÷ current valuation.
    - Best for: land leases, rental properties, any asset with regular income events
    - Client responsibility: record every lease payment as a distribution event in the platform
    - Operating agreement language: "Annual yield shall be calculated automatically from recorded distribution events as a percentage of current asset valuation."
    - [ ] Client commits to recording every lease/income event in the platform
    - [ ] Client understands yield will be $0 / null until the first distribution is recorded

64. **External Data Feed Oracle** — Valuation is pulled from a third-party property data source on a schedule (e.g. county assessor, CoStar, ATTOM Data).
    - Best for: clients who want fully automated, market-driven valuations
    - Additional setup required: API credentials, endpoint configuration
    - Risk: third-party data may be inaccurate or delayed; not legally equivalent to a formal appraisal
    - [ ] Client accepts that automated data feeds are for informational purposes; formal appraisals still required for material events
    - [ ] Data source agreed upon: _______________

65. Which oracle method did the client choose? _______________

66. Is the chosen oracle method documented in the operating agreement? [ ] Yes [ ] No (needed before launch)

---

## SECTION 9 — Documents Needed

Before we can proceed, I'll need the following from you. Check off what you can provide:

- [ ] Operating agreement or governing documents
- [ ] Articles of organization / formation docs
- [ ] Most recent appraisal or valuation report
- [ ] Current financial statements or P&L
- [ ] Rent rolls, lease agreements, or income documentation (if applicable)
- [ ] Title report, deed, or proof of ownership
- [ ] Insurance declarations page
- [ ] Any existing PPM, subscription agreement, or investor docs
- [ ] Entity tax returns (last 2 years)
- [ ] Mortgage/loan documents (if applicable)
- [ ] Current cap table or investor/member list
- [ ] Any relevant permits, licenses, or regulatory approvals

---

## POST-MEETING NOTES (For Your Use)


**Asset summary:**


**Deal structure notes:**


**Red flags or concerns:**


**Next steps agreed upon:**


**Follow-up date:**


---

*Document Version 1.0*
*Land DAPP — Asset Tokenization Platform*
