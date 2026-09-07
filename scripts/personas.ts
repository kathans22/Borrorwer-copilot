/**
 * The three borrowers from the brief, run through the engine headless.
 *
 * These profiles are reconstructed from the details given in the brief and
 * the build notes. Where a figure was not stated I have chosen one that is
 * plausible for the borrower described and said so in the notes below each
 * persona. Correcting any of them is a one-line edit here - nothing in the
 * engine knows these people exist.
 */

import { computeWithTrace } from '../src/engine/index'
import { percent, rupees, months as monthsText } from '../src/engine/format'
import { bareLabel } from '../src/engine/productRouting'
import type {
  AnswerFieldId,
  BorrowerAnswers,
  Count,
  CreditScore,
  Months,
  MonthlyRatePct,
  Rupees,
  RupeesPerMonth,
  RupeesPerYear,
  Years,
} from '../src/types'

const v = <T>(value: T) => ({ value })
const range = <T extends number>(low: T, high: T) => ({ range: { low, high } })
const unknown = { unknown: true } as const

// =====================================================================
// Priya - salaried, metro, a wedding to pay for
//
// Formal salary with slips, so the two income views are close. What
// separates her lender ceiling from her safe carry is the household:
// metro rent, a dependant, and no savings buffer. These are the figures
// the worked example in RULES.md uses.
// =====================================================================
const priya: BorrowerAnswers = {
  productType: v('personal'),
  loanPurpose: v('consumption'),
  requestedAmount: { value: 300_000 as Rupees },

  age: { value: 29 as Years },
  cityTier: v('metro'),
  dependents: { value: 1 as Count },
  employmentType: v('salaried_formal'),
  timeInCurrentWork: { value: 36 as Months },

  salariedNetIncomeMonthly: range(26_000 as RupeesPerMonth, 30_000 as RupeesPerMonth),
  incomeProof: v('salary_slips'),
  incomeStability: v('stable'),

  rentMonthly: { value: 8_000 as RupeesPerMonth },
  // householdExpensesMonthly and existingEmiMonthly deliberately unanswered,
  // so the DEF-01 and DEF-03 defaults fire and announce themselves.

  creditScore: unknown,
}

// =====================================================================
// Ravi - 42, shopkeeper, wants 15 lakh unsecured for the business
//
// Takes about 55,000 a month over the counter and declares 4.2 lakh a
// year. INC-12 is what bites: a lender counts the declared figure. His
// wife earns 18,000 with no paperwork, which counts for the household
// and not for the lender. He owns the shop premises outright.
// =====================================================================
const ravi: BorrowerAnswers = {
  productType: v('business_unsecured'),
  loanPurpose: v('productive'),
  requestedAmount: { value: 1_500_000 as Rupees },

  age: { value: 42 as Years },
  cityTier: v('tier2'),
  dependents: { value: 3 as Count },
  employmentType: v('self_employed_cash'),
  timeInCurrentWork: { value: 120 as Months },

  cashIncomeMonthly: { value: 55_000 as RupeesPerMonth },
  itrIncomeAnnual: { value: 420_000 as RupeesPerYear },
  incomeProof: v('itr'),
  incomeStability: v('seasonal'),

  hasCoApplicant: v(true),
  coApplicantIncomeMonthly: { value: 18_000 as RupeesPerMonth },
  coApplicantIncomeProof: v('none'),
  coApplicantEmploymentType: v('salaried_informal'),

  // The property is the shop, not the home, so rent is stated rather than
  // inferred to nothing from owning something.
  rentMonthly: { value: 6_000 as RupeesPerMonth },
  existingEmiMonthly: { value: 8_000 as RupeesPerMonth },

  propertyValue: { value: 4_000_000 as Rupees },
  propertyKind: v('commercial'),
  propertyTitleClear: v(true),

  creditScore: { value: 720 as CreditScore },
  repaymentHistory: v('clean'),

  incrementalEarningMonthly: { value: 22_000 as RupeesPerMonth },
  incrementalEarningAlreadyHappening: v(false),
}

// =====================================================================
// Anita - delivery rider, wants an electric scooter, owes a local lender
//
// The scooter is the loan she asked about. The 80,000 at 3% a month is
// the thing actually costing her money, and REF-09 says that is what the
// answer should lead with.
// =====================================================================
const anita: BorrowerAnswers = {
  productType: v('two_wheeler_ev'),
  loanPurpose: v('productive'),
  requestedAmount: { value: 110_000 as Rupees },

  age: { value: 31 as Years },
  cityTier: v('tier2'),
  dependents: { value: 1 as Count },
  employmentType: v('daily_wage'),
  timeInCurrentWork: { value: 18 as Months },

  cashIncomeMonthly: range(27_000 as RupeesPerMonth, 35_000 as RupeesPerMonth),
  incomeProof: v('bank_statements_only'),
  incomeStability: v('volatile'),

  rentMonthly: { value: 6_000 as RupeesPerMonth },
  savingsBuffer: { value: 0 as Rupees },

  informalDebtOutstanding: { value: 80_000 as Rupees },
  informalDebtRateMonthly: { value: 3 as MonthlyRatePct },
  creditCardOutstanding: { value: 18_000 as Rupees },

  hasCreditHistory: v(false),

  vehicleOnRoadPrice: { value: 125_000 as Rupees },
  downPaymentAvailable: { value: 15_000 as Rupees },

  incrementalEarningMonthly: { value: 12_000 as RupeesPerMonth },
  incrementalEarningAlreadyHappening: v(true),
}

// =====================================================================
// Printing
// =====================================================================

const W = 78
const rule = (ch = '-') => ch.repeat(W)

function heading(text: string): void {
  console.log('\n' + rule('='))
  console.log('  ' + text.toUpperCase())
  console.log(rule('='))
}

function section(text: string): void {
  console.log('\n' + text)
  console.log(rule())
}

function wrap(text: string, indent = 4): string {
  const width = W - indent
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width) {
      lines.push(line.trim())
      line = word
    } else {
      line += ' ' + word
    }
  }
  if (line.trim()) lines.push(line.trim())
  return lines.map((l) => ' '.repeat(indent) + l).join('\n')
}

function reasons(list: Array<{ text: string; drivenBy: readonly string[] }>): void {
  for (const r of list) {
    console.log(wrap('· ' + r.text, 2))
    if (r.drivenBy.length > 0) {
      console.log(wrap('driven by: ' + r.drivenBy.join(', '), 6))
    }
  }
}

function run(name: string, answers: BorrowerAnswers): void {
  const { result, trace } = computeWithTrace(answers)

  heading(name)

  // --- O1 -------------------------------------------------------------
  section('O1  VERDICT')
  console.log(`  ${result.verdict.value.toUpperCase().replace(/_/g, ' ')}   (confidence: ${result.verdict.confidence})`)
  if (trace.verdict.passingAmountInr !== null) {
    console.log(`  amount that does pass: ${rupees(trace.verdict.passingAmountInr)}`)
  }
  console.log()
  reasons(result.verdict.reasons)

  // --- income ----------------------------------------------------------
  section('INCOME  recognised vs reliable')
  console.log(`  a lender recognises   ${rupees(trace.income.recognisedLenderIncomeMonthly)} / month`)
  console.log(`  the household has     ${rupees(trace.income.reliableSafetyIncomeMonthly)} / month`)
  console.log()
  reasons(trace.income.reasons)

  // --- routing ---------------------------------------------------------
  section('PRODUCT ROUTING')
  trace.ranking.ranked.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${bareLabel(r.product)} — up to ${rupees(r.maxAmountInr)} at ${percent((r.aprBand.low + r.aprBand.high) / 2)} all-in, ${monthsText(r.tenureMonths)}${r.meetsRequest ? '' : '  [short of the request]'}`,
    )
    if (r.demotionReason) console.log(wrap(r.demotionReason.text, 6))
  })
  for (const ex of trace.ranking.excluded) {
    console.log(wrap('✕ ' + ex.reason.text, 2))
  }
  if (trace.ranking.overrodeStatedPreference) {
    console.log()
    reasons(trace.ranking.reasons)
  }

  // --- O2 --------------------------------------------------------------
  section('O2  HOW MUCH')
  const m = result.maxAmount
  console.log(`  a lender would likely offer   ${rupees(m.lenderLikely.band.low)} – ${rupees(m.lenderLikely.band.high)}`)
  console.log(`  your household can carry      ${rupees(m.borrowerSafe.band.low)} – ${rupees(m.borrowerSafe.band.high)}`)
  console.log(`  use which                     ${m.useWhich}`)
  console.log()
  console.log(wrap('· ' + m.useWhichReason.text, 2))
  console.log(wrap('driven by: ' + m.useWhichReason.drivenBy.join(', '), 6))

  // --- O3 --------------------------------------------------------------
  section('O3  WHAT IT SHOULD COST')
  console.log(`  all-in APR   ${percent(result.fairRate.band.low)} – ${percent(result.fairRate.band.high)}   (confidence: ${result.fairRate.confidence})`)
  if (trace.pricing) {
    console.log(`  headline rate ${percent(trace.pricing.rateBand.low)} – ${percent(trace.pricing.rateBand.high)}, credit tier: ${trace.pricing.creditTier}`)
  }
  console.log()
  reasons(result.fairRate.reasons)

  // --- O4 --------------------------------------------------------------
  section('O4  WHAT YOU CAN AFFORD MONTHLY')
  console.log(`  safe carry ${rupees(result.emiCeiling.band.low)}  →  lender ceiling ${rupees(result.emiCeiling.band.high)}`)
  console.log(`  tenure ${monthsText(trace.tenureMonths)}, capped by: ${trace.tenureCappedBy}`)
  if (trace.stress) {
    console.log(`  stress case: ${trace.stress.passes ? 'PASSES' : 'FAILS'}`)
  }
  if (trace.tenureOptions.length > 0) {
    console.log('\n  term        instalment     total interest')
    for (const o of trace.tenureOptions) {
      console.log(
        `  ${monthsText(o.tenureMonths).padEnd(10)}  ${rupees(o.emi).padStart(10)}  ${rupees(o.totalInterest).padStart(15)}`,
      )
    }
  }
  console.log()
  reasons(result.emiCeiling.reasons)

  // --- refinance -------------------------------------------------------
  if (result.refinance) {
    section('REFINANCE  what you already owe')
    const r = result.refinance
    console.log(`  verdict            ${r.worthIt.value}`)
    console.log(`  monthly change     ${rupees(r.monthlySaving.band.low)}`)
    console.log(`  total saving       ${rupees(r.totalSavingOverTenure.band.low)}`)
    console.log(`  switching cost     ${rupees(r.switchingCost.band.low)}`)
    console.log(`  break-even         month ${Math.round(r.breakEven.band.low)}`)
    console.log()
    reasons(trace.refinance.reasons)
  }

  // --- actions ---------------------------------------------------------
  section(`ACTIONS  (${result.actions.length})`)
  result.actions.forEach((a, i) => {
    console.log(`  ${i + 1}. [${a.timeframe}] ${a.text}`)
    console.log(wrap('→ ' + a.changesWhat, 6))
    console.log()
  })
}

// =====================================================================
// --compare : must-questions only, against everything answered
//
// The claim being tested is that answering a question can only ever narrow
// a band, never widen one. If that fails, the widening table is doing
// something other than what it says it does.
// =====================================================================

/**
 * The opening questions - what the tool would ask before it could say
 * anything at all. Prompt 5 builds the real question graph and will own
 * this list; until then it lives here so the comparison has something to
 * compare against.
 */
const MUST_FIELDS: AnswerFieldId[] = [
  'productType',
  'loanPurpose',
  'requestedAmount',
  'age',
  'cityTier',
  'employmentType',
  'incomeProof',
  'salariedNetIncomeMonthly',
  'cashIncomeMonthly',
]

function mustOnly(answers: BorrowerAnswers): BorrowerAnswers {
  const out: Record<string, unknown> = {}
  for (const field of MUST_FIELDS) {
    if (answers[field] !== undefined) out[field] = answers[field]
  }
  return out as BorrowerAnswers
}

type BandRow = { label: string; low: number; high: number; isRate: boolean }

function bandsOf(answers: BorrowerAnswers): BandRow[] {
  const { result } = computeWithTrace(answers)
  return [
    {
      label: 'maxAmount.lenderLikely',
      low: result.maxAmount.lenderLikely.band.low as number,
      high: result.maxAmount.lenderLikely.band.high as number,
      isRate: false,
    },
    {
      label: 'maxAmount.borrowerSafe',
      low: result.maxAmount.borrowerSafe.band.low as number,
      high: result.maxAmount.borrowerSafe.band.high as number,
      isRate: false,
    },
    {
      label: 'fairRate (all-in APR)',
      low: result.fairRate.band.low as number,
      high: result.fairRate.band.high as number,
      isRate: true,
    },
    {
      label: 'emiCeiling',
      low: result.emiCeiling.band.low as number,
      high: result.emiCeiling.band.high as number,
      isRate: false,
    },
  ]
}

/**
 * CONF-01's own metric: span over midpoint.
 *
 * The test is on relative width rather than absolute, because absolute width
 * has to grow with the size of the number. A borrower whose safe amount moves
 * from nothing to two lakh gets a wider rupee span around it and is not
 * thereby less understood. What must never get worse is how much of the
 * number is uncertainty, and that is what this measures.
 */
function relWidth(b: BandRow): number {
  const centre = (b.low + b.high) / 2
  if (centre === 0) return b.high === b.low ? 0 : Number.POSITIVE_INFINITY
  return Math.abs(b.high - b.low) / Math.abs(centre)
}

function compare(name: string, answers: BorrowerAnswers): boolean {
  const partial = mustOnly(answers)
  const before = bandsOf(partial)
  const after = bandsOf(answers)
  const t0 = computeWithTrace(partial).trace
  const t1 = computeWithTrace(answers).trace

  heading(name + ' - must-questions only, then everything')
  console.log(
    '  widening applied    maxAmount %s -> %s    fairRate %s -> %s    emiCeiling %s -> %s',
    percent(t0.widening.maxAmount * 100, 0),
    percent(t1.widening.maxAmount * 100, 0),
    percent(t0.widening.fairRate * 100, 0),
    percent(t1.widening.fairRate * 100, 0),
    percent(t0.widening.emiCeiling * 100, 0),
    percent(t1.widening.emiCeiling * 100, 0),
  )
  console.log('  credit tier         %s -> %s', t0.pricing?.creditTier ?? '-', t1.pricing?.creditTier ?? '-')
  console.log('  routed product      %s -> %s', t0.ranking.routedProduct ?? '-', t1.ranking.routedProduct ?? '-')
  console.log()
  console.log('  band                        must-only            answered      uncertainty')
  console.log('  ' + rule().slice(2))

  let allNarrow = true
  before.forEach((b, i) => {
    const a = after[i]!
    const fmt = (x: number) => (b.isRate ? percent(x) : rupees(x))
    const ok = relWidth(a) <= relWidth(b) + 1e-9
    if (!ok) allNarrow = false
    console.log(
      '  %s %s %s %s',
      b.label.padEnd(24),
      (fmt(b.low) + '-' + fmt(b.high)).padStart(20),
      (fmt(a.low) + '-' + fmt(a.high)).padStart(20),
      (ok ? 'narrows' : 'WIDENS').padStart(12),
    )
    console.log(
      '  %s %s %s',
      ''.padEnd(24),
      ('+/-' + (relWidth(b) * 50).toFixed(0) + '% of centre').padStart(20),
      ('+/-' + (relWidth(a) * 50).toFixed(0) + '% of centre').padStart(20),
    )
  })
  console.log()
  console.log(
    '  ' +
      (allNarrow
        ? 'PASS - no band grew more uncertain as answers were added'
        : 'FAIL - a band grew more uncertain'),
  )
  return allNarrow
}

if (process.argv.slice(2).includes('--compare')) {
  const results = [compare('Priya', priya), compare('Ravi', ravi), compare('Anita', anita)]
  console.log()
  console.log(rule('='))
  if (results.every(Boolean)) {
    console.log('  every band narrowed or held as answers were added.')
  } else {
    console.log('  a band WIDENED when an answer was added. rule 1 is broken.')
    process.exitCode = 1
  }
  console.log(rule('='))
  console.log()
} else {
  run('Priya', priya)
  run('Ravi', ravi)
  run('Anita', anita)

  console.log()
  console.log(rule('='))
  console.log('  done')
  console.log(rule('='))
  console.log()
}
