# Run-throughs

**This file is generated.** Every question, band, reason and figure below comes
from running the three borrowers through the engine — the same code the
application uses. Regenerate with:

```bash
npm run runthroughs
```

Change a value in [`src/rules/rules.config.ts`](src/rules/rules.config.ts), run
that, and the numbers here move with it. The output is deterministic, so
regenerating with nothing changed produces no diff — a diff in this file means a
rule actually moved.

The three borrowers are reconstructed from the brief. Where a figure was not
stated, it is one I chose and flagged; see the honest-limits section of
[WALKTHROUGH.md](WALKTHROUGH.md).

---

## Priya

Salaried in a metro with payslips, borrowing for a wedding. Her paperwork is in order, so the lender view and the household view start from almost the same income — and still end up nearly four times apart, because of what the household actually costs to run.

### What the app asked, in order

26 questions — 9 opening, 17 follow-up. Order is computed, not fixed: after the opening set the app asks whichever question would tighten *their* numbers most.

| # | Question | Answer |
|---|---|---|
| 1 | What is the money for? | Spending — a wedding, a purchase, family costs |
| 2 | What kind of loan do you think you need? | Personal loan |
| 3 | How much do you want to borrow? | ₹3,00,000 |
| 4 | How do you earn? | Salaried, with payslips |
| 5 | What do you take home each month, after deductions? | ₹26,000 to ₹30,000 |
| 6 | How old are you? | 29 |
| 7 | What do you already pay each month towards loans? | _"I don't know"_ |
| 8 | What does your household spend in a month, excluding rent? | _"I don't know"_ |
| 9 | Do you know your credit score? | _"I don't know"_ |
| 10 | What can you show a lender to prove your income? | Payslips |
| 11 | Has anyone already quoted you a loan? | A private bank |
| 12 | What rent do you pay? | ₹8,000 |
| 13 | Do you owe money outside the banking system — a local lender, a chit, family? | ₹0 |
| 14 | Is there anything big you already know is coming in the next year? | ₹0 |
| 15 | How much do you have set aside for emergencies? | ₹15,000 |
| 16 | How many people depend on your income? | 1 |
| 17 | Do you use credit cards? | Yes |
| 18 | How much is outstanding across your cards? | ₹22,000 |
| 19 | Where do you live? | A metro |
| 20 | How steady is your income month to month? | About the same every month |
| 21 | Is there someone in the household who also earns and could apply with you? | No |
| 22 | How long have you been earning this way? | 3 years |
| 23 | How have your repayments gone? | All on time |
| 24 | What rate did they quote? | 16% |
| 25 | What processing fee did they mention? | 2% |
| 26 | Any bounced payments in the last year? | 0 |

**Never asked** (15), because they do not apply:

- What does the work bring in each month?
- Of that, how much comes in even in a bad month?
- What income does your last filed return show?
- What do they earn each month?
- Can they prove that income on paper?
- How much is still outstanding on that borrowing?
- What rate are you paying on it?
- What do you pay on it each month, as a percentage?
- How much extra do you expect this to earn you each month?
- Is that money already coming in, or is it what you expect?
- Do you own property? Roughly what is it worth?
- Is it where you live, or business premises?
- Is the title clear, with no existing loan against it?
- What is the on-road price of the vehicle?
- How much can you put down yourself?

### O1 — Should I borrow?

**BORROW LESS** · confidence: low

- ₹3,00,000 means ₹7,537 a month, which is beyond what your household can carry. ₹1,17,426 at ₹2,950 a month does fit.
- Take the smaller figure rather than the largest that fits today: at ₹2,950 a month, a 20% fall in income would leave you short. A loan that breaks in a bad month is a smaller loan, not no loan.

### O2 — How much?

| | Range | Confidence |
|---|---|---|
| What a lender would likely offer | ₹3,28,650 – ₹5,05,529 | low |
| What the household can carry | ₹68,392 – ₹1,69,832 | low |

**Go by: borrowerSafe.** A lender may well offer you up to ₹5,05,529, but go by ₹1,69,832. What binds is that ₹13,750 a month has to be left for a household of 2 to live on after ₹8,000 of rent and ₹1,300 of existing payments.

- ₹3,28,650 to ₹5,05,529 is what a ₹12,700 monthly instalment buys over 60 months at 11% to 24%.
- Both figures stop at ₹5,05,529, which is as much as this product will lend you - against what you have put up as security, not against what you earn. Your income and your household would stretch further than that.
- ₹68,392 to ₹1,69,832 is what your household can carry at ₹2,950 a month over the same term.
- Both figures stop at ₹5,05,529, which is as much as this product will lend you - against what you have put up as security, not against what you earn. Your income and your household would stretch further than that.

### O3 — What should it cost?

Rate offered: **11% – 24%** a year · credit tier: `unknown`

All-in cost including fees: **13% – 28.6%** · confidence: low

- Your rate could be anywhere from 11% to 24% — a 13% spread — because nobody has looked at your credit score yet. That band is wide because it covers every possibility, not because your credit is poor.
- The all-in cost is 13% to 28.6%, higher than the headline rate: a 2% processing fee of ₹10,111 plus ₹2,180 GST and ₹2,000 of other charges is taken out before the money reaches you. Borrow ₹5,05,529 and you would actually receive ₹4,91,238, while paying interest on the whole ₹5,05,529.

### O4 — What can I pay monthly?

**₹1,897 – ₹4,003** a month · confidence: low

Longest term available: 5 years, capped by `product`.

| Paid over | Each month | Extra paid in total |
|---|---|---|
| 1 year | ₹10,738 | ₹11,426 |
| 2 years | ₹5,834 | ₹22,591 |
| 3 years | ₹4,216 | ₹34,344 |
| 4 years | ₹3,419 | ₹46,676 |
| 5 years | ₹2,950 | ₹59,574 |

Stress case (a scenario, not a forecast): a 20% fall in income would leave the payment at ₹2,950 against ₹0 affordable — **does not hold**.

- We assumed household spending of about ₹12,500 a month because you have not told us yet. Tell us the real figure and this number moves either way.
- We assumed you already pay about ₹1,300 a month towards other loans, because you have not said. If you pay nothing, tell us and your ceiling rises immediately.
- A lender would stop at ₹12,700 a month: 50% of the ₹28,000 they recognise is ₹14,000, less the ₹1,300 you already pay each month.
- Your household can carry ₹2,950 a month. After ₹8,000 rent and ₹1,300 of existing payments, ₹13,750 has to be left for a household of 2 in a metro area to live on, and that floor is what binds.
- Your longest term here is 5 years, the product ceiling. Age is not the constraint: at 29 you have room until 60, which would allow 31 years.
- Under a 20% drop in income, the instalment would be ₹2,950 against ₹0 your household could then carry — it no longer fits.
- No rate rise is applied: this product is fixed-rate, so it does not reprice.
- You would also need about ₹23,450 put by to cover one month of instalment, rent and living costs. You have ₹15,000.
- We have assumed you have no borrowing beyond what you have told us about - nothing on a card, nothing with a local lender, no other loan running. If any of that exists, telling us usually changes the whole answer.

### Which product, and why

1. `personal` — up to ₹5,05,529 at 20.8% all-in over 5 years
2. `business_unsecured` — up to ₹4,15,525 at 24.7% all-in over 4 years
   - An unsecured business loan ranks below a personal loan: it would cost 24.7% all-in against 20.8%, and it supports ₹4,15,525 against ₹5,05,529.
- ✕ A loan against property needs a property. You have not told us about one.
- ✕ A vehicle loan needs a vehicle. You have not told us what you are buying.

### Existing debt

Verdict: **refinance**

| | |
|---|---|
| Change in monthly outflow | ₹-126 |
| Total saved | ₹17,474 |
| Cost of switching | ₹2,949 |
| Ahead from | month 7 |

- You owe ₹22,000 at 42% a year. Moving it to a personal loan at 17.5% over 3 years would cost you ₹896 a month instead of ₹770, and would save ₹17,474 in total.
- Note that this costs ₹126 a month more, not less. The ₹770 you pay now is interest only — it never reduces what you owe, so you would still owe ₹22,000 in 3 years. The refinanced loan ends.

### What to do next

1. **Deal with the expensive borrowing you already have before adding anything new.**
   - Refinancing it cuts your blended cost of debt and frees money every month, which is worth more to you than the new loan you came here for. _(weeks)_
2. **Check your credit score. It is free on several websites, takes about ten minutes, and costs you nothing.**
   - Your rate range is 13% wide right now because nothing has been measured. Knowing the score would narrow it to around 2.5%. _(today)_
3. **Find the title deed and a current encumbrance certificate for the property.**
   - Opens a loan against property in the nine to fifteen per cent range instead of unsecured borrowing at fourteen to twenty-six. _(weeks)_
4. **Add an earning member of the household as a co-applicant.**
   - Their income joins yours in the lender calculation, and their obligations join too. It usually raises the ceiling more than anything else on this list. _(weeks)_
5. **Ask for the smaller amount this assessment says you can carry, and stage the rest.**
   - You asked for ₹3,00,000. ₹1,69,832 is what your household can carry without a bad month becoming a missed payment. _(today)_
6. **Put aside one month of expenses before taking the loan.**
   - You are about ₹6,800 short of one month of cover. That gap is the difference between a bad month being awkward and it becoming a default. _(months)_
7. **Tell us what your household actually spends in a month.**
   - We are assuming ₹12,500 a month. Your own figure replaces it, and your safe limit moves with it in whichever direction is true. _(today)_

### The negotiation card

| | |
|---|---|
| A fair rate for me | 11% – 24% a year |
| What I can pay each month | ₹1,897 – ₹4,003 |
| What I am asking to borrow | ₹68,392 – ₹1,69,832 |
| The number I compare offers on | 13% – 28.6% all-in |

**Why that is fair for me:**

- My credit standing: not yet checked, so this range is wide
- How I earn: a salary with payslips, and I can show payslips
- How long I would take: 5 years
- What backs the loan: nothing — this is unsecured, which is why it is dearer

**What I will ask them:**

1. What credit score are you pricing me at?
   - _You have not checked yours yet, so this tells you whether their number matches reality._
2. Is this rate fixed for the whole term, or can it move?
   - _A rate that can move turns a payment you checked into one you did not._
3. What would it cost me to close this loan early?
   - _It decides whether you can leave if something better appears._

**Checking the offer they were actually given** (16% over 5 years with a 2% fee):

- True all-in cost of that offer: **18.5%**
- Verdict: **cannot judge yet**
- Against the best rate she should get (11%): **₹26,246 more over 5 years**, or ₹437 a month — ₹4,130 instead of ₹3,693

---

## Ravi

Shopkeeper, 42, takings between ₹40,000 and ₹80,000 a month depending on the season, ₹4.2 lakh declared on his return. He came in asking for an unsecured business loan. This is the run to read: it is where the app tells somebody the product they asked for is the wrong one, and shows its working.

### What the app asked, in order

36 questions — 9 opening, 27 follow-up. Order is computed, not fixed: after the opening set the app asks whichever question would tighten *their* numbers most.

| # | Question | Answer |
|---|---|---|
| 1 | What is the money for? | Something that will earn me money |
| 2 | What kind of loan do you think you need? | Business loan |
| 3 | How much do you want to borrow? | ₹15,00,000 |
| 4 | How do you earn? | Self-employed, mostly cash |
| 5 | What does the work bring in each month? | ₹40,000 to ₹80,000 |
| 6 | How old are you? | 42 |
| 7 | What do you already pay each month towards loans? | ₹8,000 |
| 8 | What does your household spend in a month, excluding rent? | _"I don't know"_ |
| 9 | Do you know your credit score? | 720 |
| 10 | What can you show a lender to prove your income? | Income tax return |
| 11 | Of that, how much comes in even in a bad month? | ₹40,000 |
| 12 | What rent do you pay? | ₹6,000 |
| 13 | Do you owe money outside the banking system — a local lender, a chit, family? | ₹0 |
| 14 | Has anyone already quoted you a loan? | An NBFC or finance company |
| 15 | How many people depend on your income? | 3 |
| 16 | Is there anything big you already know is coming in the next year? | ₹50,000 |
| 17 | How much do you have set aside for emergencies? | ₹60,000 |
| 18 | Do you use credit cards? | No |
| 19 | Where do you live? | A large town or small city |
| 20 | What income does your last filed return show? | ₹4,20,000 |
| 21 | How much is still outstanding on that borrowing? | ₹3,00,000 |
| 22 | How steady is your income month to month? | Busy and quiet seasons |
| 23 | Do you own property? Roughly what is it worth? | ₹40,00,000 |
| 24 | How long have you been earning this way? | 10 years |
| 25 | Is there someone in the household who also earns and could apply with you? | Yes |
| 26 | How have your repayments gone? | All on time |
| 27 | Can they prove that income on paper? | Nothing on paper |
| 28 | What rate did they quote? | 21% |
| 29 | What processing fee did they mention? | 2.5% |
| 30 | What rate are you paying on it? | 18% |
| 31 | Any bounced payments in the last year? | 0 |
| 32 | Is it where you live, or business premises? | A shop or business premises |
| 33 | How much extra do you expect this to earn you each month? | ₹22,000 |
| 34 | What do they earn each month? | ₹18,000 |
| 35 | Is that money already coming in, or is it what you expect? | No |
| 36 | Is the title clear, with no existing loan against it? | Yes |

**Never asked** (5), because they do not apply:

- What do you take home each month, after deductions?
- What do you pay on it each month, as a percentage?
- How much is outstanding across your cards?
- What is the on-road price of the vehicle?
- How much can you put down yourself?

### O1 — Should I borrow?

**BORROW LESS** · confidence: medium

- ₹15,00,000 means ₹19,976 a month, which is beyond both what you can carry and what a lender will allow. ₹5,81,945 at ₹7,750 a month does fit.
- The ₹22,000 a month you expect to earn covers the instalment only 1.1 times, short of the 1.25 we look for. An asset that earns roughly its own instalment leaves you working for the lender and carrying the risk of a slow month.

### O2 — How much?

| | Range | Confidence |
|---|---|---|
| What a lender would likely offer | ₹4,75,341 – ₹5,81,945 | medium |
| What the household can carry | ₹5,81,945 | medium |

**Go by: lenderLikely.** Go by ₹5,81,945. Your household could carry more than a lender will advance here, so what you will be offered is the binding constraint rather than what you can afford.

- ₹4,75,341 to ₹5,81,945 is what a ₹7,750 monthly instalment buys over 180 months at 13% to 15%.
- Both figures stop at ₹5,81,945, which is as much as this product will lend you - against what you have put up as security, not against what you earn. Your income and your household would stretch further than that.
- ₹5,81,945 to ₹5,81,945 is what your household can carry at ₹19,067 a month over the same term.
- Both figures stop at ₹5,81,945, which is as much as this product will lend you - against what you have put up as security, not against what you earn. Your income and your household would stretch further than that.

### O3 — What should it cost?

Rate offered: **13% – 15%** a year · credit tier: `near_prime`

All-in cost including fees: **15.2% – 17.6%** · confidence: high

- Your rate lands between 13% to 15%: this product starts at 9% and your credit standing adds 2% to 4.5%.
- The all-in cost is 15.2% to 17.6%, higher than the headline rate: a 2.5% processing fee of ₹14,549 plus ₹5,319 GST and ₹15,000 of other charges is taken out before the money reaches you. Borrow ₹5,81,945 and you would actually receive ₹5,47,077, while paying interest on the whole ₹5,81,945.

### O4 — What can I pay monthly?

**₹6,445 – ₹9,055** a month · confidence: medium

Longest term available: 15 years, capped by `product`.

| Paid over | Each month | Extra paid in total |
|---|---|---|
| 5 years | ₹13,541 | ₹2,30,505 |
| 7 years | ₹10,906 | ₹3,34,130 |
| 9 years | ₹9,505 | ₹4,44,629 |
| 11 years | ₹8,663 | ₹5,61,600 |
| 13 years | ₹8,119 | ₹6,84,577 |
| 15 years | ₹7,750 | ₹8,13,055 |

Stress case (a scenario, not a forecast): a 30% fall in income and a 2% rate rise would leave the payment at ₹8,547 against ₹9,640 affordable — **holds**.

- We assumed household spending of about ₹16,000 a month because you have not told us yet. Tell us the real figure and this number moves either way.
- A lender would stop at ₹7,750 a month: 45% of the ₹35,000 they recognise is ₹15,750, less the ₹8,000 you already pay each month.
- That ratio is 5% lower than it would be for a formal salary, because a lender discounts income that varies.
- Your household can carry ₹19,067 a month: ₹58,000 coming in, less ₹16,000 of living costs, ₹6,000 rent and ₹8,000 of existing payments, then ₹4,767 set aside towards an emergency buffer.
- You have told us about ₹50,000 of spending coming in the next year, so ₹4,167 a month of your income is already spoken for before any instalment.
- Your longest term here is 15 years, the product ceiling. Age is not the constraint: at 42 you have room until 70, which would allow 28 years.
- Under a 30% drop in income and a 2% rate rise, the instalment would be ₹8,547 against ₹9,640 your household could then carry — it still fits.

### Which product, and why

1. `lap` — up to ₹5,81,945 at 16.4% all-in over 15 years _(short of what was asked for)_
2. `personal` — up to ₹3,06,838 at 21.4% all-in over 5 years _(short of what was asked for)_
   - A personal loan ranks below a loan against property: it would cost 21.4% all-in against 16.4%, and it supports ₹3,06,838 against ₹5,81,945, well short of the ₹15,00,000 you asked for.
3. `business_unsecured` — up to ₹2,49,194 at 26.7% all-in over 4 years _(short of what was asked for)_
   - An unsecured business loan ranks below a loan against property: it would cost 26.7% all-in against 16.4%, and it supports ₹2,49,194 against ₹5,81,945, well short of the ₹15,00,000 you asked for.
- ✕ A vehicle loan needs a vehicle. You have not told us what you are buying.

**Routing overrode what was asked for:**

- You asked about an unsecured business loan, but a loan against property is the better route: 16.4% all-in against 26.7%, a difference of 10.3% a year, and ₹5,81,945 available against ₹2,49,194 — ₹3,32,751 more.
- What you give up: Your premises become the security. The rate is far lower and the amount far higher, but if this loan goes wrong you can lose the shop, and that is a slower, harder failure than a missed instalment on an unsecured loan.

### What to do next

1. **Get six months of bank statements for the account your earnings go into.**
   - Your household has ₹58,000 a month but a lender counts ₹35,000, and everything you are offered is built on the smaller figure. _(weeks)_
2. **Ask for the smaller amount this assessment says you can carry, and stage the rest.**
   - You asked for ₹15,00,000. ₹5,81,945 is what your household can carry without a bad month becoming a missed payment. _(today)_
3. **Put aside one month of expenses before taking the loan.**
   - You have a month's cover already. Building it to about ₹1,45,000 more is what would let you carry this without a quiet season becoming a missed payment. _(months)_
4. **Tell us what your household actually spends in a month.**
   - We are assuming ₹16,000 a month. Your own figure replaces it, and your safe limit moves with it in whichever direction is true. _(today)_

### The negotiation card

| | |
|---|---|
| A fair rate for me | 13% – 15% a year |
| What I can pay each month | ₹6,445 – ₹9,055 |
| What I am asking to borrow | ₹5,81,945 |
| The number I compare offers on | 15.2% – 17.6% all-in |

**Why that is fair for me:**

- My credit standing: a reasonable credit record
- How I earn: my own business, mostly in cash, and I can show a filed return
- How long I would take: 15 years
- What backs the loan: my property, so this should be at the lower end

**What I will ask them:**

1. Is this rate fixed for the whole term, or can it move?
   - _A rate that can move turns a payment you checked into one you did not._
2. What would it cost me to close this loan early?
   - _It decides whether you can leave if something better appears._
3. What is the total I will have paid by the end?
   - _One number, and the hardest one to make sound small._

**Checking the offer they were actually given** (21% over 15 years with a 2.5% fee):

- True all-in cost of that offer: **24%**
- Verdict: **above fair**
- Against the best rate she should get (13%): **₹5,92,226 more over 15 years**, or ₹3,290 a month — ₹10,653 instead of ₹7,363

---

## Anita

Delivery rider who also takes in tailoring, buying an electric scooter to earn with. She is carrying ₹80,000 with a local lender at 3% a month. The loan she asked about is not the most useful thing this assessment has to tell her.

### What the app asked, in order

32 questions — 9 opening, 23 follow-up. Order is computed, not fixed: after the opening set the app asks whichever question would tighten *their* numbers most.

| # | Question | Answer |
|---|---|---|
| 1 | What is the money for? | Something that will earn me money |
| 2 | What kind of loan do you think you need? | Two-wheeler loan |
| 3 | How much do you want to borrow? | ₹1,10,000 |
| 4 | How do you earn? | Daily wage or gig work |
| 5 | What does the work bring in each month? | ₹27,000 to ₹35,000 |
| 6 | How old are you? | 31 |
| 7 | What do you already pay each month towards loans? | _"I don't know"_ |
| 8 | What does your household spend in a month, excluding rent? | _"I don't know"_ |
| 9 | Do you know your credit score? | _"I don't know"_ |
| 10 | Of that, how much comes in even in a bad month? | ₹22,000 |
| 11 | What can you show a lender to prove your income? | Bank statements only |
| 12 | Has anyone already quoted you a loan? | An app or online lender |
| 13 | What rent do you pay? | ₹6,000 |
| 14 | Do you owe money outside the banking system — a local lender, a chit, family? | ₹80,000 |
| 15 | Is there anything big you already know is coming in the next year? | ₹25,000 |
| 16 | How much do you have set aside for emergencies? | ₹0 |
| 17 | How many people depend on your income? | 1 |
| 18 | Do you use credit cards? | Yes |
| 19 | How much is outstanding across your cards? | ₹18,000 |
| 20 | Where do you live? | A large town or small city |
| 21 | How steady is your income month to month? | Varies a lot, hard to predict |
| 22 | Is there someone in the household who also earns and could apply with you? | No |
| 23 | How have your repayments gone? | _"I don't know"_ |
| 24 | What rate did they quote? | 24% |
| 25 | What processing fee did they mention? | _"I don't know"_ |
| 26 | How much can you put down yourself? | ₹15,000 |
| 27 | How long have you been earning this way? | 18 months |
| 28 | Any bounced payments in the last year? | 1 |
| 29 | How much extra do you expect this to earn you each month? | ₹12,000 |
| 30 | What do you pay on it each month, as a percentage? | 3% |
| 31 | Is that money already coming in, or is it what you expect? | Yes |
| 32 | What is the on-road price of the vehicle? | ₹1,25,000 |

**Never asked** (9), because they do not apply:

- What do you take home each month, after deductions?
- What income does your last filed return show?
- What do they earn each month?
- Can they prove that income on paper?
- How much is still outstanding on that borrowing?
- What rate are you paying on it?
- Do you own property? Roughly what is it worth?
- Is it where you live, or business premises?
- Is the title clear, with no existing loan against it?

### O1 — Should I borrow?

**DO NOT BORROW** · confidence: low

- Your household can carry ₹333 a month. The smallest loan anybody will write on this product needs ₹909, so there is no amount here that is safe for you to take right now.
- That holds even counting the loan's own earnings: of the ₹12,000 a month you expect, we would count ₹6,000, because it is money already coming in. Earning can make a loan bigger; it cannot make an unaffordable one affordable.
- New borrowing is the wrong question here. Restructuring what you already owe is worth ₹65,485 to you, and it is available now — that is the thing to do first.

### O2 — How much?

| | Range | Confidence |
|---|---|---|
| What a lender would likely offer | ₹86,870 – ₹1,10,000 | medium |
| What the household can carry | ₹0 – ₹35,412 | low |

**Go by: borrowerSafe.** A lender may well offer you up to ₹1,10,000, but go by ₹35,412. What binds is your monthly budget, and the largest single pressure on it is ₹10,000 of living costs.

- ₹86,870 to ₹1,10,000 is what a ₹3,550 monthly instalment buys over 48 months at 17.5% to 22%.
- Both figures stop at ₹1,10,000, which is as much as this product will lend you - against what you have put up as security, not against what you earn. Your income and your household would stretch further than that.
- ₹0 to ₹35,412 is what your household can carry at ₹333 a month over the same term.
- Both figures stop at ₹1,10,000, which is as much as this product will lend you - against what you have put up as security, not against what you earn. Your income and your household would stretch further than that.

### O3 — What should it cost?

Rate offered: **17.5% – 22%** a year · credit tier: `no_file`

All-in cost including fees: **21.8% – 29.6%** · confidence: medium

- Your rate lands between 17.5% to 22%: this product starts at 9.5% and your credit standing adds 3% to 9%.
- A further 1% is added for recent missed payments, and it comes off after 6 clean months.
- The all-in cost is 22.8% to 28.5%, higher than the headline rate: a 2% processing fee of ₹2,200 plus ₹936 GST and ₹3,000 of other charges is taken out before the money reaches you. Borrow ₹1,10,000 and you would actually receive ₹1,03,864, while paying interest on the whole ₹1,10,000.

### O4 — What can I pay monthly?

**₹0 – ₹1,224** a month · confidence: low

Longest term available: 4 years, capped by `product`.

| Paid over | Each month | Extra paid in total |
|---|---|---|
| 1 year | ₹1,018 | ₹1,212 |
| 2 years | ₹559 | ₹2,405 |
| 3 years | ₹407 | ₹3,667 |
| 4 years | ₹333 | ₹4,998 |

Stress case (a scenario, not a forecast): a 30% fall in income would leave the payment at ₹333 against ₹0 affordable — **does not hold**.

- We assumed household spending of about ₹10,000 a month because you have not told us yet. Tell us the real figure and this number moves either way.
- We assumed you already pay about ₹1,100 a month towards other loans, because you have not said. If you pay nothing, tell us and your ceiling rises immediately.
- A lender would stop at ₹3,550 a month: 30% of the ₹15,500 they recognise is ₹4,650, less the ₹1,100 you already pay each month.
- That ratio is 10% lower than it would be for a formal salary, because a lender discounts income that varies.
- Your household can carry ₹333 a month: ₹22,000 coming in, less ₹10,000 of living costs, ₹6,000 rent and ₹1,100 of existing payments, then ₹83 set aside towards an emergency buffer.
- You have told us about ₹25,000 of spending coming in the next year, so ₹2,083 a month of your income is already spoken for before any instalment.
- ₹2,400 a month of that is going to informal borrowing at 42.6% a year, and it is paying interest only — the amount you owe is not going down.
- Your longest term here is 4 years, the product ceiling. Age is not the constraint: at 31 you have room until 58, which would allow 27 years.
- Under a 30% drop in income, the instalment would be ₹333 against ₹0 your household could then carry — it no longer fits.
- No rate rise is applied: this product is fixed-rate, so it does not reprice.
- You would also need about ₹16,333 put by to cover one month of instalment, rent and living costs. You have ₹0.
- We have assumed you have no borrowing beyond what you have told us about - nothing on a card, nothing with a local lender, no other loan running. If any of that exists, telling us usually changes the whole answer.

### Which product, and why

1. `two_wheeler_ev` — up to ₹1,10,000 at 25.7% all-in over 4 years
2. `personal` — up to ₹1,30,543 at 26.8% all-in over 5 years
   - A personal loan ranks below a two-wheeler loan: it would cost 26.8% all-in against 25.7%, and it supports ₹1,30,543 against ₹1,10,000.
- ✕ A loan against property needs a recognised income of at least ₹20,000 a month and a lender currently recognises ₹15,500 of yours.
- ✕ An unsecured business loan needs a recognised income of at least ₹25,000 a month and a lender currently recognises ₹15,500 of yours.

### Existing debt

Verdict: **refinance**

| | |
|---|---|
| Change in monthly outflow | ₹-903 |
| Total saved | ₹65,485 |
| Cost of switching | ₹6,043 |
| Ahead from | month 5 |

- You owe ₹98,000 at 42.5% a year. Moving it to a personal loan at 21.3% over 3 years would cost you ₹3,933 a month instead of ₹3,030, and would save ₹65,485 in total.
- Note that this costs ₹903 a month more, not less. The ₹3,030 you pay now is interest only — it never reduces what you owe, so you would still owe ₹98,000 in 3 years. The refinanced loan ends.

### What to do next

1. **Deal with the expensive borrowing you already have before adding anything new.**
   - You are paying 42.6% a year on ₹80,000. Moving it saves about ₹65,485 and the debt actually ends. This is worth more to you than the loan you came here for. _(weeks)_
2. **Get six months of bank statements for the account your earnings go into.**
   - Your household has ₹22,000 a month but a lender counts ₹15,500, and everything you are offered is built on the smaller figure. _(weeks)_
3. **File your income tax return for the last completed year, even if the tax due is nil.**
   - A filed return is the difference between a lender counting ₹15,500 of your income and counting most of it. It moves the ceiling more than anything else here. _(weeks)_
4. **Add an earning member of the household as a co-applicant.**
   - Their income joins yours in the lender calculation, and their obligations join too. It usually raises the ceiling more than anything else on this list. _(weeks)_
5. **Ask for the smaller amount this assessment says you can carry, and stage the rest.**
   - You asked for ₹1,10,000. ₹35,412 is what your household can carry without a bad month becoming a missed payment. _(today)_
6. **Keep every instalment and cheque clear for the next six months. Set a standing instruction so it cannot be missed.**
   - Removes the penalty currently added to your rate and reopens bank products that are closed to you today. _(months)_
7. **Put aside one month of expenses before taking the loan.**
   - You are about ₹21,583 short of one month of cover. That gap is the difference between a bad month being awkward and it becoming a default. _(months)_
8. **Tell us what your household actually spends in a month.**
   - We are assuming ₹10,000 a month. Your own figure replaces it, and your safe limit moves with it in whichever direction is true. _(today)_

### The negotiation card

| | |
|---|---|
| A fair rate for me | 17.5% – 22% a year |
| What I can pay each month | ₹0 – ₹1,224 |
| What I am asking to borrow | ₹0 – ₹35,412 |
| The number I compare offers on | 21.8% – 29.6% all-in |

**Why that is fair for me:**

- My credit standing: new to credit, priced on income instead
- How I earn: daily and piece work, and I can show bank statements
- How long I would take: 4 years
- What backs the loan: the vehicle itself

**What I will ask them:**

1. What is your processing fee, and is it already inside the rate you just quoted me?
   - _A fee taken out before the money reaches you costs more than the rate suggests._
2. What credit score are you pricing me at?
   - _You have not checked yours yet, so this tells you whether their number matches reality._
3. Is this rate fixed for the whole term, or can it move?
   - _A rate that can move turns a payment you checked into one you did not._

**Checking the offer they were actually given** (24% over 4 years with a 2% fee):

- True all-in cost of that offer: **28.6%**
- Verdict: **cannot judge yet**
- Against the best rate she should get (17.5%): **₹5,928 more over 4 years**, or ₹123 a month — ₹1,154 instead of ₹1,031

---
