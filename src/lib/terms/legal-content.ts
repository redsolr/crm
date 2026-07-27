/**
 * Legal document text for the `/legal/*` pages — copied VERBATIM from
 * `platform/docs/legal/drafts/*.md` (the same source the platform's
 * generated `terms-content.ts` is built from and hash-pins in its
 * registry). GENERATED 2026-07-12 — regenerate when the drafts change
 * (a new platform registry revision), never hand-edit the strings.
 *
 * All three documents are DRAFTS pending Thai-counsel review — the
 * pages render a DRAFT watermark until the counsel-approved 1.0.0
 * publishes (spec § 10).
 */

/** Display metadata from the platform registry (terms-components.ts). */
export const LEGAL_DOCUMENT_VERSION = "1.0.0-draft";
export const LEGAL_DOCUMENT_PUBLISHED_AT = "2026-07-01";

export const TERMS_OF_SERVICE_MD = `# Jurisimus — Terms of Service (DRAFT)

> **STATUS: DRAFT — NOT IN FORCE. NOT LEGAL ADVICE.**
> Prepared 2026-07-11 as a founder-protective first draft for review by Thai counsel before publication.
> Placeholders: \`[COMPANY]\` = the registered Thai entity (form it before signing anything — see
> [\`../legal-readiness-plan-2026-07-11.md\`](../legal-readiness-plan-2026-07-11.md) § 1). Bracketed
> \`[COUNSEL: …]\` notes are questions for the reviewing lawyer, to be deleted before publication.
> A Thai-language version must be produced before the first Thai-firm signature; the language clause
> (§ 20) decides which text prevails.

---

**Effective date:** [DATE]
**Version:** [v1.0 — acceptance is recorded per version; material changes require re-acceptance]

These Terms of Service (the "**Terms**") govern access to and use of the Jurisimus platform,
applications, APIs, and related services (the "**Service**") provided by **[COMPANY]**, a company
registered under the laws of Thailand ("**Jurisimus**", "**we**", "**us**").

## 1. Definitions

- "**Customer**" — the law firm, company, or other legal entity that registers an organization on
  the Service or signs an Order Form referencing these Terms.
- "**Authorized User**" — an individual invited to the Customer's organization (a seat holder,
  read-only user, or billing user).
- "**Customer Data**" — all data, documents, communications, and other content submitted to the
  Service by or on behalf of the Customer, including data relating to the Customer's own clients.
- "**Output**" — any content generated or returned by the Service's AI-assisted features, including
  drafts, summaries, research results, citations, redlines, checklists, and suggestions.
- "**Order Form**" — a written or electronic ordering document (including in-app checkout) that
  specifies seats, fees, and any special terms.

## 2. Acceptance; authority to bind

2.1 **Affirmative acceptance only.** These Terms are accepted by an affirmative act — ticking the
acceptance checkbox and clicking the acceptance button presented in the Service, or executing a
written instrument (including an Order Form or pilot agreement) that references these Terms. Mere
account creation, receipt of an invitation, or use of the Service does not by itself constitute
acceptance; the Service does not permit use before acceptance. **If you do not agree, you must not
use the Service.** Each acceptance is recorded (document version, timestamp, accepting account,
capacity) and constitutes an electronic signature under the Electronic Transactions Act B.E. 2544
(2001).

2.2 **Capacities; authority.** Acceptance is given in one or both of two capacities: (a) **on
behalf of the Customer** — only by an individual who represents and warrants that they are
authorized to bind the Customer (an unauthorized purported acceptance does not bind the Customer,
and the individual is responsible for the consequences of the misrepresentation [COUNSEL: confirm
the strongest enforceable formulation]); and (b) **personally as an Authorized User** — by each
individual user, agreeing to be bound by these Terms as they apply to Authorized Users. An
individual accepting on behalf of the Customer also accepts personally as an Authorized User.
Authorized Users other than the signatory do not represent authority to bind the Customer.

2.3 **Business use only.** The Service is offered to businesses and professionals for business
purposes. It is not offered to consumers.

## 3. Nature of the Service — a workflow and research tool, NOT legal advice

> [COUNSEL: this section and § 4 are the load-bearing founder-protection provisions. Please make
> > them as strong as Thai law permits, and confirm the all-caps prominence approach is effective
> > under the Unfair Contract Terms Act B.E. 2540.]

3.1 **JURISIMUS IS NOT A LAW FIRM AND DOES NOT PROVIDE LEGAL ADVICE, LEGAL OPINIONS, OR LEGAL
SERVICES OF ANY KIND.** The Service is a software workflow, document-organization, communication,
and research **tool** for legal professionals. No output, feature, template, workflow, checklist,
citation check, or other function of the Service constitutes legal advice, and none may be relied
upon as such.

3.2 **No attorney–client relationship.** Use of the Service does not create an attorney–client,
fiduciary, or professional-advisory relationship between the Customer (or its clients) and
Jurisimus.

3.3 **The Customer's professionals remain solely responsible.** All professional judgment,
strategy, advice, filings, and work product remain the sole responsibility of the Customer and its
licensed professionals. The Service assists with organizing and accelerating work; it does not and
cannot perform, replace, or supervise the practice of law. The Customer's lawyers remain fully
subject to their professional obligations under the Lawyers Act B.E. 2528 (1985), the regulations
of the Lawyers Council of Thailand, and any other applicable professional rules, and nothing in the
Service alters, discharges, or transfers any of those obligations to Jurisimus.

3.4 **Not a source of truth.** The Service — including its legal-reference, search, and
citation-checking features — is an aid to research, **not an authoritative source of law**. Statutes,
regulations, court decisions, and official publications remain the only authoritative sources. The
Customer must verify all legal propositions against authoritative sources before relying on them.

## 4. AI-generated output — mandatory verification; no reliance

4.1 **AI CAN MAKE MISTAKES.** The Service uses large language models and other AI systems.
AI-generated Output may be **inaccurate, incomplete, outdated, or fabricated** — including
plausible-looking but wrong citations, misquoted provisions, incorrect summaries, and reasoning
errors. This is an inherent characteristic of the technology, not a defect in the Service.

4.2 **Mandatory professional review.** The Customer must ensure that a qualified professional
**independently reviews and verifies every Output before it is relied upon, communicated to a
client, filed with a court or authority, or otherwise used**. Reviewing AI-assisted work before use
is part of the Customer's professional duty of competence and diligence; the Customer agrees that
this review is its responsibility alone.

4.3 **Verification features are aids, not guarantees.** Grounding, citation-checking, provenance,
confidence indicators, abstention behavior, and similar trust features are designed to _assist_
verification. They are probabilistic aids and **do not warrant** that any Output is accurate,
complete, current, or fit for any purpose. An Output that passes a citation check may still be
wrong; an abstention may still omit relevant law.

4.4 **No reliance.** Jurisimus expressly disclaims, and the Customer expressly waives, any claim
based on reliance on an Output that was not independently verified by the Customer as required by
§ 4.2. Any decision made or action taken on the basis of an Output is made at the Customer's sole
risk.

4.5 **In-product notices.** The Service displays notices to the effect of § 4.1–4.2 in the product.
Such notices supplement, and do not limit, this Section 4.

## 5. Customer responsibilities and warranties

The Customer is solely responsible for, and represents and warrants:

5.1 **Confidentiality and professional duties.** The Customer is solely responsible for maintaining
the confidentiality of its clients' information and for complying with all confidentiality,
privilege, conflict-of-interest, and other professional obligations owed to its clients. The
Customer will assess, using its own professional judgment, whether and how use of the Service is
compatible with those obligations (including any client-consent or engagement-letter requirements)
before submitting any client information to the Service.

5.2 **Rights and lawful basis in Customer Data.** The Customer has all rights, consents, and lawful
bases (including under the Personal Data Protection Act B.E. 2562 (2019), "**PDPA**") necessary to
submit Customer Data to the Service and to have it processed as described in these Terms and the
Data Processing Addendum. As between the parties, the Customer is the data controller of personal
data contained in Customer Data relating to its clients and third parties; Jurisimus processes such
data only as a data processor on the Customer's instructions.

5.3 **Account security.** The Customer is responsible for all activity under its organization and
its Authorized Users' accounts, for keeping credentials, API keys, and access tokens confidential,
for promptly deactivating users who leave the firm, and for notifying us without undue delay of any
suspected unauthorized access. Seats are per named individual and may not be shared.

5.4 **Accuracy of inputs.** The quality of Output depends on the inputs provided. Jurisimus has no
obligation to detect errors, omissions, or forgeries in Customer Data.

5.5 **Lawful use.** The Customer will use the Service only in compliance with applicable law and
these Terms, and will not submit data or use the Service in any way that infringes third-party
rights.

## 6. Acceptable use

The Customer must not (and must not permit anyone to): (a) use the Service to provide legal advice
or services **to third parties as if generated or endorsed by Jurisimus**, or represent that any
Output was human-verified by Jurisimus; (b) resell, sublicense, or provide the Service to third
parties except to its own Authorized Users; (c) use the Service or Output to develop or train a
competing product or any machine-learning model; (d) probe, scan, or test the vulnerability of the
Service except under a written authorization; (e) circumvent usage limits, seat limits, or access
controls; (f) submit malicious code; (g) use the Service for any unlawful purpose. We may suspend
access immediately for a breach of this Section that threatens the Service or other customers.

## 7. Our commitments on Customer Data

7.1 **No AI training.** We do not use Customer Data or Output to train or fine-tune AI models, and
we contractually require our AI subprocessors not to train on data submitted through our accounts.

7.2 **Security.** We maintain administrative, technical, and organizational measures appropriate to
the risk, including encryption in transit and at rest, tenant isolation enforced at the database
layer, role-based access controls, and audit logging, as further described in our security
documentation.

7.3 **Subprocessors.** We use vetted subprocessors (hosting, model providers, payments, auth,
communications) listed at [SUBPROCESSOR PAGE URL]. The Data Processing Addendum governs
subprocessor changes and objections.

7.4 **Data protection.** Processing of personal data is governed by our Privacy Policy (for data
where we are the controller) and the Data Processing Addendum (for Customer Data where we are the
processor). In case of conflict regarding personal data, the Data Processing Addendum prevails.

## 8. Intellectual property; Customer Data and Output

8.1 The Customer retains all rights in Customer Data. To the extent Jurisimus holds any rights in
Output, Jurisimus assigns them to the Customer upon generation; the Customer's use of Output remains
subject to § 3–4. Jurisimus and its licensors retain all rights in the Service, its software,
models' configurations, templates, and documentation. The Customer grants Jurisimus a limited
license to process Customer Data solely to provide, secure, and support the Service.

8.2 **Usage data.** We may use aggregated, de-identified usage and telemetry data (never the content
of Customer Data or Output) to operate and improve the Service.

8.3 **Feedback** provided by the Customer may be used by Jurisimus without restriction or
obligation.

## 9. Fees, payment, and taxes

9.1 **Fees.** Fees are per seat as stated in the applicable Order Form or in-app pricing. Fees are
committed for the subscription term; seat decreases take effect prospectively and no refunds are
given for unused seats or partial periods, except as required by law.

9.2 **Payment rails.** Payment may be made (a) by card or other methods via our payment provider
(Stripe), or (b) for invoiced customers, by bank transfer to the account stated on the invoice,
due within [15] days of the invoice date.

9.3 **Taxes; VAT.** Fees are exclusive of taxes. Value added tax will be added at the applicable
rate where required, and a tax invoice (ใบกำกับภาษี) will be issued for Thai customers where
[COMPANY] is VAT-registered.

9.4 **Withholding tax.** Where the Customer is required by Thai law to deduct withholding tax from
a payment, the Customer may deduct the required amount provided that it delivers the corresponding
withholding tax certificate (หนังสือรับรองการหักภาษี ณ ที่จ่าย) to Jurisimus within 30 days of
payment; absent a valid certificate, the withheld amount remains due. [COUNSEL: confirm this is the
market-standard formulation; we deliberately do not gross up.]

9.5 **Late payment; suspension.** Amounts unpaid [15] days after the due date may accrue interest
at the maximum lawful rate, and we may suspend the Service after [7] days' written notice until
paid.

## 10. Pilots, trials, and beta features

Any free pilot, trial, demo environment, or feature identified as beta/preview is provided **"as
is", without any warranty, service level, or support commitment**, may be modified or discontinued
at any time, and its data may be deleted at the end of the pilot on [14] days' notice. Sections 3,
4, 11, 12, and 13 apply fully during pilots and trials.

## 11. Warranty disclaimer

EXCEPT AS EXPRESSLY STATED IN THESE TERMS, THE SERVICE AND ALL OUTPUT ARE PROVIDED **"AS IS" AND
"AS AVAILABLE"**, AND JURISIMUS DISCLAIMS ALL OTHER WARRANTIES AND CONDITIONS, EXPRESS OR IMPLIED,
INCLUDING FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, COMPLETENESS, CURRENCY OF LEGAL CONTENT,
NON-INFRINGEMENT, AND UNINTERRUPTED OR ERROR-FREE OPERATION, TO THE MAXIMUM EXTENT PERMITTED BY
APPLICABLE LAW. NO ADVICE OR INFORMATION OBTAINED FROM JURISIMUS OR THROUGH THE SERVICE CREATES ANY
WARRANTY NOT EXPRESSLY STATED HEREIN.

## 12. Limitation of liability

12.1 **Cap.** TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE AGGREGATE LIABILITY OF JURISIMUS ARISING
OUT OF OR RELATING TO THE SERVICE OR THESE TERMS SHALL NOT EXCEED THE FEES ACTUALLY PAID BY THE
CUSTOMER TO JURISIMUS IN THE **TWELVE (12) MONTHS** PRECEDING THE EVENT GIVING RISE TO LIABILITY
(OR, FOR FREE PILOTS AND TRIALS, THB [10,000]).

12.2 **Excluded damages.** TO THE MAXIMUM EXTENT PERMITTED BY LAW, JURISIMUS SHALL NOT BE LIABLE
FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS,
REVENUE, GOODWILL, DATA, OR PROFESSIONAL REPUTATION, OR FOR ANY LIABILITY OF THE CUSTOMER TO ITS
OWN CLIENTS OR ANY THIRD PARTY — INCLUDING ANY CLAIM ARISING FROM RELIANCE ON UNVERIFIED OUTPUT
CONTRARY TO § 4 — EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

12.3 **Carve-outs.** Nothing in these Terms excludes or limits liability for fraud, willful
misconduct, or gross negligence, or any other liability that cannot be excluded or limited under
Thai law. [COUNSEL: confirm interaction with Civil and Commercial Code § 373 and the Unfair
Contract Terms Act B.E. 2540; adjust the cap/exclusions to the strongest enforceable form.]

12.4 **Allocation of risk.** The parties agree that this Section 12 reflects a deliberate
allocation of risk reflected in the pricing, and that the Customer — a professional organization
with its own duty and ability to verify Output — is best placed to prevent the losses described in
§ 12.2.

## 13. Indemnification by the Customer

The Customer will defend, indemnify, and hold harmless Jurisimus, its directors, employees, and
contractors from and against any third-party claim (including claims by the Customer's own clients
and by data subjects), and all resulting damages, penalties, and reasonable costs, arising out of:
(a) Customer Data, including any lack of rights or lawful basis to submit it; (b) the Customer's
use of the Service or Output, including any use, communication, or filing of Output without the
verification required by § 4; (c) breach of the Customer's professional obligations; or (d) breach
of these Terms or applicable law by the Customer or its Authorized Users.

## 14. Term, suspension, and termination

14.1 These Terms apply from acceptance until all subscriptions expire or are terminated.
Subscriptions renew per the Order Form unless cancelled before the renewal date.

14.2 Either party may terminate for material breach uncured within 30 days of written notice. We
may suspend or terminate immediately for breaches of § 6, non-payment per § 9.5, or a genuine
security risk.

14.3 **Data export and deletion.** For 30 days after termination, the Customer may export Customer
Data using the Service's export functions or by written request. Thereafter we will delete Customer
Data within [60] days, except minimal records retained as required by law (which remain protected
under these Terms).

14.4 Sections 3, 4, 5, 8, 11, 12, 13, 15, and 17–21 survive termination.

## 15. Confidentiality

Each party will protect the other party's confidential information with at least the care it uses
for its own similar information (and no less than reasonable care), use it only to perform under
these Terms, and disclose it only to personnel and contractors under confidentiality obligations,
or as required by law with prompt notice where lawful.

## 16. Changes to the Service and to these Terms

We may improve and modify the Service, and will not materially degrade its core functionality
during a paid term. We may update these Terms; material changes will be notified at least 30 days
in advance and require re-acceptance in the product. If a material change takes effect before the
Customer has re-accepted, the version of these Terms most recently accepted by the Customer
continues to govern until the Customer re-accepts or the agreement terminates; we may restrict or
suspend access (including API access) pending re-acceptance after a reasonable grace period.
Continued use after the effective date of non-material changes constitutes acceptance of those
non-material changes [COUNSEL: confirm this residual continued-use mechanism for non-material
changes is acceptable alongside § 2.1's affirmative-acceptance rule].

## 17. Force majeure

Neither party is liable for delay or failure caused by events beyond its reasonable control,
including failures of third-party AI model providers, hosting providers, or telecommunication
networks, provided it uses reasonable efforts to mitigate. This Section does not excuse payment
obligations.

## 18. Notices

Notices to Jurisimus: [legal@jurisimus.com] and the registered address of [COMPANY]. Notices to the
Customer: the organization owner's registered email. Notices are deemed received one business day
after email transmission without bounce.

## 19. Governing law and disputes

These Terms are governed by the laws of Thailand. Disputes are subject to the exclusive
jurisdiction of the courts of Thailand [COUNSEL: confirm venue — Civil Court, Bangkok — or whether
THAC arbitration is preferable for founder protection at our stage].

## 20. Language

These Terms are executed in English [and Thai]. [COUNSEL: decide which version prevails; a Thai
version is required in practice for Thai-firm enforceability and PDPA-adjacent notices.]

## 21. General

Entire agreement (together with Order Forms and the Data Processing Addendum); order of
precedence: Order Form → DPA → these Terms. The Privacy Policy is a notice describing our
processing of personal data, referenced for information and acknowledged on receipt — it is not a
contractual term of this agreement [COUNSEL: confirm this characterization vs. incorporating it;
the acceptance flow deliberately uses "acknowledge receipt" for the Privacy Notice and "agree"
only for these Terms]. No assignment by the Customer
without our consent (we may assign to an affiliate or in a merger/asset sale). Severability: an
invalid provision is replaced by the closest enforceable one and the remainder stands. No waiver by
conduct. No third-party beneficiaries. Independent contractors.

---

## Notes for reviewing counsel (delete before publication)

1. **Entity.** These Terms assume a registered Thai company limited. If the founder is still a
   natural person, incorporation must precede first signature — personal liability otherwise.
2. **Unfair Contract Terms Act B.E. 2540** — §§ 11–13 are standard-form exclusions; please tune to
   the strongest form a Thai court will actually enforce against a _business_ counterparty
   (law firms are sophisticated parties, which helps).
3. **CCC § 373** — exclusions for fraud/gross negligence are void; § 12.3 carves these out
   explicitly. Confirm "gross negligence" carve-out breadth.
4. **ETA B.E. 2544** — confirm clickwrap + recorded acceptance (version, timestamp, account, IP)
   satisfies evidentiary needs; we log acceptance server-side.
5. **Lawyers Act B.E. 2528** — confirm §§ 3.1–3.3 sufficiently insulate Jurisimus from any
   unauthorized-practice characterization and from imputation of the customer's professional duties.
6. **PDPA** — controller/processor split in § 5.2 must match the DPA (to be drafted next).
7. **Stamp duty** — confirm whether these Terms / Order Forms attract stamp duty as hire-of-work
   and who bears it.
8. **Consumer protection** — confirm § 2.3 (business-only) keeps us outside the Consumer Case
   Procedure Act; solo practitioners are still businesses, but please confirm.`;

export const PRIVACY_POLICY_MD = `# Jurisimus — Privacy Policy (DRAFT)

> **STATUS: DRAFT — NOT IN FORCE. NOT LEGAL ADVICE.**
> Prepared 2026-07-11 for review by Thai counsel before publication. PDPA-shaped
> (Personal Data Protection Act B.E. 2562 (2019)). A Thai version is required for publication;
> plan doc: [\`../legal-readiness-plan-2026-07-11.md\`](../legal-readiness-plan-2026-07-11.md).
> Placeholders in \`[BRACKETS]\`.

---

**Effective date:** [DATE] · **Version:** [v1.0]

This Privacy Policy explains how **[COMPANY]** ("**Jurisimus**", "we") collects, uses, discloses,
and protects personal data when we act as a **data controller** — that is, for visitors to our
websites, demo requesters, and the accounts, billing, and usage data of our customers.

> **Your firm's client data is different.** Where a customer law firm submits data about _its own
> clients_ to the Service (matters, documents, communications), the **firm is the data controller**
> and Jurisimus processes that data only as a **data processor** on the firm's instructions, under
> the Data Processing Addendum — not under this Policy. Individuals whose data is contained in a
> firm's matter files should direct requests to that firm.

## 1. Who we are

[COMPANY], registered in Thailand at [ADDRESS]. Contact: [privacy@jurisimus.com].
Data protection contact / DPO status: [DPO NOT YET APPOINTED — contact above; revisit trigger
logged in \`docs/deferred-decisions.md\`].

## 2. Personal data we collect

| Category                         | Examples                                                                                                                                     | Source                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Demo-request and contact data    | name, firm, email, phone, message                                                                                                            | you (landing page, in-person demos)    |
| Account data                     | name, email, role, organization membership                                                                                                   | you / your firm's admin                |
| Billing data                     | invoicing details, payment method tokens (never full card numbers — held by Stripe), transaction history                                     | you / Stripe                           |
| Usage and device data            | log data, IP address, browser/device info, feature usage events, AI-usage metering (token counts and costs — not chat content for analytics) | automatic                              |
| Cookies and similar technologies | see the [Cookie Policy](./cookie-policy.md)                                                                                                  | automatic, with consent where required |
| Communications                   | support requests, emails, LINE messages you send us                                                                                          | you                                    |

We do not intentionally collect sensitive personal data (PDPA § 26) as a controller. Sensitive data
inside customer matter files is processed only as processor per the box above.

## 3. Purposes and legal bases (PDPA)

| Purpose                                                  | Legal basis                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Providing and operating the Service; account management  | contract performance (§ 24(3))                                       |
| Responding to demo requests; running scheduled demos     | contract performance / legitimate interest (§ 24(5))                 |
| Billing, invoicing, tax compliance                       | contract performance; legal obligation (§ 24(6))                     |
| Security, fraud prevention, abuse monitoring, audit logs | legitimate interest (§ 24(5))                                        |
| Product analytics (cookie-based)                         | **consent** (§ 19) — via the cookie banner, withdrawable at any time |
| Marketing communications                                 | **consent** — separate, never bundled with these terms               |
| Establishing or defending legal claims                   | legitimate interest / legal obligation                               |

We do not sell personal data. We do not use personal data or customer content to train AI models.

## 4. Disclosure and subprocessors

We share personal data only with service providers under contract (hosting — AWS; database —
Supabase; payments — Stripe; authentication — WorkOS; AI model providers — OpenAI, Anthropic
(API terms: no training on our data); email — AWS SES; messaging — LINE; webhooks — Svix;
analytics — PostHog [self-hosted/EU/US — confirm]; error monitoring — Sentry), with professional
advisors, or where required by law. The current subprocessor list is maintained at
[SUBPROCESSOR PAGE URL].

## 5. Cross-border transfers

Our infrastructure is currently hosted in [AWS us-east-1 (United States) / Supabase (REGION)].
Personal data is therefore transferred outside Thailand. We protect such transfers with appropriate
safeguards under PDPA § 28–29, including contractual data-protection obligations with each
provider. [PENDING DECISION: migration of production hosting to AWS Asia Pacific (Bangkok)
ap-southeast-7 — tracked in \`docs/deferred-decisions.md\`; update this section when decided.]

## 6. Retention

- Demo-request data: [24] months after last contact, then deleted or anonymized.
- Account data: for the life of the account and [90] days after deletion, except as required for
  legal/tax obligations (accounting records: per Revenue Code requirements).
- Billing records: [10] years (tax law).
- Logs and security data: [12] months.
- Consent records (cookie/marketing): [5] years from withdrawal, as evidence of compliance.
- Terms-acceptance and contract evidence (acceptance events, acknowledgments, signed
  instruments): [10] years after the applicable customer contract terminates (organization-scoped
  records) or [10] years after account deletion (account-scoped acknowledgments), on the legal
  basis of establishment and defence of legal claims. These records are retained even if the
  related account is deleted; they preserve only the identity details needed as evidence.

## 7. Security

Encryption in transit (TLS) and at rest; database-level tenant isolation (row-level security);
role-based access control; audit logging; session-revocation and breach-containment procedures;
access to production data restricted to authorized personnel with a need to know. Details:
[TRUST PAGE URL].

## 8. Your rights (PDPA §§ 30–36)

You may request: access and a copy; rectification; erasure or anonymization; restriction;
portability; objection; and withdrawal of consent (withdrawal does not affect prior processing).
Contact [privacy@jurisimus.com]. We respond within 30 days. You may also lodge a complaint with the
**Personal Data Protection Committee (PDPC)** — https://www.pdpc.or.th.

## 9. Data breach notification

We notify the PDPC of notifiable breaches within 72 hours of becoming aware, and affected data
subjects where the breach is likely to result in high risk, per PDPA § 37(4).

## 10. Children

The Service is not directed to children and we do not knowingly collect children's data.

## 11. Changes

Material changes will be announced in the product and/or by email before taking effect, with the
version and effective date updated above.`;

export const COOKIE_POLICY_MD = `# Jurisimus — Cookie Policy (DRAFT)

> **STATUS: DRAFT — NOT IN FORCE. NOT LEGAL ADVICE.**
> Prepared 2026-07-11 for review by Thai counsel. Pairs with the consent-banner spec in
> [\`../legal-readiness-plan-2026-07-11.md\`](../legal-readiness-plan-2026-07-11.md) § 3.
> PDPA requires **prior opt-in consent** for non-essential cookies: no pre-ticked boxes, reject as
> prominent as accept, withdrawal as easy as consent, consent records retained.

---

**Effective date:** [DATE] · **Version:** [v1.0]

## 1. What cookies we use

### Strictly necessary (no consent required — cannot be switched off)

| Cookie                           | Purpose                               | Duration           |
| -------------------------------- | ------------------------------------- | ------------------ |
| \`access_token\` / session cookies | authentication and session management | session / [X days] |
| CSRF token                       | request-forgery protection            | session            |
| cookie-consent record            | stores your consent choices           | [12] months        |

### Analytics (consent required — OFF until you opt in)

| Cookie                   | Provider | Purpose                                                     | Duration    |
| ------------------------ | -------- | ----------------------------------------------------------- | ----------- |
| PostHog cookies (\`ph_*\`) | PostHog  | product analytics: feature usage, funnels, session behavior | [12] months |

We do not use advertising or cross-site tracking cookies.

## 2. Consent

On your first visit we show a banner where you can **Accept** or **Reject** analytics cookies with
equal prominence. Analytics tools are not loaded and set no cookies until you accept. We record
your choice (timestamp, choice, policy version) as PDPA-required evidence of consent.

## 3. Withdrawing consent

You can change or withdraw your consent at any time via **Cookie settings** (footer link /
in-app settings). Withdrawal takes effect immediately for future processing; we also stop loading
the analytics tools and delete/expire their cookies where technically possible.

## 4. Managing cookies in your browser

You can also block or delete cookies in your browser settings. Blocking strictly necessary cookies
will break sign-in.

## 5. Changes

We will update this page and re-prompt for consent if we add new non-essential cookie categories.

Questions: [privacy@jurisimus.com].`;
