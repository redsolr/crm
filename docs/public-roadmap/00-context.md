# Public Roadmap — Context

> Strategic context for the "public roadmap / public boards" initiative.
> This is the *why*. Specs, schema, and route maps live in sibling docs.

## Problem

We need a way for users to submit feature requests, report bugs, vote on
priorities, and track what's shipping. Today we have nothing in-app.

We evaluated and prototyped third-party tools (Featurebase, Canny,
Frill, Intercom). Each one means:

- Another SaaS bill and integration to maintain.
- Submissions stuck in a parallel system, disconnected from our own
  task tracker, comments, and customer data.
- Users authenticate with a third party — friction at the moment we
  most want them to talk to us.
- We don't own the data, the URL, the styling, or the experience.
- Free tiers gate the most useful features (in-app widget, identify,
  voting weights). We hit four separate plan walls in one afternoon.

Meanwhile we already have most of the moving parts. Tasks, kanban,
backlog, sprints, comments, projects, teams, sharing — all built. The
only missing pieces are public read access, anonymous submission, and
upvotes.

## Why now

1. **Featurebase frustration.** We just rage-quit a paid tool. The pain
   is fresh, the alternative is obvious.
2. **Foundation is in place.** We're not starting from zero — we're
   adding a permission tier and a public route to existing infra.
3. **Differentiation gap.** Linear, Notion, and Canny all have basic
   public boards. Nobody has an *AI-native* one. We do.
4. **Sales narrative.** "See our public roadmap" is a thing every B2B
   SaaS pretends to have. Most are stale Trello boards. A live,
   AI-curated roadmap is a credibility signal we can use today.

## What we're building

A first-class **public roadmap** feature that lets any team toggle a
project / board to public, share its URL, accept anonymous + authed
submissions, support upvoting, and surface a clean status workflow
(New → Reviewing → Planned → In Progress → Shipped → Declined).

This replaces our need for Featurebase entirely — and becomes a
product surface we can sell.

## Why this is a fit for Jurisimus specifically

We already own:

- The user's full app session (chat, files, notes, recent actions).
- AI plumbing (LLM calls, embeddings, key findings).
- A real task model with comments, statuses, projects, and sharing.

That ownership unlocks features no third-party tool can ship:

- **Submit a feature from a chat.** When the AI tells a user "I can't
  do that yet" — one-click converts the conversation into a request
  with full context attached.
- **Auto-attach session context.** Logged-in submissions ship with the
  user's recent actions, current page, and (with consent) recent
  errors. Engineering gets repro steps for free.
- **AI dedup at submission time.** "Sounds like 3 existing requests —
  vote for one?" cuts duplicate noise to near-zero.
- **AI-written status updates.** Status flips trigger personalized
  notifications drafted by the LLM, approved in one click.
- **AI roadmap agent.** Visitors ask "what's coming for mobile?" and
  get a real answer from the live board state, no sales call needed.

These are not nice-to-haves; they are the wedge.

## Strategic positioning

> **Stop guessing what users want.**
> We attach the exact session context to every feature request — and
> let users request features the moment they hit a wall.

Three audiences this resonates with:

- **PMs:** finally see *why* a feature was requested, not just *that*
  it was.
- **Engineers:** repro steps come pre-attached.
- **Founders:** signal "we ship in public" without the manual upkeep.

## Success looks like

- We delete our Featurebase account within 30 days of V1 shipping.
- 100% of feature requests for Jurisimus itself live on our own
  roadmap by end of V1.
- At least one paying customer turns on a public board for their own
  project within 60 days of V1.
- Public roadmap pages get indexed and rank for "Jurisimus roadmap"
  within 90 days.

## Out of scope (for V1)

Explicitly deferring to keep V1 small enough to ship in two weeks:

- Custom domains per public board.
- Public user profiles for submitters (privacy headache, low value).
- Heavy gamification (badges, streaks, leaderboards).
- Slack / Discord webhook integrations.
- Markdown rendering of comments beyond basic formatting.
- Multi-language UI for public boards.
- A/B testing different status workflow names.

These come later if they earn their slot.

## Phasing

| Phase | Scope | Estimate |
|---|---|---|
| **V1** | Public boards, anonymous + authed submission, upvotes, status workflow, AI dedup, session-context attach | ~2 weeks |
| **V2** | Comments (incl. anon with rate limit), AI weekly digest emails, AI-drafted status updates, chat → request conversion | ~1 month |
| **V3** | Embeddable iframe widget, weighted voting (by tier / usage), public AI agent on the roadmap, RSS, custom branding | ~1 month |

V1 alone replaces Featurebase. V2+V3 are where the moat compounds.

## Key open questions to decide before spec

1. **Anonymous submission or login-required for V1?**
   Login-required ships faster (no spam plumbing, voting trivial), but
   adds friction. Featurebase parity = anonymous. Recommendation:
   **anonymous, with hCaptcha + rate limit** — the friction kills the
   funnel and we already have the LLM to flag low-quality submissions.

2. **Per-project public flag, or per-board, or per-task?**
   Recommendation: **per-board (folder-level)** matches existing
   sharing model and keeps the permission story simple.

3. **Vote model: simple +1, or weighted by signal?**
   Recommendation: **simple +1 in V1**. Weighted in V3 once we have
   data on what signals matter.

4. **One vote per anon (cookie) or require email to vote?**
   Recommendation: **cookie + IP for V1**, email gate optional per
   board owner. Email gate kills volume but is the only way to
   actually trust a vote.

5. **Public boards live at `/r/[slug]` (short, share-friendly) or
   `/[org]/roadmap/[board]` (canonical)?**
   Recommendation: **both** — `/r/[slug]` redirects to canonical for
   share links, canonical for SEO.

6. **Should public-board tasks be the *same* tasks as private kanban
   tasks, or a separate `feature_requests` model with promotion?**
   Recommendation: **same model, with a `visibility` field**. Avoids
   sync hell. The promotion ceremony (private → public) becomes one
   click.

## Risks

- **Spam volume.** Anonymous submissions on a public app = spam target.
  Mitigation: hCaptcha + per-IP rate limit + AI moderation pass before
  visibility.
- **Public airing of issues.** Customers can submit critical bugs
  publicly that we'd rather handle privately. Mitigation: per-board
  setting "auto-private until reviewed" for sensitive boards.
- **SEO collision.** Public boards rank for our own brand terms.
  Mitigation: noindex by default, opt-in indexing per board.
- **Scope creep into "Linear killer".** This is a *feedback +
  roadmap* feature, not a project management replacement. Resist
  expanding into general-purpose public PM.

## Next docs in this series

- `01-spec.md` — V1 functional spec (user stories, acceptance criteria).
- `02-schema.md` — DB schema changes (Drizzle migrations).
- `03-routes.md` — public route map + API surface.
- `04-ai-integration.md` — dedup, context-attach, status-update prompts.
