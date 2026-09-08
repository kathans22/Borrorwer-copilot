/**
 * Which product this borrower should actually be looking at.
 *
 * The borrower usually arrives naming one. Often it is the wrong one - a
 * shopkeeper who owns his premises asking about unsecured business credit is
 * the standard case, and he is asking for the dearest product he is eligible
 * for because it is the one he has been offered.
 *
 * Routing may override that (RTE-01), but never quietly. When it does, it has
 * to produce the comparison in the borrower's own numbers: the rate
 * difference, the amount difference, and what they give up (RTE-03). The
 * product they asked for stays in the ranking with its own figures (RTE-04).
 *
 * This module takes each product's economics as an input rather than
 * computing them, so it stays a ranking decision and nothing else.
 */

import {
  PRODUCTS,
  REROUTE_TRADE_OFFS,
  ROUTING_MAY_OVERRIDE_STATED_PRODUCT,
  ROUTING_TRIGGER,
  type ConstraintId,
  type SupportedProduct,
} from '../rules/rules.config'
import type {
  AnswerFieldId,
  Band,
  BorrowerAnswers,
  ProductType,
  Reason,
} from '../types'
import { percent, reason, rupees } from './format'
import { readChoice, readNumeric } from './resolve'
import type { IncomeAssessment } from './incomeAssessment'

/** What each product can do for this borrower, computed elsewhere. */
export type ProductOffer = {
  product: SupportedProduct
  /** Largest amount this product can actually deliver to this borrower. */
  maxAmountInr: number
  /** What held that amount down. */
  limitedBy: 'income' | 'collateral' | 'ticket_floor' | 'ticket_ceiling'
  rateBand: Band<number>
  aprBand: Band<number>
  tenureMonths: number
  /** False when the age cap leaves less than the product's minimum tenure. */
  tenureAvailable: boolean
  /** False when credit standing closes unsecured lending (CRD-05, CRD-12). */
  unsecuredAvailable: boolean
}

export type RankedProduct = ProductOffer & {
  meetsRequest: boolean
  /** Set on every product below the top one. */
  demotionReason: Reason | null
}

export type Exclusion = {
  product: SupportedProduct
  reason: Reason
}

export type ProductRanking = {
  ranked: RankedProduct[]
  excluded: Exclusion[]
  statedProduct: ProductType | null
  /** The product the engine leads with, or null when nothing is eligible. */
  routedProduct: SupportedProduct | null
  /** True when routing led with something other than what was asked for. */
  overrodeStatedPreference: boolean
  reasons: Reason[]
  wouldNarrow: AnswerFieldId[]
  constraints: ConstraintId[]
}

const SECURED: SupportedProduct[] = ['lap', 'two_wheeler_ev']

function midRate(band: Band<number>): number {
  return (band.low + band.high) / 2
}

/**
 * Preconditions that are not about money (PRD-01 to PRD-04). Returns the
 * reason the product is unavailable, or null when it is available.
 */
function precondition(
  answers: BorrowerAnswers,
  product: SupportedProduct,
  income: IncomeAssessment,
): { text: string; drivenBy: AnswerFieldId[] } | null {
  if (product === 'lap') {
    const value = readNumeric(answers, 'propertyValue', 'income')
    if (!value?.stated || value.underwriting <= 0) {
      return {
        text: 'A loan against property needs a property. You have not told us about one.',
        drivenBy: ['propertyValue'],
      }
    }
    if (readChoice<boolean>(answers, 'propertyTitleClear') !== true) {
      return {
        text: 'A loan against property needs clear, unencumbered title. Until you confirm that, this cheaper route stays closed.',
        drivenBy: ['propertyTitleClear'],
      }
    }
  }

  const requiredMonths = PRODUCTS[product].minTradingHistoryMonths
  if (requiredMonths !== null) {
    const vintage = readNumeric(answers, 'timeInCurrentWork', 'income')
    if (vintage?.stated && vintage.underwriting < (requiredMonths as number)) {
      return {
        text: `${Label(product)} needs at least ${requiredMonths as number} months of trading history and you have ${Math.round(vintage.underwriting)}.`,
        drivenBy: ['timeInCurrentWork'],
      }
    }
  }

  if (product === 'two_wheeler_ev') {
    const price = readNumeric(answers, 'vehicleOnRoadPrice', 'income')
    if (!price?.stated || price.underwriting <= 0) {
      return {
        text: 'A vehicle loan needs a vehicle. You have not told us what you are buying.',
        drivenBy: ['vehicleOnRoadPrice'],
      }
    }
  }

  if (!SECURED.includes(product) && !income.employmentType) {
    return {
      text: 'Unsecured lending is priced on income, and we do not yet know how you earn.',
      drivenBy: ['employmentType'],
    }
  }

  return null
}

export function rankProducts(input: {
  answers: BorrowerAnswers
  income: IncomeAssessment
  offers: ProductOffer[]
  requestedAmount: number | null
}): ProductRanking {
  const { answers, income, offers, requestedAmount } = input
  const reasons: Reason[] = []
  const wouldNarrow: AnswerFieldId[] = []
  const constraints: ConstraintId[] = []
  const excluded: Exclusion[] = []
  const eligible: RankedProduct[] = []

  for (const offer of offers) {
    const rules = PRODUCTS[offer.product]

    if (!offer.tenureAvailable) {
      excluded.push({
        product: offer.product,
        reason: reason(
          `${Label(offer.product)} is not available: your age leaves less time than the shortest term a lender will write.`,
          ['age', 'employmentType'],
        ),
      })
      continue
    }

    if (!SECURED.includes(offer.product) && !offer.unsecuredAvailable) {
      excluded.push({
        product: offer.product,
        reason: reason(
          `${Label(offer.product)} is closed to you at present, because unsecured lending is not realistically available on your current credit record.`,
          ['creditScore', 'repaymentHistory', 'bouncedEmisLast12m'],
        ),
      })
      constraints.push('product_demoted_by_credit')
      continue
    }

    const floorIncome = rules.minRecognisedIncomeInrPerMonth as number
    if (income.recognisedLenderIncomeMonthly < floorIncome) {
      excluded.push({
        product: offer.product,
        reason: reason(
          `${Label(offer.product)} needs a recognised income of at least ${rupees(floorIncome)} a month and a lender currently recognises ${rupees(income.recognisedLenderIncomeMonthly)} of yours.`,
          ['incomeProof', 'employmentType', 'itrIncomeAnnual'],
        ),
      })
      continue
    }

    const pre = precondition(answers, offer.product, income)
    if (pre) {
      excluded.push({ product: offer.product, reason: reason(pre.text, pre.drivenBy) })
      wouldNarrow.push(...pre.drivenBy)
      if (offer.product === 'lap') constraints.push('property_title_unconfirmed')
      continue
    }

    if (offer.maxAmountInr < (rules.ticketSizeInr.low as number)) {
      excluded.push({
        product: offer.product,
        reason: reason(
          `${Label(offer.product)} starts at ${rupees(rules.ticketSizeInr.low as number)} and your income supports ${rupees(offer.maxAmountInr)} on it, which is below the smallest loan anybody will write.`,
          ['employmentType', 'incomeProof', 'existingEmiMonthly'],
        ),
      })
      continue
    }

    eligible.push({
      ...offer,
      meetsRequest: requestedAmount === null || offer.maxAmountInr >= requestedAmount,
      demotionReason: null,
    })
  }

  // Rank: a product that covers the request beats one that does not; then
  // the cheaper all-in cost; then the larger amount.
  eligible.sort((a, b) => {
    if (a.meetsRequest !== b.meetsRequest) return a.meetsRequest ? -1 : 1
    const cost = midRate(a.aprBand) - midRate(b.aprBand)
    if (Math.abs(cost) > 0.01) return cost
    return b.maxAmountInr - a.maxAmountInr
  })

  const top = eligible[0] ?? null

  // Say why each of the others lost, in its own numbers.
  for (const other of eligible.slice(1)) {
    other.demotionReason = reason(
      `${Label(other.product)} ranks below ${label(top!.product)}: it would cost ${percent(midRate(other.aprBand))} all-in against ${percent(midRate(top!.aprBand))}, and it supports ${rupees(other.maxAmountInr)} against ${rupees(top!.maxAmountInr)}${requestedAmount !== null && !other.meetsRequest ? `, well short of the ${rupees(requestedAmount)} you asked for` : ''}.`,
      ['productType', 'incomeProof', 'propertyValue'],
    )
  }

  // --- did routing override what they asked for? (RTE-01 to RTE-04) ----
  const statedProduct = readChoice<ProductType>(answers, 'productType')
  const statedSupported =
    statedProduct !== null && statedProduct !== 'gold' ? (statedProduct as SupportedProduct) : null

  let overrodeStatedPreference = false

  if (
    ROUTING_MAY_OVERRIDE_STATED_PRODUCT &&
    top &&
    statedSupported &&
    statedSupported !== top.product
  ) {
    const stated = eligible.find((e) => e.product === statedSupported)
    const rateSaving = stated ? midRate(stated.aprBand) - midRate(top.aprBand) : null
    const amountUplift =
      stated && stated.maxAmountInr > 0 ? top.maxAmountInr / stated.maxAmountInr : null

    const triggered =
      (rateSaving !== null && rateSaving >= (ROUTING_TRIGGER.minRateSavingPctPoints as number)) ||
      (amountUplift !== null && amountUplift >= (ROUTING_TRIGGER.minAmountUpliftRatio as number)) ||
      stated === undefined

    if (triggered) {
      overrodeStatedPreference = true

      if (stated) {
        reasons.push(
          reason(
            `You asked about ${label(statedSupported)}, but ${label(top.product)} is the better route: ${percent(midRate(top.aprBand))} all-in against ${percent(midRate(stated.aprBand))}, a difference of ${percent(rateSaving!)} a year, and ${rupees(top.maxAmountInr)} available against ${rupees(stated.maxAmountInr)} — ${rupees(top.maxAmountInr - stated.maxAmountInr)} more.`,
            ['productType', 'propertyValue', 'incomeProof'],
          ),
        )
      } else {
        reasons.push(
          reason(
            `You asked about ${label(statedSupported)}, which is not open to you at the moment, so this assessment is on ${label(top.product)} instead at ${percent(midRate(top.aprBand))} all-in for up to ${rupees(top.maxAmountInr)}.`,
            ['productType'],
          ),
        )
      }

      const tradeOff = REROUTE_TRADE_OFFS[`${statedSupported}->${top.product}`]
      if (tradeOff) {
        reasons.push(reason(`What you give up: ${tradeOff}`, ['productType', 'propertyValue']))
      }
    }
  }

  if (top === null) {
    reasons.push(
      reason(
        'No lending product is open to you on these answers. The exclusions above say why, and each one names the thing that would change it.',
        ['incomeProof', 'employmentType', 'creditScore'],
      ),
    )
  }

  return {
    ranked: eligible,
    excluded,
    statedProduct,
    routedProduct: top?.product ?? null,
    overrodeStatedPreference,
    reasons,
    wouldNarrow: [...new Set(wouldNarrow)],
    constraints: [...new Set(constraints)],
  }
}

/** Lowercase, with its article, for use inside a sentence. */
export function label(product: SupportedProduct): string {
  switch (product) {
    case 'personal':
      return 'a personal loan'
    case 'lap':
      return 'a loan against property'
    case 'business_unsecured':
      return 'an unsecured business loan'
    case 'two_wheeler_ev':
      return 'a two-wheeler loan'
  }
}

/** The same, capitalised, for the start of a sentence. */
export function Label(product: SupportedProduct): string {
  const l = label(product)
  return l.charAt(0).toUpperCase() + l.slice(1)
}

/** Just the product name, no article. */
export function bareLabel(product: SupportedProduct): string {
  return label(product).replace(/^an? /, '')
}
