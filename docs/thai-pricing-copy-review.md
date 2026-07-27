# Thai pricing copy — native-speaker review sheet (2026-07-06)

> Every Thai string touched by the seat-pricing arc, in one table so the review is a
> single scan-and-correct pass. All strings live in
> [`src/lib/i18n/dictionaries/th.ts`](../src/lib/i18n/dictionaries/th.ts) at the key
> shown. Agent-written Thai — the prestige-landing lesson says none of it ships as
> "reviewed" until a native speaker signs off. Correct directly in `th.ts`, then
> delete this file (or tick the boxes and hand it back).
>
> Context for the reviewer: the audience is Thai law firms (solo lawyers up to
> ~50-lawyer firms); tone should be professional but warm, not bureaucratic. "Seat"
> = ที่นั่ง is the SaaS convention; flag if it reads oddly for lawyers.

| ✔ | Key (`th.ts`) | Current Thai | English source |
| --- | --- | --- | --- |
| ☐ | `pricing.eyebrow` | แผนการใช้งาน | Engagement |
| ☐ | `pricing.subtitle` | แผนเดียว ครบทุกโมดูล ลูกความและผู้ดูใช้ฟรีเสมอ | One plan, every module included. Clients and viewers are always free. |
| ☐ | `pricing.perLawyerMonth` | ต่อทนายความ / เดือน | per lawyer / month |
| ☐ | `pricing.annualNote` | /ปี — ฟรี 2 เดือน · ขั้นต่ำ 1 ที่นั่ง | /year — 2 months free · minimum 1 seat |
| ☐ | `pricing.detailsLink` | ดูรายละเอียดราคาทั้งหมด | See full pricing details |
| ☐ | `pricing.getStarted` | นัดชมการสาธิต | Request a demo |
| ☐ | `pricing.loadError` | ไม่สามารถโหลดราคาได้ กรุณาลองใหม่อีกครั้ง | Unable to load pricing. Please try again later. |
| ☐ | `faq.items[1].answer` (AI models) | รองรับ Anthropic (Claude) และ OpenAI ผ่านระบบผู้ให้บริการแบบถอดเปลี่ยนได้ ทุกที่นั่งใช้ได้ทุกโมเดล — การใช้งานหักจากโควตา AI รายเดือนที่ใช้ร่วมกันทั้งสำนักงาน และเติมเครดิตแบบชำระล่วงหน้าได้เมื่อใช้เกิน | We support Anthropic (Claude) and OpenAI through a pluggable provider system. Every seat gets every model — usage draws from your firm's pooled monthly AI allowance, with prepaid credit packs for extra usage. |

## Specific things to sanity-check (not just grammar)

1. **ที่นั่ง for "seat"** — is this natural for a law-firm software license, or would
   Thai lawyers expect something like "ผู้ใช้" (user) / "สิทธิ์การใช้งาน" (license)?
2. **ฟรี 2 เดือน** ("2 months free") — confirm this reads as the annual-billing
   incentive and not as a free trial.
3. **ลูกความ** for "clients" — correct legal register (vs ลูกค้า)? It was chosen
   deliberately (lawyer's client, not customer) — confirm.
4. **โควตา AI** — "quota" vs "อัตราการใช้งาน"/"เครดิต AI"; pick whichever a Thai firm
   admin would actually say.
5. The price itself renders as **฿890** from the API (not in these strings) — check
   the assembled sentence on http://localhost:3000 (Thai locale) reads naturally
   around the number.
