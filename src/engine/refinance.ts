/**
 * The debt the borrower already has.
 *
 * For a household paying a local lender 3% a month, this module is worth more
 * than everything else in the engine put together, and the reason it exists
 * as a first-class outcome (REF-09) rather than a footnote is that the
 * arithmetic on a new loan will often say "no" to exactly the borrower whose
 * biggest available win is restructuring what they already carry.
 *
 * The comparison here is deliberately not "which monthly payment is smaller".
 * Refinancing informal debt usually costs *more* per month, because informal
 * debt is interest-only and never amortises (REF-11). The honest question is
 * which path ever ends, so costs are compared cumulatively including the
 * principal still outstanding at the end (REF-12).
 */

import {
  CREDIT_CARD_ASSUMED_ANNUAL_RATE_PCT,
  EXISTING_LOAN_ASSUMED_REMAINING_MONTHS,
  FORECLOSURE_FEE_DEFAULT_PCT,
  GST_ON_FEES_PCT,
  HIGH_COST_DEBT_THRESHOLD_ANNUAL_PCT,
  REFINANCE_WORTH_IT,
  RENEGOTIATE_WHEN_SAVING_EXISTS_BUT_BREAK_EVEN_FAILS,
  type ConstraintId,
} from '../rules/rules.config'
import type {
  AnswerFieldId,
  BorrowerAnswers,
  Confidence,
  Months,
  Reason,
  RefinanceResult,
  RefinanceVerdict,
  Rupees,
  RupeesPerMonth,
} from '../types'
import { months as monthsText, percent, reason, rupees } from './format'
import { balanceAfter, emiFor, monthlyRateToAnnualPct } from './money'
import { readNumeric } from './resolve'

export type ExistingDebt = {
  label: string
  outstanding: number
  annualRatePct: number
  /** What leaves the household each month to service it. */
  monthlyService: number
  /** False for revolving and informal debt: the balance does not come down. */
  amortising: boolean
  remainingMonths: number | null
  /** True where REF-14's assumed term was used because none was stated. */
  assumedRemainingTerm?: boolean
  drivenBy: AnswerFieldId[]
}

/** Where a refinance would go. Supplied by the caller so this module stays pure. */
export type RefinanceTarget = {
  label: string
  annualRatePct: number
  tenureMonths: number
  processingFeePct: number
  otherChargesInr: number
}

export type RefinanceAssessment = {
  debts: ExistingDebt[]
  candidates: ExistingDebt[]
  blendedBeforePct: number
  blendedAfterPct: number | null
  result: RefinanceResult | null
  reasons: Reason[]
  constraints: ConstraintId[]
}

/** Everything the borrower currently owes, at its real annual cost. */
export function collectDebts(answers: BorrowerAnswers): ExistingDebt[] {
  const debts: ExistingDebt[] = []

  const informal = readNumeric(answers, 'informalDebtOutstanding', 'cost')
  const informalRate = readNumeric(answers, 'informalDebtRateMonthly', 'cost')
  if (informal?.stated && informal.underwriting > 0 && informalRate?.stated) {
    const annual = monthlyRateToAnnualPct(informalRate.underwriting)
    debts.push({
      label: 'informal borrowing',
      outstanding: informal.underwriting,
      annualRatePct: annual,
      monthlyService: informal.underwriting * (informalRate.underwriting / 100),
      amortising: false,
      remainingMonths: null,
      drivenBy: ['informalDebtOutstanding', 'informalDebtRateMonthly'],
    })
  }

  const card = readNumeric(answers, 'creditCardOutstanding', 'cost')
  if (card?.stated && card.underwriting > 0) {
    const annual = CREDIT_CARD_ASSUMED_ANNUAL_RATE_PCT as number
    debts.push({
      label: 'a revolving card balance',
      outstanding: card.underwriting,
      annualRatePct: annual,
      monthlyService: card.underwriting * (annual / 100 / 12),
      amortising: false,
      remainingMonths: null,
      drivenBy: ['creditCardOutstanding'],
    })
  }

  const loan = readNumeric(answers, 'existingLoanOutstanding', 'cost')
  const loanRate = readNumeric(answers, 'existingLoanRate', 'cost')
  const loanEmi = readNumeric(answers, 'existingLoanEmi', 'cost')
  const loanLeft = readNumeric(answers, 'existingLoanRemainingTenure', 'cost')
  if (loan?.stated && loan.underwriting > 0 && loanRate?.stated) {
    debts.push({
      label: 'your existing loan',
      outstanding: loan.underwriting,
      annualRatePct: loanRate.underwriting,
      monthlyService: loanEmi?.stated
        ? loanEmi.underwriting
        : emiFor(
            loan.underwriting,
            loanRate.underwriting,
            loanLeft?.stated
              ? loanLeft.underwriting
              : (EXISTING_LOAN_ASSUMED_REMAINING_MONTHS as number),
          ),
      amortising: true,
      remainingMonths: loanLeft?.stated ? loanLeft.underwriting : null,
      assumedRemainingTerm: !loanLeft?.stated,
      drivenBy: ['existingLoanOutstanding', 'existingLoanRate', 'existingLoanEmi'],
    })
  }

  return debts
}

/** REF-03. Outstanding-weighted, so a small cheap loan cannot hide a big dear one. */
export function blendedRate(debts: ExistingDebt[]): number {
  const total = debts.reduce((s, d) => s + d.outstanding, 0)
  if (total === 0) return 0
  return debts.reduce((s, d) => s + d.outstanding * d.annualRatePct, 0) / total
}

/** Cost of staying on a debt for `m` months, including what is still owed at the end. */
function costOfStaying(debts: ExistingDebt[], m: number): number {
  return debts.reduce((sum, d) => {
    const paid = d.monthlyService * m
    const residual = d.amortising
      ? balanceAfter(
          d.outstanding,
          d.annualRatePct,
          d.remainingMonths ?? (EXISTING_LOAN_ASSUMED_REMAINING_MONTHS as number),
          m,
        )
      : d.outstanding
    return sum + paid + residual
  }, 0)
}

export function assessRefinance(
  answers: BorrowerAnswers,
  target: RefinanceTarget | null,
): RefinanceAssessment {
  const reasons: Reason[] = []
  const constraints: ConstraintId[] = []
  const debts = collectDebts(answers)
  const blendedBeforePct = blendedRate(debts)

  const threshold = HIGH_COST_DEBT_THRESHOLD_ANNUAL_PCT as number
  const candidates = debts.filter((d) => d.annualRatePct > threshold)

  if (candidates.length === 0 || target === null) {
    if (candidates.length > 0) {
      reasons.push(
        reason(
          `You are paying ${percent(blendedRate(candidates))} a year on ${rupees(candidates.reduce((s, d) => s + d.outstanding, 0))} of borrowing, which is well above the ${percent(threshold)} mark — but nothing we can price for you today would replace it.`,
          candidates.flatMap((d) => d.drivenBy),
        ),
      )
      constraints.push('high_cost_debt_present')
    }
    return { debts, candidates, blendedBeforePct, blendedAfterPct: null, result: null, reasons, constraints }
  }

  constraints.push('high_cost_debt_present')

  // REF-14 - an assumed term is an assumption, and DEF-21 says no assumption
  // reaches a number without reaching the borrower too.
  const assumedTerm = debts.find((d) => d.assumedRemainingTerm)
  if (assumedTerm) {
    reasons.push(
      reason(
        `You have not said how long is left on your existing loan, so we have worked on about ${monthsText(EXISTING_LOAN_ASSUMED_REMAINING_MONTHS as number)} remaining. Telling us the real figure changes whether switching is worth it.`,
        ['existingLoanRemainingTenure'],
      ),
    )
  }

  const candidateOutstanding = candidates.reduce((s, d) => s + d.outstanding, 0)
  const candidateMonthly = candidates.reduce((s, d) => s + d.monthlyService, 0)
  const candidateRate = blendedRate(candidates)

  // REF-04/05 - the cost of getting out of what you have.
  const foreclosure = candidates.reduce((s, d) => {
    const feePct = d.amortising ? (FORECLOSURE_FEE_DEFAULT_PCT.fixed as number) : 0
    return s + d.outstanding * (feePct / 100)
  }, 0)

  // The new loan's fee comes out of the disbursal, so the borrower has to
  // borrow enough that what lands clears the old debt.
  const gst = 1 + (GST_ON_FEES_PCT as number) / 100
  const feeRate = (target.processingFeePct / 100) * gst
  const required = candidateOutstanding + foreclosure
  const newPrincipal = (required + target.otherChargesInr * gst) / (1 - feeRate)
  const newFees = newPrincipal - required
  const switchingCost = foreclosure + newFees

  const newEmi = emiFor(newPrincipal, target.annualRatePct, target.tenureMonths)
  const monthlySaving = candidateMonthly - newEmi

  // REF-12 - walk the two cumulative paths.
  let breakEvenMonths: number | null = null
  for (let m = 1; m <= target.tenureMonths; m++) {
    const stay = costOfStaying(candidates, m)
    const move =
      newEmi * m + balanceAfter(newPrincipal, target.annualRatePct, target.tenureMonths, m)
    if (move <= stay) {
      breakEvenMonths = m
      break
    }
  }

  const totalSaving =
    costOfStaying(candidates, target.tenureMonths) - newEmi * target.tenureMonths

  const rateReduction = candidateRate - target.annualRatePct
  const breakEvenOk =
    breakEvenMonths !== null &&
    breakEvenMonths <= (REFINANCE_WORTH_IT.maxBreakEvenMonths as number) &&
    breakEvenMonths <=
      target.tenureMonths * (REFINANCE_WORTH_IT.maxBreakEvenAsShareOfRemainingTenure as number)
  const rateOk = rateReduction >= (REFINANCE_WORTH_IT.minBlendedRateReductionPctPoints as number)

  const verdict: RefinanceVerdict =
    rateOk && breakEvenOk
      ? 'refinance'
      : rateOk && RENEGOTIATE_WHEN_SAVING_EXISTS_BUT_BREAK_EVEN_FAILS
        ? 'renegotiate_existing'
        : 'stay'

  const remaining = debts.filter((d) => !candidates.includes(d))
  const blendedAfterPct = blendedRate([
    ...remaining,
    {
      label: target.label,
      outstanding: newPrincipal,
      annualRatePct: target.annualRatePct,
      monthlyService: newEmi,
      amortising: true,
      remainingMonths: target.tenureMonths,
      drivenBy: [],
    },
  ])

  const drivenBy = [...new Set(candidates.flatMap((d) => d.drivenBy))]

  const headline = reason(
    `You owe ${rupees(candidateOutstanding)} at ${percent(candidateRate)} a year. Moving it to ${target.label} at ${percent(target.annualRatePct)} over ${monthsText(target.tenureMonths)} would cost you ${rupees(newEmi)} a month instead of ${rupees(candidateMonthly)}, and would save ${rupees(totalSaving)} in total.`,
    drivenBy,
  )
  reasons.push(headline)

  if (monthlySaving < 0) {
    reasons.push(
      reason(
        `Note that this costs ${rupees(-monthlySaving)} a month more, not less. The ${rupees(candidateMonthly)} you pay now is interest only — it never reduces what you owe, so you would still owe ${rupees(candidateOutstanding)} in ${monthsText(target.tenureMonths)}. The refinanced loan ends.`,
        drivenBy,
      ),
    )
  }

  if (verdict === 'renegotiate_existing') {
    reasons.push(
      reason(
        'The saving is real but the switching cost takes too long to earn back, so take this comparison to your existing lender and ask them to match it. That costs nothing.',
        drivenBy,
      ),
    )
  }

  const confidence: Confidence = 'medium'
  const point = <T extends number>(n: number) => ({ low: n as T, high: n as T })

  const result: RefinanceResult = {
    worthIt: {
      value: verdict,
      confidence,
      reasons: [headline],
      wouldNarrow: ['existingLoanForeclosureFee', 'informalDebtRateMonthly'],
    },
    monthlySaving: {
      band: point<RupeesPerMonth>(monthlySaving),
      confidence,
      reasons: [
        reason(
          monthlySaving >= 0
            ? `${rupees(monthlySaving)} a month less than you pay now.`
            : `${rupees(-monthlySaving)} a month more than you pay now, in exchange for the debt actually ending.`,
          drivenBy,
        ),
      ],
      wouldNarrow: ['informalDebtRateMonthly'],
    },
    totalSavingOverTenure: {
      band: point<Rupees>(totalSaving),
      confidence,
      reasons: [
        reason(
          `Over ${monthsText(target.tenureMonths)}, staying costs ${rupees(costOfStaying(candidates, target.tenureMonths))} including what you would still owe at the end. Switching costs ${rupees(newEmi * target.tenureMonths)} and clears it.`,
          drivenBy,
        ),
      ],
      wouldNarrow: ['informalDebtOutstanding'],
    },
    switchingCost: {
      band: point<Rupees>(switchingCost),
      confidence,
      reasons: [
        reason(
          `${rupees(switchingCost)} to make the switch: ${rupees(foreclosure)} to close what you have and ${rupees(newFees)} in fees and GST on the new loan.`,
          ['existingLoanForeclosureFee'],
        ),
      ],
      wouldNarrow: ['existingLoanForeclosureFee'],
    },
    breakEven: {
      band: point<Months>(breakEvenMonths ?? target.tenureMonths),
      confidence,
      reasons: [
        reason(
          breakEvenMonths === null
            ? 'This does not pay for itself within the term.'
            : `You are ahead from month ${breakEvenMonths}.`,
          drivenBy,
        ),
      ],
      wouldNarrow: ['existingLoanForeclosureFee'],
    },
  }

  return { debts, candidates, blendedBeforePct, blendedAfterPct, result, reasons, constraints }
}
