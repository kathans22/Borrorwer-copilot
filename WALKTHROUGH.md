# Walkthrough

One borrower, followed properly, then what I would do next and what this thing
does not know.

Every figure below is from [RUNTHROUGHS.md](RUNTHROUGHS.md), which is generated
by `npm run runthroughs` from the same engine the application uses. Nothing
here is typed by hand from memory.

---

## Ravi

Shopkeeper, 42. The shop takes between ₹40,000 and ₹80,000 a month depending on
the season. His last return declares ₹4.2 lakh for the year. His wife earns
₹18,000 with nothing on paper. He owns the shop premises outright, worth about
₹40 lakh, and he already pays ₹8,000 a month on a machinery loan.

He came in asking for **₹15,00,000 as an unsecured business loan**.

### The first number that matters is not the one he expects

Two incomes come out of his answers, and they are not close:

```
  what his household actually receives     ₹58,000 a month
  what a lender will count                 ₹35,000 a month
```

The gap is two rules doing their job. **INC-12** says a lender cannot count more
than a borrower has declared: he has told the tax authority ₹4.2 lakh, so
₹35,000 a month is the ceiling however much crosses the counter. And his wife's
₹18,000 counts in full towards what the household can carry and *nothing*
towards what a lender will lend, because there is no paperwork behind it
(**INC-09**) — the app says so in as many words rather than quietly dropping her.

That second number is what everything he will be offered is built on. It is also
the one he can change, which is why "get six months of bank statements" comes
out as his first action.

### Why the loan he asked for was the wrong one

His ₹35,000 recognised income, at a 45% ratio less his existing ₹8,000 payment,
leaves **₹7,750 a month** for a new loan. Run that through each product:

| | Most it supports | All-in cost | Over |
|---|---|---|---|
| Loan against property | ₹5,81,945 | 16.4% | 15 years |
| Personal loan | ₹3,06,838 | 21.4% | 5 years |
| Unsecured business loan | ₹2,49,194 | 26.7% | 4 years |

The product he walked in asking for is the **worst of the three on both axes** —
dearest per year, and smallest by a factor of more than two. So the app
overrides him, and **RTE-03** makes it show the comparison in his own numbers
rather than simply presenting a different answer:

> You asked about an unsecured business loan, but a loan against property is the
> better route: 16.4% all-in against 26.7%, a difference of 10.3% a year, and
> ₹5,81,945 available against ₹2,49,194 — ₹3,32,751 more.

And then, immediately and unprompted, what it costs him:

> Your premises become the security. The rate is far lower and the amount far
> higher, but if this loan goes wrong you can lose the shop, and that is a
> slower, harder failure than a missed instalment on an unsecured loan.

That second paragraph is the one I care about most. An intermediary paid on
volume shows the first and not the second. The rule that forces both
(**RTE-04**, never reroute silently) is the difference between advice and a
sales funnel.

### The answer is still no to ₹15 lakh

**BORROW LESS.** ₹15,00,000 would mean ₹19,976 a month against the ₹7,750 he
has. ₹5,81,945 fits.

He also told us the loan would earn him ₹22,000 a month. It does not rescue the
number, and the app explains why rather than ignoring it:

> The ₹22,000 a month you expect to earn covers the instalment only 1.1 times,
> short of the 1.25 we look for. An asset that earns roughly its own instalment
> leaves you working for the lender and carrying the risk of a slow month.

That is **VRD-08**. An asset that earns exactly its own payment has moved all the
risk of a quiet season onto the borrower and none onto the lender.

### The one place the two numbers invert

For Priya and Anita, the household is the binding constraint — they can be
offered more than they should take. Ravi is the other way round:

> Go by ₹6,60,338. Your household could carry more than a lender will advance
> here, so what you will be offered is the binding constraint rather than what
> you can afford.

His household could service about ₹19,067 a month. A lender will allow ₹7,750.
The thing holding him back is not his budget — it is that ₹23,000 a month of
real income is invisible on paper. Which is exactly what his action list tells
him to fix, with the figure attached.

### What he leaves with

A rate claim he can defend at a counter — 13% to 15%, with the four things
behind it — an all-in figure of 15.2%–17.6% to compare any offer against, three
questions to ask, and a note that on a ₹5,81,945 loan he would actually
*receive* ₹5,47,077 after the fee, tax and valuation charges come out, while
paying interest on the full amount.

---

## What I would build next

**1. Two-borrower households as a first-class idea, not a bolt-on.**
Right now a co-applicant is one extra income with its own paperwork test. In
practice the interesting question is which of two earners should be the primary
applicant — Ravi's wife may have a thinner income but a cleaner credit file, and
that combination changes both the rate and the amount. It needs the engine to
evaluate applicant orderings rather than a fixed primary, which is a real change
and the highest-value one I can see.

**2. A "come back in three months" mode.**
Several actions are dated — six clean months clears a bounce, a filed return
moves recognition from half to most. The app knows the date each one matures and
throws that away. Storing the assessment locally with the dates attached, so it
can say "you are four months from the rate you wanted", turns a one-off tool
into something worth reopening.

**3. Sourced market data behind the product tables.**
The single biggest weakness below. Every rate band and LTV is my reading. Even a
manually-maintained monthly file of published rates by lender type, with the
date it was taken, would move most of this from "plausible" to "checkable".

**4. Take the interview seriously as a feature.**
The rules layer already makes a value editable in one place. What it does not do
is show the borrower the *effect* — "if we assumed ₹12,000 of spending instead
of ₹16,000, here is what changes". The machinery exists; it is a screen.

## What I would cut

**The tenure trade-off table, in its current form.** It is correct and it is
three rows of arithmetic on a screen where somebody is trying to decide one
thing. The single sentence underneath it — a smaller payment always costs more
in total — does most of the work. I would keep the sentence and put the table
behind a tap.

**Two of the four products.** Nothing in the brief needs `two_wheeler_ev` and
`personal` to both exist as separate catalogues; Anita is the only borrower
using the vehicle route, and the routing logic would be simpler and better
tested with fewer, better-verified products. Breadth here cost me verification
depth, and depth is what the numbers needed.

**The `gold` product type.** It survives in the type union from the first
prompt's contract and is excluded everywhere by `SupportedProduct`. It is
honest, but it is a dead branch a reader has to work out is deliberate.

**Some of the widening factors.** Twelve fields widen `maxAmount`. I can defend
the ordering — documentation matters more than dependants — but not each
individual figure, and a smaller set of larger, better-argued factors would be
easier to defend and behave almost identically.

---

## Honest limits

Specific, because vagueness here is worse than admission.

### The market numbers are not sourced

Every rate band, LTV, fee range, tenure ceiling and minimum-income threshold in
the `PRD` and `CRD` sections is **my reading of the Indian market, not a scrape
and not a quote**. They are flagged `NEEDS VERIFICATION` in RULES.md and listed
in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). I would not put them in front of a
real borrower without checking them. If one number in this application is wrong
in a way that matters, it is most likely one of these.

### The cost-of-living defaults are the weakest thing here

`DEF-01` (household spending by city tier), `DEF-02` (rent) and `AFF-05` (the
residual income floor) drive the safe-carry figure more than anything else, and
they are judgement calls about households I have not met. In Priya's run they are
the difference between a ₹6,09,698 answer and a ₹1,69,832 one. **This is where
to push if you want to break the model**, and I would expect to lose that
argument against anyone with real consumption data.

### Rules I invented that a lender would not recognise

Some of the load-bearing logic is mine rather than industry practice, and should
be read as a design position rather than a description of how lending works:

- **INC-12** (recognised income capped at declared income). I believe it, but I
  have not confirmed lenders apply it as a hard cap.
- **AFF-05** (residual income floor). Borrowed from mortgage underwriting and
  applied to unsecured lending, which is not standard.
- **AFF-15 / the whole two-number framing.** No lender computes a "safe carry".
  This is the product's opinion, not the market's.
- **CARD-06** (refusing to judge fairness when the band is too wide). Mine, and
  added only after the gate showed the card calling a 14% quote "fair" against
  an 11–24% band.
- **VRD-10** (stress demotion floors at borrow-less). Added because the original
  rule contradicted its own stated justification for two of three borrowers.

### Things the app cannot see

- **Whether any of this is true.** Every figure is what the borrower typed. There
  is no bureau call, no bank statement parse, no verification of any kind.
- **Bundled insurance.** Excluded from the all-in cost (`APR-04`) because I
  cannot source premiums. Many loans at this end of the market carry it, so the
  all-in figure **understates** the real cost of those loans.
- **Any specific lender's credit policy.** The engine prices a product, not an
  institution. Two lenders in the same category will differ by more than
  `PRD-08` allows for.
- **Regional variation** beyond four city tiers, and **seasonality** beyond a
  single income range.
- **Whether the borrower has already been rejected somewhere**, which changes
  what happens next and is not asked about.

### Where the brief and I disagree

- **Ravi's age does not cap his loan term.** Prompt 3 asked for the age rule to
  bind for him. With defensible retirement ages it does not: at 42, on a 15-year
  product, the product ceiling binds first, and the age cap starts biting above
  55. The mechanism is wired end to end and I showed the table. I did not bend a
  maturity age to make a demo fire.
- **Anita's income is mine, not the brief's.** The brief says ₹26,000–30,000. At
  that level her recognised income falls below the personal-loan floor and the
  refinance route she most needs closes — so the most useful thing the tool has
  to tell her disappears. I left her at ₹27,000–35,000 and flagged it rather than
  quietly lower a threshold or quietly drop the finding.
- **All three personas are reconstructed** from details scattered across the
  brief. Where a figure was not stated, I chose one. They are one file, and each
  is one line to correct.

### Engineering caveats

- **No unit tests in the conventional sense.** There are three executable
  assertions (`--compare`, `--tightens`, and the two ledger assertions that
  throw at runtime), and they caught eleven real defects during the build. But
  there is no test file, and the arithmetic in `money.ts` is verified by hand
  against one worked example rather than by a suite.
- **`computeWithTrace` runs several times per render** — the wizard, the
  ordering and the results screen each call it independently. It is fast enough
  that nobody notices, and memoising it is the obvious first optimisation.
- **The `/card` route needs SPA fallback** to work on static hosting. Fine under
  `vite dev` and `vite preview`; a plain file server would 404 it.

---

## On how this was built

I used AI assistance throughout, which the brief invites. Every rule in
[RULES.md](RULES.md) is one I can explain and defend without it — the Source
column says which are my judgement and which are market observations I have not
verified, and the honest-limits section above is specific about where I would
expect to lose an argument. The parts I would most want to be asked about are
the two-number framing in `AFF-15`, the decision to cap recognised income at
declared income in `INC-12`, and the four defects the gates caught that are
written up in RULES.md as the reason a rule exists.
