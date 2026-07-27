/**
 * Dictionary shape for marketing copy. Both `dictionaries/en.ts` and
 * `dictionaries/th.ts` must `satisfies Dictionary` — a missing or extra key
 * in either locale is a compile error, so the tsc DoD gate enforces parity.
 */

export interface DictionaryFeatureItem {
  title: string;
  text: string;
}

export interface DictionaryFaqItem {
  question: string;
  answer: string;
}

export interface Dictionary {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    plans: string;
    roadmap: string;
    about: string;
    docs: string;
    signIn: string;
    getStarted: string;
    languageLabel: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    cta: string;
    secondaryCta: string;
    note: string;
  };
  credibility: {
    items: DictionaryFeatureItem[];
  };
  features: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: DictionaryFeatureItem[];
  };
  industries: {
    eyebrow: string;
    title: string;
    items: DictionaryFeatureItem[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    /** Unit label next to the seat price, e.g. "per lawyer / month". */
    perLawyerMonth: string;
    /**
     * Suffix after the YEARLY seat price (฿8,900 today), e.g.
     * "/year — 2 months free · minimum 1 seat". Yearly is marketed as
     * "2 months free", never a percent (THB-first pricing doc § Currency).
     */
    annualNote: string;
    /** Link to the full pricing page. */
    detailsLink: string;
    /** Primary CTA — demo-led GTM, always "Request a demo". */
    getStarted: string;
    loadError: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: DictionaryFaqItem[];
  };
  closing: {
    title: string;
    subtitle: string;
    cta: string;
  };
  demoRequest: {
    title: string;
    subtitle: string;
    nameLabel: string;
    firmLabel: string;
    emailLabel: string;
    emailHint: string;
    firmSizeLabel: string;
    firmSizeOptions: { solo: string; small: string; medium: string; large: string };
    needLabel: string;
    needPlaceholder: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
    errorGeneric: string;
    rateLimited: string;
    signInInstead: string;
    privacyNotice: string;
    privacyNoticeLinkLabel: string;
  };
  footer: {
    tagline: string;
    productHeading: string;
    companyHeading: string;
    legalHeading: string;
    links: {
      plans: string;
      roadmap: string;
      changelog: string;
      status: string;
      about: string;
      support: string;
      help: string;
      privacy: string;
      terms: string;
    };
    rights: string;
  };
}
