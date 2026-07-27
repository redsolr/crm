# Jurisimus Vision: Legal Knowledge Management Platform

## Executive Summary

Jurisimus is evolving from an AI chat tool into a **complete legal research and knowledge management platform** for Thai law firms. The vision is to create a workflow that takes lawyers from initial research through document drafting to institutional knowledge retention.

---

## Strategic Direction

### The Transformation

```
Current State                    Future State
─────────────                    ────────────
┌─────────────┐                  ┌─────────────────────────────────┐
│  Chat AI    │      ───►        │  Research → Draft → Knowledge   │
│  (Q&A tool) │                  │  (End-to-end legal workflow)    │
└─────────────┘                  └─────────────────────────────────┘
```

### Core User Flow

```
┌─────────┐    ┌──────────────┐    ┌───────────┐    ┌───────────────┐
│  Chat   │ ─► │ Key Findings │ ─► │ Workspace │ ─► │   Synthesis   │
│         │    │              │    │           │    │               │
│ Ask AI  │    │ Save insights│    │ Draft doc │    │ Build library │
└─────────┘    └──────────────┘    └───────────┘    └───────────────┘
```

---

## Why This Strategy

### Business Value at Each Stage

| Stage | User Action | Business Value |
|-------|-------------|----------------|
| **Chat** | Ask legal questions | Entry point, user acquisition |
| **Key Findings** | Save important insights | Creates user-generated data, increases engagement |
| **Workspace** | Draft legal documents | Becomes productivity tool, justifies subscription |
| **Synthesis** | Build knowledge library | Creates institutional memory, lock-in effect |
| **Company Knowledge** | Share across team | Enables team subscriptions, enterprise pricing |

### Competitive Positioning

| Competitor Type | What They Do | Jurisimus's Advantage |
|-----------------|--------------|----------------------|
| ChatGPT/Claude | General AI chat | Legal-specific workflow + Thai law expertise |
| Westlaw/LexisNexis | Legal research | Modern AI + better UX + affordable |
| Notion/Coda | Document editing | Legal AI integration + synthesis |
| Roam/Obsidian | Knowledge graphs | Legal context + team sharing + simpler UX |

### Moat Building

1. **Workflow Lock-in** — Users who build a Knowledge Library won't switch
2. **Network Effects** — More usage = more valuable knowledge graph
3. **Institutional Memory** — Company Knowledge becomes a firm asset
4. **Thai Market Focus** — Deep local expertise, less competition

---

## Product Evolution Roadmap

```
Phase 1: AI Chat ← (Current)
    │
    ▼
Phase 2: Research Assistant (Key Findings)
    │     - Save insights from chat
    │     - Organize by topic/date
    │     - Quick access via navbar
    │
    ▼
Phase 3: Document Drafting (Workspace)
    │     - Three-panel layout
    │     - Drag findings into document
    │     - Scoped LLM assistant
    │
    ▼
Phase 4: Knowledge Platform (Synthesis)
    │     - Extract concepts and relationships
    │     - Personal vs Company knowledge
    │     - Link detection (cases, sections)
    │
    ▼
Phase 5: Firm-wide Legal Intelligence (Future)
          - Cross-matter insights
          - Precedent discovery
          - Team analytics
```

---

## CEO Pilot Program

### Context

The CEO has requested to be the first pilot user for this feature set. This changes the development approach:

| Normal Feature Development | CEO Pilot Development |
|---------------------------|----------------------|
| Ship MVP, validate with metrics | Ship polished experience for CEO daily use |
| Slow, risk-averse rollout | Fast iteration with direct feedback |
| Feature flags, gradual exposure | CEO uses it immediately |
| PM-filtered feedback | Direct CEO → Engineering feedback loop |

### Benefits of CEO Pilot

1. **Direct Feedback** — No telephone game through product managers
2. **Resources** — CEO-backed features get priority
3. **Clear Success** — Binary metric: Does CEO use it daily? Yes/No
4. **Political Cover** — Blockers disappear when CEO wants something

### CEO Pilot Scope (2 Weeks)

**Goal:** CEO can complete this flow end-to-end:

```
1. Chat with AI about a legal question
          ↓
2. Tap ⭐ to save a key insight
          ↓
3. See "Saved to Key Findings" toast
          ↓
4. Click 🔖 in navbar → see findings drawer
          ↓
5. Switch to Workspace mode
          ↓
6. Drag finding into document
          ↓
7. Write a memo
          ↓
8. Save document
```

### What to Build (CEO Pilot)

**Week 1: Core Experience**
- [x] Save Key Finding button on LLM messages
- [ ] Key Findings drawer (navbar pin with badge)
- [ ] Toast notification system
- [ ] Findings persist in localStorage

**Week 2: Workspace Draft**
- [ ] Chat ↔ Workspace mode toggle
- [ ] Workspace three-panel layout
- [ ] Findings panel (left)
- [ ] Document editor (center)
- [ ] Drag-drop findings into document
- [ ] Basic document save

**Defer to Post-Pilot:**
- LLM assistant in Workspace (polish)
- Synthesis / Knowledge Library (Phase 4)
- Company vs Personal Knowledge (needs backend)
- Team features (enterprise)

---

## Long-term Vision

### Target User

> **"A Thai lawyer who uses Jurisimus daily to research, draft, and build their firm's knowledge base"**

### Success Metrics (Post-Pilot)

| Metric | Target |
|--------|--------|
| Key Findings saved per user/week | 10+ |
| Workspace sessions per user/week | 3+ |
| Documents created per user/month | 5+ |
| Knowledge Library items per firm | 100+ |
| Team subscription conversion | 20% of active users |

### Revenue Model Evolution

```
Current: Individual Chat Subscriptions
         └── $X/month per user

Future:  Tiered Platform Subscriptions
         ├── Free: Chat only, limited findings
         ├── Plus: Unlimited findings + Workspace
         ├── Pro: Synthesis + Personal Knowledge
         └── Enterprise: Company Knowledge + Team features
```

---

## Technical Principles

### UX Principles (from Head of Engineering)

1. **One-tap actions** — Saving a finding = single tap, no modal
2. **Stay in flow** — Right-side panels, not full-page navigation
3. **Auto-organize** — Group findings by topic, session, date automatically
4. **Graph after writing** — Synthesis happens post-completion, not during
5. **No "graph" language** — Users think in documents, not knowledge graphs
6. **Mobile-friendly** — Bottom sheets, avoid long-press

### Architecture Principles

1. **Leverage existing components** — Reuse ChatSidebar, DocumentEditor patterns
2. **Progressive enhancement** — localStorage first, API later
3. **Scoped LLM context** — Workspace assistant only sees document + findings
4. **Incremental complexity** — Each phase builds on previous

---

## Risk Assessment

### Strategic Risks

| Risk | Mitigation |
|------|------------|
| Lawyers resist new workflows | CEO pilot validates before broad rollout |
| Scope creep (4 features at once) | Phase 1 first, validate, then proceed |
| Knowledge graph complexity | Keep synthesis simple, hide from users |
| Backend not ready | Use localStorage for pilot |

### Technical Risks

| Risk | Mitigation |
|------|------------|
| Performance with large knowledge bases | Defer to Phase 4, optimize later |
| Data loss in localStorage | Add export, migrate to API post-pilot |
| Mobile UX complexity | Desktop-first for CEO pilot |

---

## Appendix: Feature Specifications

See [workflow-task.md](workflow-task.md) for detailed implementation tasks.

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-29 | Frontend Team | Initial vision document |

---

## Approval

- [ ] CEO Review
- [ ] Head of Engineering Review
- [ ] Product Team Review
