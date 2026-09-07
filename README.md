# Borrower Copilot

A tool that answers four questions for somebody about to take a loan in India:
whether to borrow at all, how much is safe for *their household* rather than
how much a lender will hand them, what it should cost, and what they can
actually pay each month. It asks about ten questions, treats "I don't know" as
a real answer, and shows the reason behind every figure it produces. Everything
runs in the browser — no account, no server, no network calls at runtime.

## Running it

Needs Node 20 or later. Nothing else — no environment variables, no API keys,
no services to start.

```bash
git clone https://github.com/kathans22/Borrorwer-copilot.git
cd Borrorwer-copilot
npm install
npm run dev
```

Then open the address it prints, usually <http://localhost:5173>. The
negotiation card is at `/card` once you have answers.

Mobile-first — a 380px viewport is the target, so a narrow browser window shows
it as intended.

### Other commands

| command | what it does |
|---|---|
| `npm run personas` | Runs the three borrowers from the brief through the engine and prints all four outputs, with reasons |
| `npm run personas -- --questions` | The exact question path each borrower walks, in order |
| `npm run personas -- --compare` | Asserts that answering a question never widens a band |
| `npm run personas -- --tightens` | Asserts every follow-up question actually moves an output |
| `npm run runthroughs` | Regenerates [RUNTHROUGHS.md](RUNTHROUGHS.md) from live engine output |
| `npm run build` · `npm run lint` · `npm run typecheck` | The usual |

## Where things are

```
src/
  rules/rules.config.ts    every lending number in the application
  engine/                  pure TypeScript, no React, callable from Node
  questions/               the question graph, as data
  ui/                      React, reads computed results, calculates nothing
scripts/personas.ts        the three borrowers, and the assertions
RULES.md                   the human half of the rules layer
```

Four constraints hold throughout, and they are the point of the structure:

1. **Every lending number lives in `rules.config.ts`.** No threshold, rate,
   ratio or cutoff appears anywhere else. Change a value there and the app's
   output moves with no other edit.
2. **The engine has no React in it** and runs from a Node script. That is how
   `npm run personas` works, and it is enforced by the engine compiling in a
   TypeScript project that has no DOM in scope.
3. **No number leaves the engine bare.** Every output carries a range, a
   confidence and the reasons that produced it. The interface renders those
   reasons; it never writes explanation copy of its own.
4. **Units are enforced by the compiler.** `RupeesPerMonth` cannot be passed
   where `RupeesPerYear` is expected. An ITR figure is annual and a cash income
   is monthly, and that mix-up is the likeliest silent bug in a codebase like
   this one.

## Changing a rule

Say you disagree that a metro household of three needs ₹15,500 a month left
over after rent and the loan payment.

1. Open [`src/rules/rules.config.ts`](src/rules/rules.config.ts) and find
   `RESIDUAL_INCOME_FLOOR` — it is tagged **AFF-05**.
2. Change the figure.
3. `npm run personas` — all three borrowers' numbers move, and their reasons
   are rewritten to quote the new figure.
4. `npm run runthroughs` — [RUNTHROUGHS.md](RUNTHROUGHS.md) regenerates to
   match.

Nothing else needs touching. Every rule carries an ID like **AFF-05**, and the
same ID heads a row in [RULES.md](RULES.md) explaining why the number is what
it is and whether it is sourced or my judgement. A script checks that the two
files never drift apart: 171 rules, both sides, no exceptions.

## The rest of the documents

- **[RULES.md](RULES.md)** — every lending rule, what it is, and why. The
  Source column says plainly which numbers are market observations I have not
  verified.
- **[RUNTHROUGHS.md](RUNTHROUGHS.md)** — the three borrowers end to end.
  Generated, never typed.
- **[WALKTHROUGH.md](WALKTHROUGH.md)** — one borrower explained properly, what
  I would build next, what I would cut, and what this thing does not know.
- **[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)** — every number I would want
  checked before this went near a real borrower.

## What this is not

Guidance, not an offer of credit. The rate bands are estimates of what the
Indian market would likely do for a borrower of a given profile; no lender is
bound by them, and the numbers behind them are my reading rather than a scrape.
The honest-limits section of [WALKTHROUGH.md](WALKTHROUGH.md) is specific about
where that reading is weakest.
