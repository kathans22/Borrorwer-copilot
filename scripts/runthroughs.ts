/**
 * Generates RUNTHROUGHS.md from live engine output.
 *
 * Nothing in that file is typed by hand. Every question, every band, every
 * reason and every figure on the negotiation card comes from running the
 * three borrowers through the same code the application uses, so changing a
 * rule and re-running this is the only way the document can change. If it
 * ever disagrees with the engine, the engine won.
 *
 * The output is deterministic - no timestamps, no run ids - so regenerating
 * with nothing changed produces no diff at all. That is the property worth
 * having: a diff here means a rule actually moved.
 */

import { writeFileSync } from 'node:fs'
import { buildNegotiationCard, compareQuote } from '../src/engine/negotiation'
import { computeWithTrace } from '../src/engine/index'
import { fullPath } from '../src/questions/order'
import { ALL_QUESTIONS } from '../src/questions/questions.config'
import type { AnswerFieldId, BorrowerAnswers, Reason } from '../src/types'
import { anita, priya, ravi } from './personas'

const money = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
const pct = (n: number, dp = 1) => {
  const s = n.toFixed(dp)
  return (s.endsWith('.0') ? s.slice(0, -2) : s) + '%'
}
const moneyBand = (lo: number, hi: number) =>
  Math.round(lo) === Math.round(hi) ? money(lo) : `${money(lo)} – ${money(hi)}`
const pctBand = (lo: number, hi: number) =>
  lo.toFixed(1) === hi.toFixed(1) ? pct(lo) : `${pct(lo)} – ${pct(hi)}`
const months = (m: number) =>
  m >= 12 && m % 12 === 0 ? `${m / 12} year${m / 12 === 1 ? '' : 's'}` : `${Math.round(m)} months`

/** An answer as the borrower would have given it, not as the engine stores it. */
function answerText(field: AnswerFieldId, answers: BorrowerAnswers): string {
  const raw = answers[field] as
    | { value: unknown }
    | { range: { low: number; high: number } }
    | { unknown: true }
    | undefined

  if (raw === undefined || 'unknown' in raw) return '_"I don\'t know"_'

  const question = ALL_QUESTIONS.find((q) => q.id === field)

  if ('range' in raw) return `${money(raw.range.low)} to ${money(raw.range.high)}`

  const v = raw.value
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string') {
    const label = question?.options?.find((o) => o.value === v)?.label
    return label ?? v
  }
  if (typeof v === 'number') {
    if (question?.inputType === 'currency') return money(v)
    if (field === 'age') return `${v}`
    if (field === 'timeInCurrentWork' || field === 'requestedTenure') return months(v)
    if (field === 'quotedRate' || field === 'existingLoanRate') return pct(v)
    if (field === 'quotedProcessingFee' || field === 'informalDebtRateMonthly') return pct(v)
    return String(v)
  }
  return String(v)
}

const reasonList = (reasons: Reason[]) =>
  reasons.length === 0 ? '_no reasons recorded_' : reasons.map((r) => `- ${r.text}`).join('\n')

function runthrough(name: string, blurb: string, answers: BorrowerAnswers): string {
  const { result, trace } = computeWithTrace(answers)
  const card = buildNegotiationCard(answers)
  const path = fullPath(answers)
  const out: string[] = []

  out.push(`## ${name}\n`)
  out.push(`${blurb}\n`)

  // --- the questions, in the order the app actually asked them ----------
  out.push(`### What the app asked, in order\n`)
  out.push(`${path.length} questions — ${path.filter((q) => q.tier === 'must').length} opening, ${path.filter((q) => q.tier === 'additional').length} follow-up. Order is computed, not fixed: after the opening set the app asks whichever question would tighten *their* numbers most.\n`)
  out.push('| # | Question | Answer |')
  out.push('|---|---|---|')
  path.forEach((q, i) => {
    out.push(`| ${i + 1} | ${q.prompt} | ${answerText(q.id, answers)} |`)
  })

  const skipped = ALL_QUESTIONS.filter((q) => !path.some((p) => p.id === q.id))
  if (skipped.length > 0) {
    out.push(`\n**Never asked** (${skipped.length}), because they do not apply:\n`)
    out.push(skipped.map((q) => `- ${q.prompt}`).join('\n'))
  }

  // --- the four outputs -------------------------------------------------
  out.push(`\n### O1 — Should I borrow?\n`)
  out.push(`**${result.verdict.value.replace(/_/g, ' ').toUpperCase()}** · confidence: ${result.verdict.confidence}\n`)
  out.push(reasonList(result.verdict.reasons))

  out.push(`\n### O2 — How much?\n`)
  out.push('| | Range | Confidence |')
  out.push('|---|---|---|')
  out.push(
    `| What a lender would likely offer | ${moneyBand(result.maxAmount.lenderLikely.band.low as number, result.maxAmount.lenderLikely.band.high as number)} | ${result.maxAmount.lenderLikely.confidence} |`,
  )
  out.push(
    `| What the household can carry | ${moneyBand(result.maxAmount.borrowerSafe.band.low as number, result.maxAmount.borrowerSafe.band.high as number)} | ${result.maxAmount.borrowerSafe.confidence} |`,
  )
  out.push(`\n**Go by: ${result.maxAmount.useWhich}.** ${result.maxAmount.useWhichReason.text}\n`)
  out.push(reasonList([...result.maxAmount.lenderLikely.reasons, ...result.maxAmount.borrowerSafe.reasons]))

  out.push(`\n### O3 — What should it cost?\n`)
  if (trace.pricing) {
    out.push(`Rate offered: **${pctBand(trace.pricing.rateBand.low, trace.pricing.rateBand.high)}** a year · credit tier: \`${trace.pricing.creditTier}\`\n`)
  }
  out.push(`All-in cost including fees: **${pctBand(result.fairRate.band.low as number, result.fairRate.band.high as number)}** · confidence: ${result.fairRate.confidence}\n`)
  out.push(reasonList(result.fairRate.reasons))

  out.push(`\n### O4 — What can I pay monthly?\n`)
  out.push(`**${moneyBand(result.emiCeiling.band.low as number, result.emiCeiling.band.high as number)}** a month · confidence: ${result.emiCeiling.confidence}\n`)
  out.push(`Longest term available: ${months(trace.tenureMonths)}, capped by \`${trace.tenureCappedBy}\`.\n`)
  if (trace.tenureOptions.length > 1) {
    out.push('| Paid over | Each month | Extra paid in total |')
    out.push('|---|---|---|')
    for (const o of trace.tenureOptions) {
      out.push(`| ${months(o.tenureMonths)} | ${money(o.emi)} | ${money(o.totalInterest)} |`)
    }
    out.push('')
  }
  if (trace.stress) {
    out.push(
      `Stress case (a scenario, not a forecast): a ${pct(trace.stress.incomeDropPct, 0)} fall in income${trace.stress.rateRiseApplied > 0 ? ` and a ${pct(trace.stress.rateRiseApplied)} rate rise` : ''} would leave the payment at ${money(trace.stress.stressedEmi)} against ${money(trace.stress.stressedSafeCarry)} affordable — **${trace.stress.passes ? 'holds' : 'does not hold'}**.\n`,
    )
  }
  out.push(reasonList(result.emiCeiling.reasons))

  // --- product routing --------------------------------------------------
  out.push(`\n### Which product, and why\n`)
  trace.ranking.ranked.forEach((r, i) => {
    out.push(`${i + 1}. \`${r.product}\` — up to ${money(r.maxAmountInr)} at ${pct((r.aprBand.low + r.aprBand.high) / 2)} all-in over ${months(r.tenureMonths)}${r.meetsRequest ? '' : ' _(short of what was asked for)_'}`)
    if (r.demotionReason) out.push(`   - ${r.demotionReason.text}`)
  })
  for (const ex of trace.ranking.excluded) out.push(`- ✕ ${ex.reason.text}`)
  if (trace.ranking.overrodeStatedPreference) {
    out.push(`\n**Routing overrode what was asked for:**\n`)
    out.push(reasonList(trace.ranking.reasons))
  }

  // --- refinance --------------------------------------------------------
  if (result.refinance) {
    const r = result.refinance
    out.push(`\n### Existing debt\n`)
    out.push(`Verdict: **${r.worthIt.value.replace(/_/g, ' ')}**\n`)
    out.push('| | |')
    out.push('|---|---|')
    out.push(`| Change in monthly outflow | ${money(r.monthlySaving.band.low as number)} |`)
    out.push(`| Total saved | ${money(r.totalSavingOverTenure.band.low as number)} |`)
    out.push(`| Cost of switching | ${money(r.switchingCost.band.low as number)} |`)
    out.push(`| Ahead from | month ${Math.round(r.breakEven.band.low as number)} |`)
    out.push('')
    out.push(reasonList(trace.refinance.reasons))
  }

  // --- actions ----------------------------------------------------------
  out.push(`\n### What to do next\n`)
  result.actions.forEach((a, i) => {
    out.push(`${i + 1}. **${a.text}**`)
    out.push(`   - ${a.changesWhat} _(${a.timeframe})_`)
  })

  // --- negotiation card -------------------------------------------------
  out.push(`\n### The negotiation card\n`)
  out.push('| | |')
  out.push('|---|---|')
  out.push(`| A fair rate for me | ${pctBand(card.fairRateBand.low as number, card.fairRateBand.high as number)} a year |`)
  out.push(`| What I can pay each month | ${moneyBand(card.maxEmi.band.low as number, card.maxEmi.band.high as number)} |`)
  out.push(`| What I am asking to borrow | ${moneyBand(card.safeAmount.band.low as number, card.safeAmount.band.high as number)} |`)
  out.push(`| The number I compare offers on | ${pctBand(card.allInApr.band.low as number, card.allInApr.band.high as number)} all-in |`)
  out.push('')
  out.push('**Why that is fair for me:**\n')
  for (const f of card.claimFactors) out.push(`- ${f.label}: ${f.value}`)
  out.push('\n**What I will ask them:**\n')
  card.questions.forEach((q, i) => {
    out.push(`${i + 1}. ${q.question}`)
    out.push(`   - _${q.because}_`)
  })

  // A worked comparison, so the card's central claim is visible in the file.
  const principal = card.safeAmount.band.high as number
  const quoted = card.prefilledQuote
  if (quoted) {
    const c = compareQuote(card, quoted, principal)
    out.push(`\n**Checking the offer they were actually given** (${pct(quoted.annualRatePct)} over ${months(quoted.tenureMonths)} with a ${pct(quoted.processingFeePct)} fee):\n`)
    out.push(`- True all-in cost of that offer: **${pct(c.quoteAllInPct)}**`)
    out.push(`- Verdict: **${c.judgement.replace(/_/g, ' ')}**`)
    if (c.extraVsBestInr > 0) {
      out.push(
        `- Against the best rate she should get (${pct(c.bestRatePct)}): **${money(c.extraVsBestInr)} more over ${months(c.tenureMonths)}**, or ${money(c.extraMonthlyInr)} a month — ${money(c.quoteEmiInr)} instead of ${money(c.bestEmiInr)}`,
      )
    }
  }

  out.push('\n---\n')
  return out.join('\n')
}

const header = `# Run-throughs

**This file is generated.** Every question, band, reason and figure below comes
from running the three borrowers through the engine — the same code the
application uses. Regenerate with:

\`\`\`bash
npm run runthroughs
\`\`\`

Change a value in [\`src/rules/rules.config.ts\`](src/rules/rules.config.ts), run
that, and the numbers here move with it. The output is deterministic, so
regenerating with nothing changed produces no diff — a diff in this file means a
rule actually moved.

The three borrowers are reconstructed from the brief. Where a figure was not
stated, it is one I chose and flagged; see the honest-limits section of
[WALKTHROUGH.md](WALKTHROUGH.md).

---

`

const body = [
  runthrough(
    'Priya',
    'Salaried in a metro with payslips, borrowing for a wedding. Her paperwork is in order, so the lender view and the household view start from almost the same income — and still end up nearly four times apart, because of what the household actually costs to run.',
    priya,
  ),
  runthrough(
    'Ravi',
    'Shopkeeper, 42, takings between ₹40,000 and ₹80,000 a month depending on the season, ₹4.2 lakh declared on his return. He came in asking for an unsecured business loan. This is the run to read: it is where the app tells somebody the product they asked for is the wrong one, and shows its working.',
    ravi,
  ),
  runthrough(
    'Anita',
    'Delivery rider who also takes in tailoring, buying an electric scooter to earn with. She is carrying ₹80,000 with a local lender at 3% a month. The loan she asked about is not the most useful thing this assessment has to tell her.',
    anita,
  ),
].join('\n')

writeFileSync('RUNTHROUGHS.md', header + body, 'utf8')
console.log('RUNTHROUGHS.md regenerated from live engine output.')
