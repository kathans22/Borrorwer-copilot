# Open questions

Every number in [RULES.md](RULES.md) whose Source column says **NEEDS
VERIFICATION**, in one list, so it can be checked rather than trusted. These
are my best reading of the Indian market. None of them is scraped, quoted from
a lender, or taken from a published schedule, and I have deliberately not
invented a circular number, a bank name or a specific rate to make any of them
look more authoritative than it is.

They are ordered by how much damage a wrong value does. The top of this list is
where I would spend verification time first.

---

## 1. Cost-of-living assumptions — highest impact

These drive the safe-carry figure more than anything else in the model, and
they are judgement calls about households I have not met. In the worked example
in RULES.md they are the difference between a ₹12,700 answer and a ₹2,950 one.

| Rule | Value assumed | What I would check |
|---|---|---|
| DEF-01 | Household expenses excluding rent: metro ₹9,000 + ₹3,500/dependant, down to rural ₹4,500 + ₹2,000 | Consumption expenditure survey data by tier and household size. Anything with a real sample behind it beats my estimate. |
| DEF-02 | Rent: metro ₹8,000 down to rural ₹2,000 | Rental data for the income segment we serve, not the city median — the median is pulled up by housing our borrowers do not live in. |
| AFF-05 | Residual income floor: metro ₹9,500 + ₹3,000/dependant, down to rural ₹5,000 + ₹1,750 | Whether a residual-income floor is the right instrument at all at these income levels, and if so what the floor should be. This is the single value most worth arguing about. |
| DEF-03 | Unstated existing obligations = 5% of safety income | Whether a non-zero default is the right call, and if so what share. I hold that zero is wrong here; the 5% itself is arbitrary. |

## 2. Product pricing and terms

| Rule | Value assumed | What I would check |
|---|---|---|
| PRD-01 | Personal loan 10.5%–24% p.a., 12–60 months, fee 1%–3%, ticket ₹25,000–₹25,00,000, min income ₹15,000/month | Current advertised ranges across a PSU bank, a private bank, an NBFC and a fintech. |
| PRD-02 | LAP 9%–15% p.a. floating, 60–180 months, LTV 50%–70%, fee 0.5%–2%, plus ₹5,000–₹15,000 legal and valuation, min income ₹20,000/month | Whether 180 months is the right ceiling (some lenders write 240), and whether the legal and valuation range holds for a small commercial property. |
| PRD-03 | Business unsecured 14%–26% p.a., 12–48 months, vintage ≥ 24 months, min income ₹25,000/month | The vintage requirement especially — 24 vs 36 months changes who is eligible at all. |
| PRD-04 | Two-wheeler EV 9.5%–22% p.a., LTV 80%–90%, 12–48 months | Whether EV-specific schemes price below petrol two-wheelers, and whether any subsidy affects the financeable amount. I have deliberately modelled no subsidy rather than guess at one. |
| PRD-05 | LAP LTV: residential 60%–70%, commercial 50%–60% | The commercial haircut. It matters directly to a shopkeeper pledging premises. |
| PRD-07 | GST on lender fees at 18% | The current rate and whether it applies to all the charge heads I have assumed. |
| PRD-08 | Lender-type spread: PSU 0–1.5, private 0.5–3.0, NBFC 2.0–6.0, fintech 4.0–10.0 points over the product floor | Whether segmenting by lender type is the right model at all — this was one of the day-one questions to Lokta and the answer may replace it with a single market-wide band. |

## 3. Credit tiers

| Rule | Value assumed | What I would check |
|---|---|---|
| CRD-01 to CRD-06 | Score-tier spreads from +0–0.75 points at 780+ to +12–18 at below 600 | Real risk-based pricing grids. The tier boundaries (780/750/700/650/600) are conventional; the spreads attached to them are mine. |
| CRD-07 | New to credit: +3.00 to +9.00 points | Whether new-to-credit is priced closer to near-prime than I have assumed. |
| CRD-10 to CRD-13 | Bounce and DPD penalties: +1.00, +2.50, hard stop, +4.00 points; cooling-off 6 and 24 months | The cooling-off periods especially, since ACT-04 turns them into a date the borrower is asked to plan around. Being wrong here means giving somebody a wrong deadline. |

## 4. Affordability and underwriting convention

| Rule | Value assumed | What I would check |
|---|---|---|
| AFF-01 | FOIR 40/50/55/60% by income band | Whether the bands and caps match what lenders actually apply, and whether the band boundaries are at the right income levels. |
| AFF-04 | Existing obligations sit inside the FOIR cap rather than outside | Convention. Getting this backwards changes every eligibility number. |
| INC-01 | Recognition by proof: GST returns 0.60, bank statements only 0.50 | Assessed-income and surrogate underwriting programmes vary a lot between NBFCs. 0.50 for bank statements is a mid-point of a wide practice. |
| INC-08 | Co-applicant income counted at 1.00 | Whether lenders discount a co-applicant's income, and whether it depends on the relationship. |

## 5. Age and tenure

| Rule | Value assumed | What I would check |
|---|---|---|
| AGE-01 | Max age at maturity: formal salaried 60, informal salaried 58, self-employed 65, daily wage 58 | The 58 for informal and daily-wage work is my judgement, not an observed lender rule. It is the one I would most expect to be wrong. |
| AGE-02 | LAP allows +5 years | Whether the LAP maturity ceiling is 70 or 75. |
| AGE-03 | Minimum entry age 21 | Whether 18 is workable for any product here. |
| AGE-05 | A younger co-applicant can carry the maturity date | Whether lenders actually allow this, since ACT-11 recommends it. |

## 6. Regulatory

| Rule | Value assumed | What I would check |
|---|---|---|
| REF-05 | No foreclosure charge on floating-rate term loans to individual borrowers; 4% assumed on fixed-rate | I have stated this as a principle without citing an instrument, because I will not invent a circular number. It needs checking against the actual regulation, including whether it covers LAP and whether it covers non-individual borrowers. |
| APR-04 | Bundled credit insurance excluded from APR | Whether it can be estimated at all. If it can, it belongs in the APR, because it is money the borrower pays to get the loan. |

## 7. Stress

| Rule | Value assumed | What I would check |
|---|---|---|
| STR-01 | Income drop 20% stable, 30% volatile | Whether these match observed income variance for gig and daily-wage work. |
| STR-03 | Expense inflation 6% over the stressed year | Current CPI would be better than a round number. |

---

## Questions sent to Lokta on day one

Asked before any code was written, each with a working assumption so that
nothing was blocked waiting for an answer. Current status:

| Question | Working assumption | Where it shows up |
|---|---|---|
| Does "no personal data stored" preclude client-side session persistence, or only server-side? | Local-only is fine, with an explicit "clear my answers" control and nothing leaving the browser | Not yet built — affects the UI phase |
| Should the fair-rate band be segmented by lender type, or a single market-wide band per product? | Segmented, with the market-wide band as the union, used when no lender is named | PRD-08 |
| Is a co-applicant flow in scope? | In scope, as an optional second income block through the same recognition rules | INC-08 to INC-11, ACT-06, AGE-05 |
| Should the Negotiation Card be exportable, or is on-screen enough? | On-screen first, with print-to-PDF styling rather than a new dependency | Not yet built |

If any of these comes back differently, the affected rules are the ones named
in the last column and nothing else needs to move.
