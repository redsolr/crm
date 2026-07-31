/**
 * Canonical cents → currency-string formatters. Every API surface that
 * ships money uses `*_cents: number` (the currency's MINOR unit), and
 * every UI surface that renders it lands here.
 *
 * Two currencies flow through the app (THB-first pricing,
 * platform docs/platform/seat-based-pricing-2026-07-06.md § Currency):
 *
 * - **Catalog / subscription money** (`seat_price_*_cents`,
 *   `price_cents`) is denominated in the plan row's `currency`
 *   (ISO 4217 — 'THB' today, satang on the wire). Format it with
 *   `formatSeatPrice(cents, currency)`.
 * - **Metering money** (budgets, windows, spend rollups,
 *   `seat_monthly_llm_budget_cents`) is ALWAYS USD cents regardless of
 *   the plan currency — provider costs are USD-denominated. Format it
 *   with `formatCurrency(cents)`; never thread the plan currency in.
 */

/**
 * Seat/subscription price formatter — currency comes from the wire
 * (`plan.currency` / `subscription.currency`), amount is that
 * currency's minor unit. Whole amounts drop the decimals
 * (`formatSeatPrice(89000, 'THB')` → "฿890",
 * `formatSeatPrice(890000, 'THB')` → "฿8,900",
 * `formatSeatPrice(1250, 'USD')` → "$12.50"). `narrowSymbol` renders
 * "฿" instead of en-US's verbose "THB" code.
 */
export function formatSeatPrice(cents: number, currency: string): string {
  const major = cents / 100;
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(major);
}

/**
 * USD metering formatter — usage budgets, window caps, and spend
 * rollups are metered in USD cents no matter what the subscription
 * bills in. Always two decimals ("$12.50", "$100.00").
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Pipeline money formatter — CRM deal values (`value_estimate` and its
 * rollups) are THB in MAJOR units (the attribute is "Value Estimate
 * (THB/yr)"), not cents. Rendering them with "$" misstated every deal
 * by the exchange rate; every pipeline surface lands here instead.
 * Whole baht, no decimals ("฿300,000").
 */
export function formatTHB(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}
