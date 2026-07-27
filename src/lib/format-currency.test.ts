/**
 * Behavioral coverage for the money formatters — the THB-first pricing
 * promises (platform docs/platform/seat-based-pricing-2026-07-06.md
 * § Currency):
 *
 * 1. Seat prices render in the PLAN currency with the baht symbol —
 *    "฿890", never "$890".
 * 2. Amounts are the currency's MINOR unit (satang): 89000 must render
 *    "฿890", NOT "฿89,000" (the minor-unit bug this file exists to
 *    catch).
 * 3. Metering money stays USD regardless of the plan currency.
 */
import { formatCurrency, formatSeatPrice } from "./format-currency";

describe("formatSeatPrice", () => {
  it("renders the seeded THB monthly seat price as ฿890", () => {
    expect(formatSeatPrice(89000, "THB")).toBe("฿890");
  });

  it("renders the seeded THB yearly seat price as ฿8,900 (grouped)", () => {
    expect(formatSeatPrice(890000, "THB")).toBe("฿8,900");
  });

  it("multiplies in minor units without drift (3 seats × ฿890)", () => {
    expect(formatSeatPrice(3 * 89000, "THB")).toBe("฿2,670");
  });

  it("never renders the raw satang amount as whole baht", () => {
    // The minor-unit trap: treating 89000 satang as ฿89,000.
    expect(formatSeatPrice(89000, "THB")).not.toBe("฿89,000");
  });

  it("uses the wire currency — THB is ฿, not $", () => {
    expect(formatSeatPrice(89000, "THB")).not.toContain("$");
    expect(formatSeatPrice(89000, "THB").startsWith("฿")).toBe(true);
  });

  it("accepts lowercase ISO codes off the wire", () => {
    expect(formatSeatPrice(89000, "thb")).toBe("฿890");
  });

  it("formats USD metering money with $ and drops decimals when whole", () => {
    expect(formatSeatPrice(1500, "USD")).toBe("$15");
    expect(formatSeatPrice(45 * 100, "USD")).toBe("$45");
  });

  it("keeps two decimals for non-whole amounts", () => {
    expect(formatSeatPrice(1250, "USD")).toBe("$12.50");
    expect(formatSeatPrice(74166, "THB")).toBe("฿741.66");
  });

  it("renders zero in the plan currency", () => {
    expect(formatSeatPrice(0, "THB")).toBe("฿0");
  });
});

describe("formatCurrency (USD metering)", () => {
  it("is always USD with two decimals — budgets never adopt the plan currency", () => {
    expect(formatCurrency(10_000)).toBe("$100.00");
    expect(formatCurrency(542)).toBe("$5.42");
  });
});
