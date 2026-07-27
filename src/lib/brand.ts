/** Single source of truth for brand identity.
 *
 * crm-web is the company's INTERNAL CRM (ADR-001, platform docs:
 * adr-001-crm-internal-product-2026-07-13.md). It is not customer-facing
 * and carries no marketing/SEO surface — this file exists because the
 * app shell, manifest, and metadata read from it, not for positioning.
 */

export const BRAND = {
  name: "CRM",
  tagline: "Internal CRM",
  title: "CRM",
  titleFull: "CRM — internal operating layer",

  description: "Internal CRM — pipeline, discovery, and customer memory.",
  descriptionLong:
    "The company's internal CRM: sales pipeline, customer discovery, and institutional memory across products. Not customer-facing.",

  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100",
  twitter: "",

  colors: {
    bg: "#212121",
    bgDeep: "#1a1a2e",
    bgDarkest: "#0a0a0a",
    text: "#ffffff",
    textMuted: "#a0a0b0",
  },
} as const;

export const BRAND_KEYWORDS = [] as const;

export const BRAND_FEATURES = [] as const;
