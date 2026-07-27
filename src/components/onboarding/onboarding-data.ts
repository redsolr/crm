export const ROLES = [
  "Software Engineer",
  "Product Manager",
  "Attorney",
  "Paralegal",
  "Researcher",
  "Student",
  "Founder / CEO",
  "Consultant",
  "Data Scientist",
  "Designer",
  "Other",
].map((r) => ({ id: r, label: r }));

export const INTERESTS = [
  { id: "code_technical", label: "Coding & technical help" },
  { id: "research_analysis", label: "Research & analysis" },
  { id: "writing", label: "Writing & editing" },
  { id: "legal", label: "Legal research" },
  { id: "project_management", label: "Project management" },
  { id: "brainstorming", label: "Brainstorming & ideation" },
  { id: "learning", label: "Learning & studying" },
  { id: "data_analysis", label: "Data analysis" },
  { id: "ai", label: "Artificial Intelligence" },
  { id: "law", label: "Law & Legal" },
  { id: "tech", label: "Tech" },
  { id: "productivity", label: "Productivity" },
  { id: "finance", label: "Finance & Accounting" },
  { id: "marketing", label: "Marketing" },
  { id: "healthcare", label: "Healthcare" },
  { id: "education", label: "Education" },
  { id: "real_estate", label: "Real Estate" },
  { id: "startups", label: "Startups" },
  { id: "crypto", label: "Crypto & Web3" },
  { id: "science", label: "Science & Research" },
  { id: "design", label: "Design & UX" },
  { id: "hr", label: "HR & People" },
  { id: "government", label: "Government & Policy" },
  { id: "sustainability", label: "Sustainability" },
];

export const RESPONSE_LENGTHS = [
  { id: "concise", label: "Concise" },
  { id: "balanced", label: "Balanced" },
  { id: "detailed", label: "Detailed" },
];

export const TONES = [
  { id: "casual", label: "Casual" },
  { id: "professional", label: "Professional" },
  { id: "formal", label: "Formal" },
];

/**
 * Onboarding form steps (rendered inside the light auth card as a carousel).
 * The dramatic Slack-style moments — the creating-workspace animation, the
 * "workspace ready" offer, and the welcome tabs — are NOT steps here: they're
 * full-screen overlays driven by `phase` in `useOnboarding`.
 *
 *   welcome  → branded entry
 *   workspace→ "Name your workspace" (creates the org → fires the animation)
 *   profile  → "What's your name?" + initials avatar
 *   invite   → "Invite your teammates" (+ Copy Link / skip-confirm modal)
 *   role     → personalization signal (kept; feeds the AI)
 *   interests→ personalization signal (kept)
 *   preferences → response length / tone (kept; final submit → offer)
 */
export type Step =
  | "welcome"
  | "workspace"
  | "profile"
  | "invite"
  | "role"
  | "interests"
  | "preferences";

export const STEPS: Step[] = [
  "welcome",
  "workspace",
  "profile",
  "invite",
  "role",
  "interests",
  "preferences",
];

export const STEP_META: Record<Step, { title: string; subtitle?: string }> = {
  welcome: {
    title: "Welcome to Jurisimus",
    subtitle: "Let’s set up your workspace in a few quick steps.",
  },
  workspace: {
    title: "Name your workspace",
    subtitle:
      "Choose something your firm will recognize — like your firm or team name. You can change it later.",
  },
  profile: {
    title: "What’s your name?",
    subtitle:
      "Adding your name helps teammates recognize you. You can add a photo later.",
  },
  invite: {
    title: "Invite your teammates",
    subtitle:
      "Jurisimus works great solo — invite your firm whenever you’re ready.",
  },
  role: {
    title: "What best describes your role?",
    subtitle:
      "Select all that apply. This helps us personalize your AI experience.",
  },
  interests: {
    title: "What are you interested in?",
    subtitle: "Select all that apply. We’ll tailor your experience.",
  },
  preferences: {
    title: "How should the AI respond?",
    subtitle: "You can change these anytime in settings.",
  },
};

// `invite` is skippable (solo lawyers); personalization steps stay skippable.
export const SKIPPABLE_STEPS: Step[] = [
  "invite",
  "role",
  "interests",
  "preferences",
];

/**
 * Welcome tabs shown after the workspace is created — the 3 Slack-parity
 * cards plus 4 lawyer-specific cards (all picked). Each is a self-contained
 * hero slide in the final welcome carousel.
 */
export interface WelcomeTab {
  id: string;
  emoji: string;
  /** Accent gradient endpoints for the hero panel. */
  from: string;
  to: string;
  title: string;
  body: string;
}

export const WELCOME_TABS: WelcomeTab[] = [
  {
    id: "channels",
    emoji: "💬",
    from: "#FF385C",
    to: "#D70466",
    title: "Organize work in channels",
    body: "Keep every matter, team, and topic in a focused channel — not scattered across inboxes and chat threads.",
  },
  {
    id: "team",
    emoji: "🤝",
    from: "#7C3AED",
    to: "#4F46E5",
    title: "Bring your team together",
    body: "Message colleagues, share files, and make decisions together — all in one place your whole firm can see.",
  },
  {
    id: "ai",
    emoji: "✨",
    from: "#3B82F6",
    to: "#06B6D4",
    title: "Get more done with AI",
    body: "Draft, summarize, and research with an assistant that already knows your matters and your firm’s work.",
  },
  {
    id: "draft",
    emoji: "✍️",
    from: "#0EA5E9",
    to: "#10B981",
    title: "Draft & review with AI",
    body: "Generate and redline contracts and filings, grounded in Thai law — with track changes you can export to Word.",
  },
  {
    id: "matter",
    emoji: "📁",
    from: "#F59E0B",
    to: "#EF4444",
    title: "Turn intake into action",
    body: "Create a Matter straight from a client message and watch the chaos become organized, trackable legal work.",
  },
  {
    id: "trust",
    emoji: "🛡️",
    from: "#10B981",
    to: "#0D9488",
    title: "Answers you can trust",
    body: "Every citation is checked. When the law is unclear, Jurisimus tells you — instead of guessing.",
  },
  {
    id: "solo",
    emoji: "⚖️",
    from: "#EC4899",
    to: "#8B5CF6",
    title: "Built for solo lawyers too",
    body: "Every feature works on day one, just for you. There’s no team requirement — invite your firm whenever you grow.",
  },
];

/** Soft, single-lawyer-friendly plan offer shown after creation. */
export const FREE_PLAN_HIGHLIGHTS: string[] = [
  "Unlimited matters and channels",
  "AI drafting, review, and research",
  "Verifiable, cite-checked answers",
];

export const PRO_PLAN_HIGHLIGHTS: string[] = [
  "Longer message & document history",
  "Higher AI usage limits",
  "Collaborate with external counsel",
];
