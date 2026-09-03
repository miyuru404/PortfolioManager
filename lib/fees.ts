// Commission + regulatory levy calculations for CSE transactions.
// Brokerage commission is set per-broker (user-configured); the CSE fee,
// SEC cess, CDS fee and Share Transaction Levy are fixed by the exchange /
// regulator and apply the same way regardless of broker.

import { round } from "@/lib/utils";
import type { Broker, MarketFees } from "@/types";

// Standard CSE retail rates as of 2025 (see SETUP-COMMISSION.md for sources).
// Editable per user in Settings since regulators do revise these occasionally.
export const DEFAULT_MARKET_FEES: MarketFees = {
  cse_fee_pct: 0.084,
  sec_cess_pct: 0.072,
  cds_fee_pct: 0.024,
  share_transaction_levy_pct: 0.300,
};

export const DEFAULT_COMMISSION_RATE = 0.64; // % — typical CSE retail brokerage rate

export interface FeeBreakdown {
  tradeValue: number;
  commission: number;
  cseFee: number;
  secCess: number;
  cdsFee: number;
  shareTransactionLevy: number;
  totalLevies: number;
  totalFees: number;
  netBuyCost: number;      // what you actually pay when buying (tradeValue + fees)
  netSellProceeds: number; // what you actually receive when selling (tradeValue - fees)
}

/**
 * Computes commission + regulatory levies for a trade.
 * `broker` is null when the user hasn't picked one — commission is then 0
 * but the fixed exchange levies still apply.
 */
export function calculateFees(
  tradeValue: number,
  broker: Pick<Broker, "commission_rate" | "min_fee"> | null,
  marketFees: MarketFees = DEFAULT_MARKET_FEES
): FeeBreakdown {
  const rawCommission = broker ? tradeValue * (broker.commission_rate / 100) : 0;
  const commission = broker && tradeValue > 0 ? Math.max(rawCommission, broker.min_fee || 0) : 0;

  const cseFee = tradeValue * (marketFees.cse_fee_pct / 100);
  const secCess = tradeValue * (marketFees.sec_cess_pct / 100);
  const cdsFee = tradeValue * (marketFees.cds_fee_pct / 100);
  const shareTransactionLevy = tradeValue * (marketFees.share_transaction_levy_pct / 100);
  const totalLevies = cseFee + secCess + cdsFee + shareTransactionLevy;
  const totalFees = commission + totalLevies;

  return {
    tradeValue: round(tradeValue, 2),
    commission: round(commission, 2),
    cseFee: round(cseFee, 2),
    secCess: round(secCess, 2),
    cdsFee: round(cdsFee, 2),
    shareTransactionLevy: round(shareTransactionLevy, 2),
    totalLevies: round(totalLevies, 2),
    totalFees: round(totalFees, 2),
    netBuyCost: round(tradeValue + totalFees, 2),
    netSellProceeds: round(tradeValue - totalFees, 2),
  };
}
