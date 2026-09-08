# Rules

This is the human half of the rules layer. The machine half is
[`src/rules/rules.config.ts`](src/rules/rules.config.ts), and the two are the
same values seen twice. Rule IDs match line for line. **If they ever disagree,
this document is the one that is wrong** — the config is what runs.

Every lending number in this application lives in that one file. Nothing in
`engine/`, `questions/` or `ui/` holds a threshold, rate, ratio or cutoff of
its own. Change a value there and the output changes with no other edit. That
is not tidiness for its own sake: it is what makes it possible to sit with
somebody, have them disagree with an assumption, and change it in front of
them.

**Units.** Rates are annual. Incomes are monthly. Amounts are in rupees. A
spread of 100 bps is written as 1.00 percentage points. Every field name states
its unit, and the branded types in `src/types.ts` make the compiler reject a
monthly figure passed where an annual one belongs.

**On the Source column.** "My judgement" means exactly that — a number I think
is approximately right and will defend as an assumption, not as a fact.
"NEEDS VERIFICATION" means it is a market number I have not sourced from a
lender and should not be trusted until checked. Every one of those is listed in
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). I have not invented a circular number,
a bank name or a published rate anywhere in this document.

---

## The one idea

Two questions get confused everywhere in consumer lending, and this whole file
exists to keep them apart:

- **How much will a lender give me?** A ratio test on documented income.
- **How much can I actually carry?** A budget question about a household.

They are computed by rules that never read each other's output (AFF-14), and
they disagree by a lot. Worked through below for an illustrative borrower, the
lender ceiling is **₹12,700 a month** and the safe carry is **₹2,950** — a
factor of 4.3. A tool that reports only the first number is not neutral; it is
working for the lender.

---

## INC — Income recognition

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| INC-01 | Share of stated income a lender counts, by proof shown | salary slips 1.00 · ITR 1.00 · GST returns 0.60 · bank statements only 0.50 · nothing 0.00 | Proof is the primary driver. An underwriter cannot lend against a number nobody can verify, however true it is. GST turnover needs a margin assumption before it is income, hence the discount; bank credits are a surrogate and lenders treat them as one. | Industry practice — NEEDS VERIFICATION |
| INC-02 | Ceiling on recognition by how the income is earned | formal salaried 1.00 · informal salaried 0.80 · self-employed with ITR 1.00 · self-employed cash 0.80 · daily wage 0.60 | Good proof of a volatile income is still a volatile income. The cap is what stops documentation alone from turning irregular earnings into a salary. | My judgement |
| INC-03 | How INC-01 and INC-02 combine | The lower of the two binds | `min` rather than multiply. Multiplying would drive a cash earner's recognition to zero and keep it there, which would make "get bank statements" a pointless instruction. Under `min`, a cash-earning shopkeeper goes 0.50 → 0.80 by filing an ITR, and that is a real action with a real number attached. | My judgement |
| INC-04 | Share of stated income the safety view counts | 1.00 for every income type | The household repays from all of it, documented or not. It is 1.00 everywhere on purpose: volatility is a real concern but it is priced once, in STR-01 and in INC-05, rather than three times over. | My judgement |
| INC-05 | Collapsing a stated income range | Underwriting takes the midpoint · safety takes the floor | The two views take different points deliberately. A lender averages six to twelve months of bank credits, and the average of a stated range is its midpoint. A household budget has to survive the bad month, because the rent and the school fee arrive in the bad month too. | My judgement |
| INC-06 | Collapsing a stated expense or obligation range | Both views take the top of the range | Polarity flips for costs. An understated cost is the one that hurts. | My judgement |
| INC-07 | Annual income to monthly | Divide by 12, in one place only | An ITR figure is annual and cash income is monthly. Mixing them is the most likely arithmetic bug in this codebase, so the conversion has a single home and the branded types force its use. | Arithmetic |
| INC-08 | Co-applicant income share counted | 1.00 of their recognised income | A co-applicant is jointly liable for the whole debt, so their income counts in full. | Industry practice — NEEDS VERIFICATION |
| INC-09 | Co-applicant recognition rules | Their own proof and employment type run through INC-01/02 | A spouse earning ₹18,000 in cash is recognised the same way the main applicant's cash income is. Counting her in full because she is a co-applicant would be the same mistake in a different place. | My judgement |
| INC-10 | Co-applicant obligations | Their existing EMIs join the obligation side | Half a household's income is no use if the other half of its debt is invisible. | My judgement |
| INC-11 | When a co-applicant is counted | Only when the borrower has said there is one | Never inferred from marital status or anything else. | My judgement |
| INC-12 | Recognised income capped at declared income | Where a return is filed, the lender view never exceeds it | Having told the tax authority one number, a borrower cannot ask a lender to believe a larger one. This is the rule that separates the two views most sharply: a shopkeeper taking ₹55,000 a month with ₹35,000 on the return has a safety income of ₹55,000 and a recognised income of ₹35,000, and every eligibility figure is built on the smaller one. | My judgement |
| INC-13 | Proof is only as good as the figure behind it | A claimed return with no amount falls back to the bank-statements ratio | Otherwise the weakest possible answer produces the strongest possible recognition, and a borrower looks better *before* handing over the figure than after — which is the wrong way round. | My judgement |
| INC-14 | A stated guaranteed income overrides the range floor | Safety view uses the borrower's own floor | A range collapsed at its bottom (INC-05) is our guess about their bad month. "Forty is certain, eighty is a good month" is not a guess — it is them telling us where the floor actually is, and it beats any rule we could apply on their behalf. | My judgement |

## AFF — Affordability

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| AFF-01 | Lender FOIR cap by recognised monthly income | below ₹25,000 → 40% · ₹25,000–49,999 → 50% · ₹50,000–99,999 → 55% · ₹100,000 and above → 60% | Higher incomes take a higher ratio because the rupees left after a fixed basket of essentials grow faster than the ratio does: 40% of ₹20,000 leaves ₹12,000 to live on, 60% of ₹150,000 leaves ₹60,000. | Industry practice — NEEDS VERIFICATION |
| AFF-02 | FOIR adjustment for income volatility | formal salaried 0 · informal salaried −0.05 · self-employed −0.05 · daily wage −0.10 | A lender discounts a variable income twice: once on recognition, again on how much of it may be committed. | My judgement |
| AFF-03 | Floor under the adjusted FOIR | 30% | Below this the product stops being worth arranging for anybody. | My judgement |
| AFF-04 | Where existing obligations sit | Inside the cap: `foir × income − existing obligations` | Outside the cap they would be double-counted against income that was already discounted. | Industry practice — NEEDS VERIFICATION |
| AFF-05 | Residual income floor, after rent and EMI | metro ₹9,500 + ₹3,000 per dependant · tier 2 ₹7,500 + ₹2,500 · tier 3 ₹6,000 + ₹2,000 · rural ₹5,000 + ₹1,750 | The residual-income test from mortgage underwriting, and the reason a percentage cap alone is not enough: 50% of ₹26,000 leaves a metro household of two below what it costs them to eat. Stated net of rent only and never stacked on top of a separate expense estimate — AFF-09 takes whichever test binds rather than subtracting both. | My judgement — NEEDS VERIFICATION |
| AFF-06 | Emergency buffer target | 3 months of outflow · 6 if income is volatile · 1 if the purpose is an emergency | A bad month for a daily-wage earner is not a smaller version of a bad month for a salaried one. The emergency case relaxes because the emergency is why the buffer is already gone. | My judgement |
| AFF-07 | Buffer rebuild horizon | 12 months | A year is long enough to be achievable and short enough to matter. | My judgement |
| AFF-08 | Cap on buffer rebuilding as a share of pre-EMI surplus | 20% | Without it, a borrower with no savings is told to save their entire surplus and can never borrow anything — which is not advice, it is a refusal wearing a spreadsheet. | My judgement |
| AFF-09 | Safe carry method | The lower of the budget limit and the residual limit | Two different ways of being unaffordable. Either one binding is enough. | My judgement |
| AFF-10 | Negative safe carry | Reported as zero | A negative number here means "nothing fits", which is a verdict, not a quantity. |  My judgement |
| AFF-11 | Informal debt service | Subtracted before anything new is taken on | Money going to a local lender at 3% a month is the most senior claim on the household, whatever the paperwork says. | My judgement |
| AFF-12 | Buffer rebuilding | Treated as a fixed obligation | If it is optional it will not happen. | My judgement |
| AFF-13 | Stress inside safe carry | No — stress is a separate pass/fail (STR-05) | Applying the income drop inside safe carry as well as in the stress test would charge the borrower for the same risk twice, and for a thin-margin household it drives every answer to zero. | My judgement |
| AFF-14 | Independence invariant | Neither affordability rule may read the other's output | Enforced by review, not by the compiler. If safe carry ever becomes "FOIR times something", this file has lost the only idea in it worth having. | Design constraint |
| AFF-15 | Which number the borrower should use | The lower of the two, with a reason naming the term that bound | The brief asks the tool to say which figure to go by, so it is computed rather than written as interface copy. A borrower cannot spend eligibility they cannot service. The reason must name the rent, the dependants, the obligations or the buffer — "your safe limit is lower" tells them nothing they can act on. | Design decision |
| AFF-16 | A known lump in the next 12 months | Spread across the year, safety side only | A borrower who knows about a wedding, a school fee or a roof repair has told us something a payslip never will. It never touches the lender view: no underwriter asks, so pretending they do would misrepresent what they will actually be offered. | My judgement |
| AFF-17 | The product ceiling binds *after* the uncertainty widening | Cap applied last; said out loud when it binds | **Found in adversarial review.** Capping first and widening after put the band back above the ceiling — telling Ravi he might get ₹6,60,338 on a loan the same run said supports ₹5,81,945. It also hid the point of the output: two figures clipped to one ceiling look identical even when the monthly limits behind them differ by two and a half times. | Correctness |

## PRD — Products

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| PRD-00 | Products deliberately absent | No gold loan, no home loan | None of the three borrowers needs one and the brief says breadth beyond their needs is not scored. `ProductType` still carries `gold` because it is part of the answer vocabulary; `SupportedProduct` is what the engine prices, and the compiler enforces the difference rather than leaving a silent hole. | Brief |
| PRD-01 | Personal loan | 10.5%–24% p.a. fixed · 12–60 months · fee 1%–3% + GST · ₹25,000–₹25,00,000 · min recognised income ₹15,000/month | Unsecured, fastest, dearest of the bank products. Floor is bank pricing for a prime file; ceiling is where NBFC pricing stops being worth taking. | Market observation — NEEDS VERIFICATION |
| PRD-02 | Loan against property | 9%–15% p.a. floating · 60–180 months · LTV 50%–70% · fee 0.5%–2% + GST · plus ₹5,000–₹15,000 legal and valuation · ₹3,00,000–₹5,00,00,000 · min recognised income ₹20,000/month | Cheapest and largest, and the only product here where default costs the borrower the roof or the shop. Preconditions: unencumbered, clear marketable title, completed approved construction, not agricultural land. | Market observation — NEEDS VERIFICATION |
| PRD-03 | Unsecured business loan | 14%–26% p.a. fixed · 12–48 months · fee 1%–3% + GST · ₹50,000–₹50,00,000 · min recognised income ₹25,000/month · **trading history ≥ 24 months** (`minTradingHistoryMonths`, read by the engine rather than restated in it) | What a shopkeeper is usually offered, and usually the wrong answer if they own their premises (RTE-05). | Market observation — NEEDS VERIFICATION |
| PRD-04 | Two-wheeler, electric | 9.5%–22% p.a. fixed · 12–48 months · LTV 80%–90% · fee 1%–2% + GST · ₹30,000–₹3,00,000 · min recognised income ₹10,000/month | Secured by a depreciating asset, so tenure is held short by PRD-06 rather than by age. | Market observation — NEEDS VERIFICATION |
| PRD-05 | LAP LTV by what is pledged | residential 60%–70% · commercial 50%–60% | A shop is slower to sell than a house and its valuation is softer. Ravi's premises are commercial. | Industry practice — NEEDS VERIFICATION |
| PRD-06 | Tenure must not outlive the asset | Two-wheeler EV capped at 48 months | Financing an electric two-wheeler over five years puts the borrower in negative equity around the point the battery needs replacing. | My judgement |
| PRD-07 | GST on lender fees | 18%, on the processing fee and on other charges | Part of the cost of the loan whatever the sanction letter calls it. Feeds APR-01. | Statutory rate — NEEDS VERIFICATION |
| PRD-08 | Lender-type spread, in points added to the product floor | PSU bank 0–1.5 · private bank 0.5–3.0 · NBFC 2.0–6.0 · fintech 4.0–10.0 | The same borrower with the same file is priced differently by a public sector bank and a fintech, and a borrower who does not know that takes the first offer. The market-wide band is the union of these, used when no lender is named. | My judgement — NEEDS VERIFICATION |

## CRD — Credit

The idea that matters here: **an unknown score is not a bad score and it is not
an average score. It is a distribution.** A tool that quietly substitutes 650
for "I don't know" is inventing a fact about the borrower and will be wrong in
both directions — it talks a prime borrower out of a rate they could have got,
and it lets a subprime borrower believe a number nobody will offer them.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| CRD-01 | Prime plus, 780+ | +0 to +0.75 points over the product floor | Priced at or near the floor, with room to negotiate. | Market observation — NEEDS VERIFICATION |
| CRD-02 | Prime, 750–779 | +0.75 to +2.00 | Bank pricing available across products. | Market observation — NEEDS VERIFICATION |
| CRD-03 | Near prime, 700–749 | +2.00 to +4.50 | Approved by most lenders, priced above the best on offer. | Market observation — NEEDS VERIFICATION |
| CRD-04 | Subprime, 650–699 | +4.50 to +8.00 | Banks may decline unsecured; NBFC pricing likely. | Market observation — NEEDS VERIFICATION |
| CRD-05 | Deep subprime, 600–649 | +8.00 to +12.00, unsecured closed | Secured routes only. Unsecured pricing at this level rarely clears the safety test anyway, so offering it would be offering something that fails. | My judgement |
| CRD-06 | Below 600 | +12.00 to +18.00, unsecured closed | Formal unsecured credit is not realistically available. Repair first. | My judgement |
| CRD-07 | No file, confirmed new to credit | +3.00 to +9.00 | Narrower than unknown, because "I checked and there is no file" is itself information. Priced on income and stability rather than history. | My judgement |
| CRD-08 | **Unknown** | +0 to +12.00 — the union of every scored tier, flagged `isDistribution` | Not a value. The band spans every tier because nothing has been measured, and its width is the message: it is wide because you have not looked, and looking is free. | Design decision |
| CRD-09 | Why the unknown band is not population-weighted | Deliberately unweighted | Weighting it would mean inventing a distribution of Indian bureau scores I cannot source and dressing a guess as arithmetic. | Honest limit |
| CRD-10 | One bounce in 12 months | +1.00 point, 6 clean months to clear | More current than a score that refreshes monthly, and fixable on a known timetable — which makes it an action rather than a verdict. | My judgement |
| CRD-11 | Two to three bounces in 12 months | +2.50 points, 6 clean months | Still fundable, priced for it. | My judgement |
| CRD-12 | Four or more bounces, or currently overdue | Hard stop on new unsecured, 6 clean months | Nothing new until the existing account is regular. This is the one blocker where no other action moves the answer. | My judgement |
| CRD-13 | Settled or written off | +4.00 points, 24 months from settlement, unsecured closed | A settlement is a loss the next lender can see and will price. | My judgement |
| CRD-14 | What a clean month means | A calendar month with no bounced instrument and no account moving into overdue, counted consecutively from the last such event | So that "six clean months" is a date the borrower can put in a calendar rather than a figure of speech. | Definition |
| CRD-15 | Unstated bounces when a score is present | Assumed none | The one place a zero default sits on the borrower's side, allowed because it does not flatter anybody: a bureau score already prices delinquency, so assuming bounces on top would charge the borrower twice for the same event. With no score, the unknown tier is already carrying it. | My judgement |

## AGE — Age at maturity, and the tenure it caps

Age is not a scoring input. It binds one thing — how long the loan may run —
and tenure then caps the amount that fits under any EMI ceiling. So it reaches
the headline number by a chain: **age → tenure → maximum amount.**

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| AGE-01 | Maximum age at final instalment, by income type | formal salaried 60 · informal salaried 58 · self-employed (both) 65 · daily wage 58 | Salaried borrowers are held to a retirement date because the income stops on it. Nothing forces a shopkeeper to stop at 60. Informal and daily-wage work is capped earlier than formal employment: the work is physical, there is no pension behind it, and earning capacity falls before the calendar says it should. | Industry practice — NEEDS VERIFICATION |
| AGE-02 | Product adjustment | LAP +5 years, others 0 | A secured long-tenure product is underwritten against the asset as much as the earner. | Industry practice — NEEDS VERIFICATION |
| AGE-03 | Minimum entry age | 21 | Below this formal credit is not realistically available. | Industry practice — NEEDS VERIFICATION |
| AGE-04 | How the cap applies | `maxTenure = min(product max, (max age at maturity − age) × 12)`; if that falls below the product minimum, the product is unavailable rather than offered at a tenure no lender would write | Tenure caps the amount, so this flows through to the maximum-amount output rather than sitting unused. | Arithmetic |
| AGE-05 | Younger co-applicant | May carry the maturity date | The loan can be serviced from their income after the main applicant stops earning. This is the standard route to a longer tenure for an older borrower, and it is an action (ACT-11), not a loophole. | Industry practice — NEEDS VERIFICATION |

**Where this actually binds — and where it does not.** With the numbers above,
a self-employed applicant aged 42 taking a 15-year LAP is not constrained by
age: 42 + 15 = 57, well inside the 70-year maturity ceiling. The cap starts
binding on LAP above age 55, and on a five-year personal loan above 53 for
informal-salaried and daily-wage applicants. I have left it that way rather
than tightening a maturity age to make the constraint fire on a borrower it
does not actually fire on. The mechanism is wired end to end and does bind for
older applicants; for a 42-year-old, the honest answer is that the product
tenure cap binds first.

## PUR — Purpose

Purpose is what makes a wedding loan and a delivery-scooter loan reach
different verdicts at identical income, identical EMI and identical stress. The
scooter earns; the wedding does not. Left to fall out of the FOIR arithmetic it
would never happen, because FOIR cannot see the difference.

| ID | Purpose | Rules | Why | Source |
|---|---|---|---|---|
| PUR-01 | consumption | No income offset · residual floor × 1.10 · no extra rate tolerance | A wedding does not repay a loan. The floor is held 10% higher because the borrower takes on the obligation and gets no new earning capacity in exchange. | My judgement |
| PUR-02 | productive | Offset allowed: 0.50 of earning already happening, 0.25 of earning still forecast · 0 in the stress case · rate tolerance +1.5 points | Half, because a stated earning is not a verified one. A quarter for a forecast, because it is a plan. None under stress, which is what "survives the stress case" has to mean if it means anything. Rate tolerance widens because a loan that earns can bear a dearer rate. | My judgement |
| PUR-03 | refinance | Judged on the change in blended cost, not on new debt · new-debt tests skipped when outflow does not rise | Refinancing is not borrowing more. Testing it as though it were is how a borrower gets told they cannot afford to make their situation cheaper. | My judgement |
| PUR-04 | emergency | Buffer requirement drops to 1 month · rate tolerance +3.0 points · **safe-carry EMI test not relaxed** | The buffer rule relaxes because the emergency is why the buffer is gone, and speed has real value at a hospital counter. The affordability test does not relax: the bill does not make the repayment affordable, and this is exactly where a borrower gets talked into something ruinous. | My judgement |
| PUR-05 | asset_purchase | The asset may serve as security, changing the product set | Usually opens a cheaper product than the one the borrower came in asking for. | My judgement |
| PUR-06 | productive + asset purchase | Takes the productive income rules and the asset-purchase routing | The delivery scooter is both. Purpose is single-valued in the answers, so this records which combination is legitimate rather than making the borrower choose. | My judgement |

## REF — Refinance and consolidation

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| REF-01 | High-cost debt threshold | 24% p.a. all-in | Where formal alternatives clearly win. Card revolving balances and informal lending sit well above; bank and NBFC term credit sits below. A threshold, not a cliff — the size of the gap drives REF-07, not crossing the line. | My judgement |
| REF-02 | Monthly rates to annual | Compound, never multiply: `((1 + m/100)^12 − 1) × 100` | 3% a month is 42.6% a year, not 36%. The naive multiplication understates the cost of exactly the debt this section exists to find. | Arithmetic |
| REF-03 | Blended cost of debt | Outstanding-weighted average of effective annual rates | Weighting by balance rather than by count stops a small cheap loan from disguising a large expensive one. | Arithmetic |
| REF-04 | What switching costs | Foreclosure fee on outstanding + new processing fee + GST on both + new-loan other charges | A saving quoted without the cost of getting it is not a saving. | My judgement |
| REF-05 | Assumed foreclosure fee when unknown | floating 0% · fixed 4% | Floating-rate term loans to individual borrowers are not supposed to carry foreclosure charges, so zero there is the rule rather than a flattering guess. Fixed-rate loans do carry them and the assumption sits at the top of the usual range. | Regulatory principle — NEEDS VERIFICATION |
| REF-06 | Break-even | Switching cost ÷ monthly saving | Arithmetic. | Arithmetic |
| REF-07 | When a switch is worth making | Blended rate falls ≥ 2.00 points **and** break-even ≤ 12 months **and** ≤ 30% of remaining tenure | The rate test stops churn for a saving the next fee eats. The break-even tests stop a switch that only pays back after the loan was going to end anyway. | My judgement |
| REF-08 | Saving exists but break-even fails | Recommend renegotiating with the existing lender | Not "stay". Taking a competing quote back to the current lender costs nothing and has no break-even. | My judgement |
| REF-09 | Restructuring as a first-class outcome | When the verdict is `do_not_borrow` and a refinance candidate exists, the refinance result is what the app leads with | Telling a borrower paying 42% a year that they cannot afford a new loan, without mentioning the 42%, is a technically correct answer to the wrong question. | Design decision |
| REF-10 | Assumed cost of a revolving card balance | 42% p.a. when the borrower has not stated it | Issuers publish monthly rates around 3.5% and the balance revolves, so the compounded annual cost lands in the low forties. Well above REF-01, which is the point: a revolving balance is refinance-first debt. | Market observation — NEEDS VERIFICATION |
| REF-11 | Informal debt repayment shape | Assumed interest-only unless a schedule is stated | This is how it usually works: the monthly payment services the interest and the principal sits there indefinitely. It changes the honest question from "which monthly payment is smaller" — refinancing often costs *more* per month — to "which one ever ends". ₹80,000 at 3% a month is ₹2,400 a month forever, still owing ₹80,000. | My judgement |
| REF-12 | How the comparison is scored | Cumulative cost over the new loan's tenure, counting principal still outstanding at the end as a cost of staying; break-even found by walking the two cumulative paths, not by division | REF-06's division breaks down when the monthly saving is negative but the total saving is large, which is exactly the informal-debt case this section exists for. | Arithmetic |
| REF-13 | Only consolidation-capable products may be a refinance target | personal · LAP · business unsecured | A vehicle loan cannot pay off a moneylender — the money can only buy the vehicle. Without this the engine routes a consolidation to whatever ranks first and quotes a saving the borrower could never realise. Found when a persona's income fell below the personal-loan floor. | My judgement |
| REF-14 | Consolidation term, and the assumed term on an unknown existing loan | written over at most 36 months · existing loan assumed to have 60 months left | Stretching expensive debt over a long term makes the monthly figure look good and the total worse, which is the trap the borrower is already in. The assumed remaining term used to sit in the engine as a bare `?? 60` — a real assumption about an unknown, made silently. It now lives here and emits a Reason. | My judgement |

## VRD — Verdict

Two loads, each an EMI over a ceiling: `safetyLoad = requestedEmi / safeCarry`
and `eligibilityLoad = requestedEmi / lenderCeiling`. Both must clear 1.0. They
fail for different reasons and produce different advice, which is why they are
never merged into one score.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| VRD-01 | Cutoffs | Both loads ≤ 1.00, no tolerance band | Held at exactly 1.0. A 5% indulgence would quietly become the product's real answer, and it would always be spent in the borrower's disfavour. | Design decision |
| VRD-02 | `borrow_less` rather than `do_not_borrow` | Whenever some smaller amount clears both tests | The smallest amount worth arranging is the product's minimum ticket, so that is the test. | My judgement |
| VRD-03 | Minimum viable EMI | Derived: the EMI on the product's minimum ticket, at the longest tenure available after the age cap, at the midpoint of the borrower's own rate band | Derived rather than stored, so a change to any input moves it too. | Arithmetic |
| VRD-04 | Hard fails | Currently overdue · no recognisable income for any product · below minimum entry age · safe carry below the minimum viable EMI for every product | Arithmetic cannot rescue these. Each still has to produce actions (ACT-15). | My judgement |
| VRD-05 | Failing the stress test | Demotes the verdict one step | A loan that works today and breaks under a 20% income drop is a smaller loan, not no loan. | My judgement |
| VRD-06 | Ceiling on the productive offset | May lift `borrow_less` to `borrow`; may **never** lift `do_not_borrow` | A household that cannot service the loan from what it has now is betting the shop on a forecast. Since the stress case recognises none of the offset, a loan that only works with it never reaches `borrow`. | Design decision |
| VRD-07 | Evidence required for a productive offset | Stated incremental earning per month · stated earning days per month · stated whether already earning or projected | Unstated means no offset. The engine will not infer earning from the purpose alone. | My judgement |
| VRD-08 | Coverage required | Incremental earning ≥ 1.25 × EMI | An asset that earns exactly its own instalment leaves the borrower working for the lender and carrying all the risk of a slow month. | My judgement |
| VRD-09 | `borrow_less` output | Must name the amount that does pass | Not allowed to be a number-free disappointment. | Design decision |
| VRD-10 | Floor under the stress demotion | Stress may take borrow to borrow_less; it may take borrow_less to do_not_borrow only when safe carry cannot service the minimum ticket | Without this floor VRD-05 contradicts its own justification: it says a loan that breaks under stress is "a smaller loan, not no loan", then demotes to do_not_borrow every borrower whose recommended amount already sits at their safe-carry ceiling — which is precisely no loan. The sizing absorbs the stress, not the verdict. Found by running the personas: two of the three hit it. | Design decision |

## DEF — Defaults for the unanswered

Widening and defaulting are different jobs. Widening says how much less certain
we are; **a default says what number the engine actually computes with in the
meantime.** Three rules govern every entry:

1. Conservative in the borrower's favour on safety. An unstated cost is assumed to exist.
2. Neutral to pessimistic on eligibility. An unstated fact never makes the borrower look richer.
3. Never silent. Every default that fires produces a Reason the borrower reads, naming the number and inviting them to correct it.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| DEF-01 | Household expenses, excluding rent | metro ₹9,000 + ₹3,500/dependant · tier 2 ₹7,000 + ₹3,000 · tier 3 ₹5,500 + ₹2,500 · rural ₹4,500 + ₹2,000 | Excludes rent (DEF-02) so a borrower who owns their home is not charged for it twice. | My judgement — NEEDS VERIFICATION |
| DEF-02 | Rent | metro ₹8,000 · tier 2 ₹5,000 · tier 3 ₹3,500 · rural ₹2,000 · zero only where property is owned | Zero where the borrower has told us they own, which is the one case where zero is a fact rather than a flattering guess. | My judgement — NEEDS VERIFICATION |
| DEF-03 | Existing obligations | 5% of safety-view income | Zero is banned here: somebody who has come looking for borrowing advice usually carries something, and an unstated EMI is the fastest way to make a borrower look more affordable than they are. Taken against the safety view because what a household owes is a fact about the household — it does not change with how much of their income somebody will document. 5% is small enough not to insult a borrower who has none, and it is the first thing a live demo should change to show the numbers move. | My judgement |
| DEF-21 | Silence | Every default that fires emits a Reason | "We assumed household spending of about ₹12,500 a month because you haven't told us yet. Tell us the real figure and this number moves either way." | Design constraint |
| DEF-22 | Zero as a default | Banned wherever it flatters. Allowed in exactly four places: savings buffer · bounces when a bureau score is known · rent when property is owned · foreclosure fee on floating-rate individual loans | Each of the four is either a fact or works against the borrower's own case. | Design constraint |
| DEF-23 | An explicit "no" answers the question behind it | cards → balance · co-applicant → their income | A borrower who says they have no cards has told us the balance is nothing. Treating that as unanswered would leave an assumption on the books they have already cleared up. Note the gated question stays on everyone's path: hiding it behind the gate would make answering the gate *widen* the band, since a non-applicable field becomes an unanswered one. | Design constraint |
| DEF-24 | Assumed income proof, from how they earn | formal salaried → payslips · everyone else → bank statements, nothing stronger | Defaulting proof to "nothing" made the must-set produce no answer at all — no recognised income, no eligible product, all four outputs zero. That is not conservatism, it is uselessness, and it broke the rule that the opening questions alone must produce a complete assessment. Assuming the weaker end means confirming a stronger document always improves the answer and never worsens it. | My judgement |
| DEF-25 | Amount above which collateral is worth asking about | ₹5,00,000 | For a borrower who has not named a secured product and does not run a business. Below it, unsecured lending reaches far enough that asking what their home is worth is an intrusion that buys nothing. | My judgement |

**Field defaults (DEF-04 to DEF-20).** Full text of each borrower-facing Reason
is in the config.

| Field | Default | Direction |
|---|---|---|
| `householdExpensesMonthly` | derived from DEF-01 | conservative on safety |
| `rentMonthly` | derived from DEF-02 | conservative on safety |
| `existingEmiMonthly` | derived from DEF-03 | conservative on safety |
| `savingsBuffer` | ₹0 | conservative on safety |
| `dependents` | 2 | conservative on safety |
| `cityTier` | metro (most expensive) | conservative on safety |
| `loanPurpose` | consumption (strictest) | conservative on safety |
| `incomeStability` | volatile | conservative on safety |
| `quotedProcessingFee` | product fee ceiling | conservative on safety |
| `creditScore` | **no default** — CRD-08 unknown band | distribution, not a value |
| `informalDebtOutstanding` | **no default** | distribution, not a value |
| `employmentType` | **no default** — must be asked | changes too much to assume |
| `incomeProof` | none | neutral to pessimistic on eligibility |
| `repaymentHistory` | none, not clean | neutral to pessimistic on eligibility |
| `hasCoApplicant` | false | neutral to pessimistic on eligibility |
| `propertyTitleClear` | false | neutral to pessimistic on eligibility |
| `age` | 45 | neutral to pessimistic on eligibility |
| `timeInCurrentWork` | 12 months | neutral to pessimistic on eligibility |
| `requestedTenure` | longest available after the age cap | neutral — lowest EMI, highest total interest, both shown |

## APR — All-in cost

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| APR-01 | Method | IRR over actual cash flows: borrower receives `principal − fee − GST(fee) − other − GST(other)` at t=0 and pays the EMI for n months; solve the monthly rate, then compound to annual | Adding the fee percentage to the interest rate — the common shortcut — understates a short-tenure loan badly, because the fee is paid once but earned back over however long the loan runs. | Arithmetic |
| APR-02 | EMI | Reducing balance, monthly rest | Standard amortisation. | Arithmetic |
| APR-03 | Flat-rate quotes | Converted before comparison | A flat 10% over three years is close to 18% reducing balance, and flat quoting is common at exactly the end of the market this tool is for. | Arithmetic |
| APR-04 | Bundled credit insurance | Excluded, and the exclusion is stated | Premiums are not published in a form I can source, and inventing one would put a number in the borrower's APR I cannot defend. | Honest limit |
| APR-05 | Solver | Bisection, tolerance 0.0001 points, 200 iterations, search 0%–500% | Engine parameters, not lending judgements. They live in the config only so every number has one home. | Engine parameter |

## STR — Stress

One bad year, not a catastrophe. Chosen to be things that actually happen to
these households.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| STR-01 | Income drop | stable 20% · seasonal 30% · volatile 30% | A bad month for a daily-wage earner is not a smaller version of a bad month for a salaried one. | My judgement |
| STR-02 | Rate rise | +2.00 points, **floating-rate products only** | A fixed-rate personal loan does not reprice. Pretending it does would overstate the risk of the dearer product and flatter the cheaper one — the opposite of the truth. | My judgement |
| STR-03 | Expense inflation | 6% over the stressed year | My judgement | My judgement — NEEDS VERIFICATION |
| STR-04 | Liquidity test | One month of EMI + expenses + rent coverable from savings | Solvency over a year and survival next month are different questions. | My judgement |
| STR-05 | Pass criterion | Stressed EMI within stressed safe carry, and liquidity holds. Failing either demotes one step | | Design decision |

## ACT — Actionability

The brief asks that every borrower leaves with something they could act on
tomorrow. That is encoded as rules rather than written as copy, so an action
cannot be attached to a constraint the borrower does not have.

**Every action states what it changes, not just what to do.** "Get your credit
score" is a chore. "Get your credit score — it's free, and it would narrow your
rate range from twelve points wide to about two" is a reason to get out of the
chair.

| ID | Constraint | Action → what it changes | Timeframe |
|---|---|---|---|
| ACT-01 | Credit score unknown | Check it free on any bureau site → narrows a ~12-point rate range to about 2 | today |
| ACT-02 | Income undocumented | Six months of bank statements → moves cash income from nothing counted to half counted, roughly doubling the amount a lender will consider | weeks |
| ACT-03 | No ITR filed | File last year's return, even at nil tax → recognition from 0.50 to 0.80, and bank pricing instead of NBFC pricing | weeks |
| ACT-04 | Recent bounce | Six clean months on a standing instruction → removes the rate penalty, reopens bank products | months |
| ACT-05 | Currently overdue | Bring the account regular → the one thing blocking everything; nothing else moves the answer until it clears | weeks |
| ACT-06 | No co-applicant counted | Add an earning household member → their income joins yours, and their obligations too | weeks |
| ACT-07 | Property title unconfirmed | Find the deed and a current EC → opens LAP at 9–15% instead of unsecured at 14–26% | weeks |
| ACT-08 | High-cost debt present | Deal with the expensive borrowing first → cuts blended cost and frees monthly money, worth more than the loan they came for | weeks |
| ACT-09 | Expenses unstated | Tell us the real figure → replaces our assumption, moves the safe limit either way | today |
| ACT-10 | Buffer short | Put aside one month of expenses → the difference between a bad month being awkward and becoming a default | months |
| ACT-11 | Tenure capped by age | Add a younger earning co-applicant → loan can run past your retirement date, lowering the EMI | weeks |
| ACT-12 | Amount above safe carry | Ask for the smaller amount and stage the rest → turns a loan that breaks in a bad month into one that survives it | today |
| ACT-13 | Product demoted by credit | Look at a secured product → priced on the asset rather than on your record | weeks |
| ACT-14 | Thin work history | Wait for 12 months in current work → applying now risks a rejection the next lender can see | months |
| ACT-15 | **Minimum actions by verdict** | borrow 1 · borrow_less 2 · **do_not_borrow 2** | A `do_not_borrow` with no path is the failure this product exists to fix. Being told no is survivable; being told no with nothing to do about it is what sends somebody to the lender down the road at 3% a month. |
| ACT-16 | Always-available actions | credit score · expenses · co-applicant · smaller amount | Used to meet the ACT-15 floor when the borrower's own constraints do not generate enough. |
| ACT-17 | Actions with no stated effect | Not shipped | |

## RTE — Stated product versus routed product

A borrower arrives saying "I want a business loan". Often the right answer is a
different product, and the tool has to be able to say so — **but never
quietly.** Rerouting without showing the comparison is how intermediaries make
money, and it is the behaviour this tool exists in opposition to.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| RTE-01 | Routing may override a stated preference | Yes | Otherwise the tool just validates whatever the borrower was already sold. | Design decision |
| RTE-02 | Trigger | Rate saving ≥ 3.00 points **or** amount uplift ≥ 1.25× | Either alone is enough, but the gain has to be large enough to be worth the borrower changing their mind. | My judgement |
| RTE-03 | Required comparison | Rate difference in points per year · amount difference in rupees · what the borrower gives up | All three, in their own numbers, not in general terms. | Design constraint |
| RTE-04 | The stated product | Stays on screen with its own numbers | The borrower can check the comparison rather than take it on trust. | Design constraint |
| RTE-05 | What they give up, per route | e.g. unsecured business → LAP: *"Your premises become the security. The rate is far lower and the amount far higher, but if this loan goes wrong you can lose the shop, and that is a slower, harder failure than a missed instalment on an unsecured loan."* | Written to be read aloud to somebody about to sign, not to satisfy a compliance checkbox. | Design constraint |
| RTE-06 | Silent rerouting | Never, under any circumstances | | Design constraint |

## WID — Band widening

A band's width is computed from what the borrower has *not* told us, never
assigned. With only the opening questions answered every band should be
visibly wide; each further answer removes its own contribution and the band
tightens. A factor is a fraction of the band's own centre, added to each side,
and they are additive.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| WID-01 | Widening factor per unanswered field, per output | e.g. on `maxAmount`: income proof 0.15, employment 0.15, household spending 0.12, existing EMIs 0.10, rent 0.08, ITR 0.08, informal debt 0.07, property 0.06, dependants 0.05, co-applicant 0.05, savings 0.05, city tier 0.04. On `emiCeiling` the household terms dominate; on `fairRate` the fee and tenure terms do | Relative judgements rather than measurements. What matters is the ordering: household spending moves the affordability numbers more than the number of dependants does, and income documentation moves the lender numbers most of all. | My judgement |
| WID-02 | Fields exempt from widening | credit score · credit history · lender type — **and any field whose question does not apply to this borrower** | These already carry their own distribution elsewhere — CRD-08 prices an unknown score as the union of every tier, PRD-08 spans lender types market-wide. A widening factor on top would charge the borrower twice for one missing fact. The list exists so that an exemption reads as a decision rather than an oversight. Widening is also scoped to the question graph: a salaried borrower's band is never widened for an ITR question they would never be asked, because that is a band that could never close. | Design constraint |
| WID-03 | Cap on total widening | 0.90 of the centre | Past this the low end collapses to nothing and the high end is fantasy. The honest message stops being a wider number and becomes "we cannot tell you yet", which the confidence label carries. | My judgement |
| WID-04 | Widened bands floor at zero | Yes | Money and rates stop at nothing; a negative low end is arithmetic escaping into nonsense. | Arithmetic |
| WID-05 | Minimum scale the widening works from | 0.15 of monthly income | Proportional widening breaks down when the centre is at or near zero: a safe carry that has floored at nothing would come out as a band of zero width, and *"you can afford nothing"* would be reported as the most certain answer in the system. It is the least certain — it is the answer most sensitive to the assumptions underneath it. Found by running the compare test on a borrower whose safe carry floored. | My judgement |

## CONF — Confidence

Confidence is not a separate judgement about the borrower. It is a reading of
how wide the band came out, so the label and the number cannot disagree — a
"high confidence" answer spanning a factor of three is exactly what this rule
exists to prevent.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| CONF-01 | Relative width | `(high − low) / midpoint` | Dimensionless, so one set of thresholds works for a rupee amount and for a percentage rate. | Arithmetic |
| CONF-02 | Confidence from relative width | ≤ 0.20 high · ≤ 0.55 medium · above that low | A quarter-wide band is a useful answer. Past about half, the borrower should be told plainly that we are guessing. | My judgement |
| CONF-03 | Verdict confidence | The weakest of `maxAmount` and `emiCeiling` | The verdict has no band of its own, and it cannot be more certain than the arithmetic underneath it. | Design decision |
| CONF-04 | Confidence is never set by hand | Enforced by having one function produce it | A module that wants to express doubt must widen a band, which the borrower can see, rather than quietly downgrading a label they cannot check. Before this rule, three modules each had their own rule of thumb wearing the same word. | Design constraint |

## NAR — What would narrow this

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| NAR-01 | Suggestions per output | 4 | More than a handful stops being a prompt and becomes a form. | My judgement |
| NAR-02 | Ranking weight for the WID-02 exemptions | credit score 0.5 on `fairRate`, 0.2 on `maxAmount` · lender type 0.3 on `fairRate` | They still belong in `wouldNarrow` — checking a score is usually the most useful thing a borrower can do — but their impact is not in the widening table, so it is stated here for ordering only. | My judgement |
| NAR-03 | Answered fields never appear | Excluded | The list is what to do next, not a list of what mattered. | Design constraint |
| NAR-04 | Weight added when a field is already in an output's live `wouldNarrow` | +0.25 | The static table says what a field is worth in general; the live result says what it is worth to this borrower now. This tips the ordering towards the second without discarding the first. | My judgement |
| NAR-05 | How narrow a rate range becomes once a score is known | 2.5 percentage points | The width of a single scored tier's spread — what checking actually buys. ACT-01 quotes this figure to the borrower, and it was hardcoded in the engine, so a number somebody reads could not be changed without editing code. | My judgement |

## ASR — Assertions

Two failure modes are treated as bugs rather than as states the engine may be
in. Both are silent, and both are the exact thing this product exists not to
do. **Both are negative-tested** — breaking each one on purpose produces the
throw.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| ASR-01 | No unanswered field may be coerced to zero unless DEF-* permits it | Throws | Zero is the most dangerous default in lending arithmetic: zero expenses, zero existing EMIs and zero informal debt all make a borrower look richer than they are, and none of them is visible in the output. | Design constraint |
| ASR-02 | Where zero *is* permitted, and why it does not flatter | savings · rent when the borrower owns · bounces when a bureau score exists · informal debt, card balance and other loans (assuming one exists would be inventing it — the uncertainty is carried by WID-01 instead) · incremental earning · co-applicant income · down payment | Each entry has to state the reason it works against the borrower's case or is a fact rather than a guess. | Design constraint |
| ASR-03 | Every applied default must reach the borrower as a Reason | Throws | Checked against the finished output rather than against intent: if a default fired and no Reason naming it survives into what the interface shows, it was computed with and then dropped. A silent assumption is the kind that only surfaces when somebody asks where a number came from. | Design constraint |

## PRV — What is kept, and where

The brief says no personal data is stored. **Our reading, recorded here rather
than left implicit in a component:** that is about a server holding somebody's
finances, not about a browser remembering what they typed two minutes ago.
This was one of the day-one questions to Lokta; if the answer comes back that
even local storage is out of scope, PRV-01 is the only thing that changes.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| PRV-01 | Answers are kept in the browser's own storage, on the borrower's device | Yes | Losing a part-finished assessment to an accidental refresh would be its own small cruelty, and it would fall hardest on somebody filling this in on a phone between jobs. The data never leaves the device — there is no account, no server and no analytics, so there is nowhere for it to go even by mistake. | Design decision |
| PRV-02 | Clearing is one visible control, on every screen | Always visible | Not buried in settings. Somebody who has just typed their household income into a borrowed phone should be able to see how to remove it without hunting. | Design decision |
| PRV-03 | No network calls at runtime | None, of any kind | Not for rates, not for scores, not for telemetry. Everything the app knows is in the rules file and in what the borrower typed. | Design constraint |

---

## Copy standards

Scored under product craft, so treated as a spec rather than as taste.

- **No trade vocabulary on screen.** Not FOIR, not LTV, not tenor, not
  sanction, not disbursal, not encumbered. Those words appear in this document
  and in the code, and never in front of a borrower. A scanner over every
  string literal that can reach the screen enforces it.
- **The reader is Anita** — a delivery rider who also takes in tailoring. If a
  sentence would not survive her reading it once, on a phone, between jobs, it
  is the wrong sentence.
- **Indian number formatting throughout**, with lakh and crore in words where
  that is how somebody would say it out loud.
- **Nothing that shames.** "Your income doesn't stretch to this right now" is a
  fact about arithmetic. "You cannot afford this" is a verdict on a person, and
  it is also less useful, because it does not say what would change it.
- **Every figure carries its reason**, taken from the engine. No component
  writes explanation copy of its own — if a number has no reason behind it,
  that is a gap in the engine and should be visible as one.

## CARD — The negotiation card

One screen a borrower holds up at a counter, read under pressure with a
salesperson watching. The comparator is the point of it: *"that seems high"* is
an opinion, and *"that is ₹259 a month more than the best rate I should get,
about ₹15,548 over five years"* is a negotiation.

| ID | What | Value | Why | Source |
|---|---|---|---|---|
| CARD-01 | Questions to ask the lender, generated from this borrower's own gaps | 8 in the catalogue, each tied to an unanswered field or always-worth-asking | A gap in our answers is usually a gap the lender is relying on. Each is written to be answerable only with a number or a yes — "is that rate fixed?" cannot be talked around; "tell me about your rates" can. Only fires for questions this borrower would actually be asked, so somebody with no property is never told to ask about a valuation. | My judgement |
| CARD-02 | How many questions | 3 | More than that and nobody asks any of them. | My judgement |
| CARD-03 | Actions carried onto the card | 2 | So the card is worth something even when the answer was "not yet". | My judgement |
| CARD-04 | How a quote is compared | Same amount, same length of loan, total paid plus fees | A rate on its own is not a price. The fee is counted because it comes out of the money before it reaches the borrower — so a lower rate with a bigger fee can be the worse offer, which is exactly the trade a counter is good at hiding. | Arithmetic |
| CARD-05 | When the offer is fair, say so | Plainly | Manufacturing a grievance would be the easiest way to make this feel useful and the fastest way to make it worthless. A borrower told once that an offer is fair will trust the card the next time it says otherwise. | Design decision |
| CARD-06 | When the fair band is too wide to judge against | Above 6 percentage points | A borrower with an unchecked credit score gets a band spanning thirteen points, and almost any quote falls inside it. Calling that "a fair offer" would be the app lending its authority to a number nobody has checked. Instead the card says it cannot judge yet and names the one thing that would settle it. **Found by running the gate** — a 14% quote was being called fair against an 11–24% band. | Design decision |
| CARD-07 | The rupee figure is measured against the *best* fair rate | Band low, not band high | That is the number worth arguing over. Comparing against the top of the band answers "is this outright unfair", which is a lower bar and a weaker position — and for an unchecked score it answers nothing at all. | Design decision |

**Worked example, checked by hand.** Priya, ₹1,69,832 over 5 years, quoted 14%
with a 2% fee:

```
  EMI at the 14% quote            ₹3,952
  EMI at the best fair rate (11%) ₹3,693
  difference                        ₹259 a month
  over 60 months                 ₹15,548
```

Engine and an independent calculation from the amortisation formula agree to
the rupee. Because her credit score has never been checked, the card does *not*
call this unfair — it reports that it cannot judge yet, and shows her what the
gap is worth so she goes and checks.

---

---

## Worked example: the two affordability rules disagree

Illustrative borrower — salaried, metro, states ₹26,000–30,000 a month, ₹8,000
rent, one dependant, consumption purpose. Everything else left unanswered, so
the DEF defaults fire. Computed directly from the config:

```
  underwriting income (midpoint)   ₹28,000     [INC-05]
  safety income (floor)            ₹26,000     [INC-05]
  assumed existing obligations      ₹1,300     [DEF-03]
  assumed household expenses       ₹12,500     [DEF-01]

  LENDER VIEW   FOIR 50%           ₹12,700 / month
  SAFETY VIEW   budget limit        ₹3,360
                residual limit      ₹2,950     [binds]
                safe carry          ₹2,950 / month

  ratio between the two                 4.3x
```

Four and a bit times apart, from the same answers, by two rules that never read
each other. This is the number the product exists to show, and it is why the
maximum-amount output carries two figures rather than one.

Notice also which defaults are doing the work. The ₹12,500 expense assumption
and the ₹1,300 obligation assumption are both guesses, both stated to the
borrower, and both immediately correctable — and correcting either one visibly
moves the safe-carry figure. That is the intended behaviour under questioning,
not a weakness to be hidden.

---

## Honest limits

- **Market numbers are not sourced.** Every rate band, LTV, fee range and
  income threshold in PRD and CRD is my reading of the Indian market, not a
  scrape and not a quote. They are flagged in the Source column and listed in
  [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). I would not put them in front of a
  real borrower without checking them.
- **The unknown-score band is unweighted.** Population-weighting it would mean
  inventing a distribution I cannot source (CRD-09).
- **Bundled insurance is out of the APR** (APR-04), so the APR understates any
  loan sold with credit life attached — which is many of them.
- **Cost-of-living defaults are the weakest numbers here.** DEF-01, DEF-02 and
  AFF-05 drive the safe-carry figure more than anything else, and they are
  judgement calls about households I have not met. They are the right place to
  push if you want to break this model.
- **One-lender modelling.** The engine prices a product, not a specific
  lender's credit policy. Two lenders in the same category will disagree with
  each other more than PRD-08 allows for.
- **Gold and home loans are deliberately absent** (PRD-00).
- **Age caps are wired but do not bind for a 42-year-old on LAP.** Documented
  in the AGE section rather than papered over.
