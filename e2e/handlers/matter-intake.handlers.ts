/**
 * Mock handlers for the matter-intake-loop LAWYER surfaces (slice 6):
 * `/api/communication_threads/*`, `/api/client_tokens/*`,
 * `/api/communication_threads/:id/create_matter`,
 * `/api/matter_intake_jobs/:id`.
 *
 * Stateful in-memory store so the Tier-1 (mocked) spec exercises the real
 * inbox → create-matter → reveal flow without a backend. Mirrors the
 * platform wire shape (snake_case, prefixed ids). The intake job
 * "streams": each poll advances one more section from `pending` to
 * `succeeded`, so the reveal's progressive populate is observable.
 *
 * URL discipline: every route includes the `/api/` prefix via `API_ROOT`
 * (see `e2e/handlers/shared.ts`). Cascades use `route.fallback()`.
 */

import { Page } from "@playwright/test";
import { API_ROOT } from "./shared";

const NOW = "2026-06-13T00:00:00.000Z";

export interface IntakeThreadSeed {
  id: string;
  client_label: string;
  channel: string;
  /** Seed the thread already linked to a matter (default: unlinked). */
  work_item_id?: string;
}

const DEFAULT_THREADS: IntakeThreadSeed[] = [
  { id: "cth_intake1", client_label: "คุณสมชาย — รถชน", channel: "line_export" },
  { id: "cth_intake2", client_label: "Acme Co — contract review", channel: "native" },
];

interface CommRow {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  sender_kind: string;
  sender_ref: string;
  sender_display: string;
  body_text: string;
  content_kind: string;
  external_message_id: string | null;
  sent_at: string;
  metadata: Record<string, unknown>;
  erased_at: string | null;
  redacted: boolean;
  send_status: string | null;
  created_at: string;
}

/** The ordered section kinds the mock job materializes. */
const SECTION_ORDER = [
  "summary",
  "parties",
  "possible_conflicts",
  "facts",
  "timeline",
  "legal_issues",
  "missing_information",
  "proposed_tasks",
] as const;

function sectionContent(kind: string): Record<string, unknown> {
  switch (kind) {
    case "summary":
      return {
        kind: "summary",
        text: "ลูกความถูกรถชนเมื่อสัปดาห์ที่แล้ว ต้องการเรียกค่าเสียหาย",
        language: "th",
      };
    case "parties":
      return {
        kind: "parties",
        parties: [
          {
            name: "คุณสมชาย ใจดี",
            role: "client",
            source_refs: [
              { id: "comm_seed1", type: "communication", provenance: "message" },
            ],
          },
        ],
      };
    case "possible_conflicts":
      return {
        kind: "possible_conflicts",
        disclaimer: "Deterministic name match — an aid, not a determination.",
        matches: [
          {
            party_name: "คุณสมชาย ใจดี",
            matched_kind: "actor",
            matched_name: "สมชาย ใจดี",
            actor_id: "actor_existing",
          },
        ],
      };
    case "facts":
      return {
        kind: "facts",
        facts: [
          {
            text: "รถได้รับความเสียหายด้านหน้า",
            verified: false,
            source_refs: [
              { id: "att_photo1", type: "attachment", provenance: "photo_unverified" },
            ],
          },
        ],
        dropped_unsupported: 1,
      };
    case "timeline":
      return {
        kind: "timeline",
        entries: [
          {
            date_text: "สัปดาห์ที่แล้ว",
            event: "เกิดอุบัติเหตุรถชน",
            source_refs: [
              { id: "comm_seed1", type: "communication", provenance: "message" },
            ],
          },
        ],
        dropped_unsupported: 0,
      };
    case "legal_issues":
      return {
        kind: "legal_issues",
        issues: [
          {
            title: "ละเมิด (มาตรา 420)",
            rationale: "การกระทำโดยประมาททำให้ผู้อื่นเสียหาย",
            source_refs: [],
            unsourced: true,
            finding_id: "lfn_issue1",
          },
        ],
      };
    case "missing_information":
      return {
        kind: "missing_information",
        items: ["เลขทะเบียนรถคู่กรณี", "รายงานประจำวันของตำรวจ"],
      };
    case "proposed_tasks":
      return {
        kind: "proposed_tasks",
        tasks: [
          {
            title: "ขอสำเนารายงานตำรวจ",
            description: "ติดต่อสถานีตำรวจในพื้นที่เกิดเหตุ",
            work_item_id: "wi_task1",
          },
        ],
        replaced_work_item_ids: [],
      };
    default:
      return {};
  }
}

export interface MatterIntakeMockOptions {
  threads?: IntakeThreadSeed[];
  /** Number of polls before the job reaches `succeeded`. Default 2. */
  pollsUntilDone?: number;
  /**
   * Seed an outbound LINE message with `send_status: 'failed'` so the
   * Communications-activity spec can assert the send-status indicator.
   * Off by default (the slice-6 specs don't expect it).
   */
  seedFailedSend?: boolean;
  /** Return no thread attachments (so the "Shared media & files" section is
   *  absent). Default false → the section shows a photo + a file. */
  threadAttachmentsEmpty?: boolean;
  /**
   * Matter type the latest intake job "detected" (the Questions-to-ask
   * filter signal). When set, GET latest_intake_job returns a succeeded
   * job carrying it instead of the null "never analyzed" default.
   */
  latestJobDetectedMatterType?: string;
  /** Seed the chat-details "Findings" list (GET /api/legal/findings). */
  threadFindings?: Array<{
    id: string;
    issue: string;
    citation: string | null;
    risk_level: string | null;
    confidence_band: string | null;
    verified: boolean;
    work_item_id: string | null;
    thread_id: string | null;
  }>;
}

export async function setupMatterIntakeHandlers(
  page: Page,
  options: MatterIntakeMockOptions = {},
): Promise<void> {
  const threads = [...(options.threads ?? DEFAULT_THREADS)];
  const pollsUntilDone = options.pollsUntilDone ?? 2;
  const seedFailedSend = options.seedFailedSend ?? false;

  // Job state, keyed by job id.
  const jobs = new Map<string, { threadId: string; polls: number }>();
  let jobSeq = 0;
  let tokenSeq = 0;
  const tokensByThread = new Map<
    string,
    Array<{
      id: string;
      thread_id: string;
      label: string | null;
      expires_at: string | null;
      revoked_at: string | null;
      last_used_at: string | null;
      created_by: string;
      created_at: string;
    }>
  >();

  const commsByThread = new Map<string, CommRow[]>();
  const seedComms = (threadId: string): CommRow[] => {
    if (!commsByThread.has(threadId)) {
      commsByThread.set(threadId, [
        {
          id: "comm_seed1",
          thread_id: threadId,
          direction: "inbound",
          sender_kind: "client",
          sender_ref: "import:สมชาย",
          sender_display: "คุณสมชาย",
          body_text: "รถผมโดนชนครับ ช่วยดูให้หน่อย",
          content_kind: "text",
          external_message_id: null,
          sent_at: NOW,
          metadata: {},
          erased_at: null,
          redacted: false,
          send_status: null,
          created_at: NOW,
        },
        {
          id: "comm_photo1",
          thread_id: threadId,
          direction: "inbound",
          sender_kind: "client",
          sender_ref: "import:สมชาย",
          sender_display: "คุณสมชาย",
          body_text: "",
          content_kind: "attachment",
          external_message_id: null,
          sent_at: NOW,
          metadata: { media_kind: "image" },
          erased_at: null,
          redacted: false,
          send_status: null,
          created_at: NOW,
        },
        ...(seedFailedSend
          ? [
              {
                id: "comm_failedsend1",
                thread_id: threadId,
                direction: "outbound" as const,
                sender_kind: "lawyer",
                sender_ref: "account:acc_test",
                sender_display: "ทนายสมหญิง",
                body_text: "ได้รับเรื่องแล้วครับ",
                content_kind: "text",
                external_message_id: "line_oa:reply1",
                sent_at: NOW,
                metadata: {},
                erased_at: null,
                redacted: false,
                // LINE delivery failed → "failed · retry" in the chat window.
                send_status: "failed",
                created_at: NOW,
              },
            ]
          : []),
      ]);
    }
    return commsByThread.get(threadId)!;
  };

  // ----- GET /api/communication_threads (inbox / matter threads) ----------
  await page.route(
    (url) => url.pathname === "/api/communication_threads",
    async (route, request) => {
      if (request.method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            communication_thread: {
              id: `cth_new${Date.now()}`,
              work_item_id: null,
              channel: "native",
              external_ref: null,
              client_label: "New thread",
              status: "open",
              last_communication_at: null,
              client_last_read_at: null,
              created_by: "account:acc_test",
              created_at: NOW,
              updated_at: NOW,
            },
          }),
        });
        return;
      }
      const u = new URL(request.url());
      const workItemId = u.searchParams.get("work_item_id");
      const seededRows = threads.map((t) => ({
        id: t.id,
        work_item_id: t.work_item_id ?? null,
        channel: t.channel,
        external_ref: null,
        client_label: t.client_label,
        status: "open",
        last_communication_at: NOW,
        client_last_read_at: null,
        created_by: "account:acc_test",
        created_at: NOW,
        updated_at: NOW,
      }));
      let rows: Array<Record<string, unknown>>;
      if (workItemId !== null) {
        // One thread attached to the matter.
        rows = [
          {
            id: "cth_intake1",
            work_item_id: workItemId,
            channel: "line_export",
            external_ref: null,
            client_label: "คุณสมชาย — รถชน",
            status: "open",
            last_communication_at: NOW,
            client_last_read_at: null,
            created_by: "account:acc_test",
            created_at: NOW,
            updated_at: NOW,
          },
        ];
      } else {
        // No filter (the combined explorer feed) OR `unassigned=true`: both
        // return the seeded threads — the no-filter case is the platform's
        // documented "every thread in tenant scope" behavior.
        rows = seededRows;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: rows,
          has_more: false,
          next_page_url: null,
          previous_page_url: null,
        }),
      });
    },
  );

  // ----- POST /api/communication_threads/:id/create_matter ----------------
  // `analyze: false` (the chat-panel default) files the matter ONLY —
  // `intake_job` is null; the lawyer runs the AI later via `/analyze`.
  // `analyze: true` (the intake-inbox reveal) create-AND-analyzes: a job
  // is minted + returned for polling.
  await page.route(
    (url) => /^\/api\/communication_threads\/[^/]+\/create_matter$/.test(url.pathname),
    async (route, request) => {
      const threadId =
        new URL(request.url()).pathname.split("/")[3] ?? "cth_intake1";
      const body = (request.postDataJSON() ?? {}) as { analyze?: boolean };
      if (body.analyze === true) {
        jobSeq += 1;
        const jobId = `cmj_${jobSeq}`;
        jobs.set(jobId, { threadId, polls: 0 });
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            intake_job: emptyJob(jobId, threadId),
            work_item: { id: "wi_matter1", title: "รถชน — คุณสมชาย" },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          intake_job: null,
          work_item: { id: "wi_matter1", title: "รถชน — คุณสมชาย" },
        }),
      });
    },
  );

  // ----- POST /api/communication_threads/:id/analyze ----------------------
  // On-demand "Analyze conversation" / "Re-analyze": mints a job and kicks
  // it; the FE then polls GET /api/matter_intake_jobs/:id for streamed
  // sections (same poll machinery the old create-and-analyze used).
  await page.route(
    (url) => /^\/api\/communication_threads\/[^/]+\/analyze$/.test(url.pathname),
    async (route, request) => {
      const threadId =
        new URL(request.url()).pathname.split("/")[3] ?? "cth_intake1";
      jobSeq += 1;
      const jobId = `cmj_${jobSeq}`;
      jobs.set(jobId, { threadId, polls: 0 });
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ intake_job: emptyJob(jobId, threadId) }),
      });
    },
  );

  // ----- POST /api/communication_threads/:id/link_matter ------------------
  // "Add to existing matter" — returns the thread now carrying the chosen
  // work_item_id (the manual counterpart to create_matter).
  await page.route(
    (url) => /^\/api\/communication_threads\/[^/]+\/link_matter$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const threadId = new URL(request.url()).pathname.split("/")[3] ?? "";
      const b = (request.postDataJSON() ?? {}) as { work_item_id?: string };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          communication_thread: {
            id: threadId,
            work_item_id: b.work_item_id ?? "wi_matter1",
            channel: "native",
            external_ref: null,
            client_label: "Linked thread",
            status: "open",
            last_communication_at: NOW,
            client_last_read_at: null,
            created_by: "account:acc_test",
            created_at: NOW,
            updated_at: NOW,
          },
        }),
      });
    },
  );

  // ----- GET /api/matter_intake_jobs/:id (polling) ------------------------
  await page.route(
    (url) => /^\/api\/matter_intake_jobs\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const jobId = new URL(request.url()).pathname.split("/").pop() ?? "";
      const state = jobs.get(jobId);
      if (state === undefined) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "not_found", message: "no job" } }),
        });
        return;
      }
      state.polls += 1;
      const done = state.polls >= pollsUntilDone;
      // Reveal "streams": sections land progressively across polls; once
      // the job is done EVERY section is succeeded (mirrors the backend —
      // a succeeded job never leaves a section pending).
      const landed = done
        ? SECTION_ORDER.length
        : Math.min(
            SECTION_ORDER.length,
            Math.max(
              1,
              Math.floor((SECTION_ORDER.length * state.polls) / pollsUntilDone),
            ),
          );
      const status = done ? "succeeded" : "running";
      const sections = SECTION_ORDER.map((kind, i) => ({
        kind,
        status: i < landed ? "succeeded" : "pending",
        content: i < landed ? sectionContent(kind) : null,
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          intake_job: intakeJob({
            id: jobId,
            thread_id: state.threadId,
            status,
            sections,
            started_at: NOW,
            finished_at: done ? NOW : null,
          }),
        }),
      });
    },
  );

  // ----- GET /api/communication_threads/:id/latest_intake_job -------------
  // Replay endpoint for a reopened linked thread. The mocked flows reach a
  // linked matter only via Create Matter (which polls the live job, not
  // this), so null — "never analyzed in this view" — is the safe default.
  // With `latestJobDetectedMatterType` set, a succeeded job carrying the
  // detected type is returned instead (the Questions-to-ask filter signal).
  await page.route(
    (url) =>
      /^\/api\/communication_threads\/[^/]+\/latest_intake_job$/.test(
        url.pathname,
      ),
    async (route, request) => {
      const detected = options.latestJobDetectedMatterType ?? null;
      if (detected === null) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ intake_job: null }),
        });
        return;
      }
      const threadId = new URL(request.url()).pathname.split("/")[3] ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          intake_job: intakeJob({
            id: "cmj_latest",
            thread_id: threadId,
            status: "succeeded",
            detected_matter_type: detected,
            started_at: NOW,
            finished_at: NOW,
          }),
        }),
      });
    },
  );

  // ----- GET/POST /api/communication_threads/:id/communications -----------
  await page.route(
    (url) => /^\/api\/communication_threads\/[^/]+\/communications$/.test(url.pathname),
    async (route, request) => {
      const threadId = new URL(request.url()).pathname.split("/")[3] ?? "";
      const rows = seedComms(threadId);
      if (request.method() === "POST") {
        const body = (request.postDataJSON() ?? {}) as { body_text?: string };
        const row: CommRow = {
          id: `comm_reply${rows.length}`,
          thread_id: threadId,
          direction: "outbound",
          sender_kind: "lawyer",
          sender_ref: "account:acc_test",
          sender_display: "ทนายสมหญิง",
          body_text: body.body_text ?? "",
          content_kind: "text",
          external_message_id: null,
          sent_at: NOW,
          metadata: {},
          erased_at: null,
          redacted: false,
          send_status: null,
          created_at: NOW,
        };
        rows.push(row);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ communication: row }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: rows,
          has_more: false,
          next_page_url: null,
          previous_page_url: null,
        }),
      });
    },
  );

  // ----- SSE events: refuse so the FE uses its polling fallback ----------
  await page.route(
    (url) => /^\/api\/communication_threads\/[^/]+\/events$/.test(url.pathname),
    async (route) => {
      await route.fulfill({ status: 503, body: "" });
    },
  );

  // ----- GET/POST /api/communication_threads/:id/client_tokens ------------
  await page.route(
    (url) => /^\/api\/communication_threads\/[^/]+\/client_tokens$/.test(url.pathname),
    async (route, request) => {
      const threadId = new URL(request.url()).pathname.split("/")[3] ?? "";
      const list = tokensByThread.get(threadId) ?? [];
      if (request.method() === "POST") {
        tokenSeq += 1;
        const token = {
          id: `clt_${tokenSeq}`,
          thread_id: threadId,
          label: null,
          expires_at: null,
          revoked_at: null,
          last_used_at: null,
          created_by: "acc_test",
          created_at: NOW,
        };
        list.push(token);
        tokensByThread.set(threadId, list);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            client_token: token,
            token: `clt_rawsecret${tokenSeq}base58`,
            link_path: `/c/clt_rawsecret${tokenSeq}base58`,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: list }),
      });
    },
  );

  // ----- GET /api/communications/:id/attachments (inline media) -----------
  await page.route(
    (url) => /^\/api\/communications\/[^/]+\/attachments$/.test(url.pathname),
    async (route, request) => {
      const commId = new URL(request.url()).pathname.split("/")[3] ?? "";
      // The seeded photo message carries one image attachment; others none.
      const data =
        commId === "comm_photo1"
          ? [
              {
                id: "att_photo1",
                parent_type: "communication",
                parent_id: commId,
                s3_key: "uploads/org/photo1.jpg",
                file_name: "accident-front.jpg",
                content_type: "image/jpeg",
                size_bytes: 248_103,
                sha256: null,
                uploaded_by_id: "import:สมชาย",
                uploaded_by_name: "คุณสมชาย",
                // Presigned-GET view URL — a 1x1 data URI stands in for the
                // real S3 URL so the inline <img> renders without a network.
                view_url:
                  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
                created_at: NOW,
              },
            ]
          : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data }),
      });
    },
  );

  // ----- GET /api/communication_threads/:id/attachments (Shared media) ----
  await page.route(
    (url) =>
      /^\/api\/communication_threads\/[^/]+\/attachments$/.test(url.pathname),
    async (route, request) => {
      const threadId = new URL(request.url()).pathname.split("/")[3] ?? "";
      const data = options.threadAttachmentsEmpty
        ? []
        : [
            {
              id: "att_thread_img",
              parent_type: "communication",
              parent_id: "comm_photo1",
              s3_key: "uploads/org/thread-photo.jpg",
              file_name: "accident-front.jpg",
              content_type: "image/jpeg",
              size_bytes: 248_103,
              sha256: null,
              uploaded_by_id: "import:สมชาย",
              uploaded_by_name: "คุณสมชาย",
              view_url:
                "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
              created_at: NOW,
            },
            {
              id: "att_thread_pdf",
              parent_type: "communication",
              parent_id: "comm_file1",
              s3_key: `uploads/org/${threadId}-report.pdf`,
              file_name: "police-report.pdf",
              content_type: "application/pdf",
              size_bytes: 18_204,
              sha256: null,
              uploaded_by_id: "import:สมชาย",
              uploaded_by_name: "คุณสมชาย",
              view_url: null,
              created_at: NOW,
            },
          ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data }),
      });
    },
  );

  // ----- GET /api/legal/findings (chat details "Findings") ----------------
  await page.route(
    (url) => url.pathname === "/api/legal/findings",
    async (route, request) => {
      if (request.method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ findings: options.threadFindings ?? [] }),
      });
    },
  );

  // ----- GET /api/document_families?work_item_id=… ------------------------
  await page.route(
    (url) => url.pathname === "/api/document_families",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "dfam_1",
              work_item_id: "wi_matter1",
              title: "Service Agreement — คู่กรณี",
              origin_legal_document_id: null,
              created_at: NOW,
              updated_at: NOW,
            },
          ],
          has_more: false,
          next_page_url: null,
          previous_page_url: null,
        }),
      });
    },
  );

  // ----- POST /api/client_tokens/:id/revoke -------------------------------
  await page.route(
    (url) => /^\/api\/client_tokens\/[^/]+\/revoke$/.test(url.pathname),
    async (route, request) => {
      const tokenId = new URL(request.url()).pathname.split("/")[3] ?? "";
      let revoked: Record<string, unknown> | null = null;
      for (const list of tokensByThread.values()) {
        const found = list.find((t) => t.id === tokenId);
        if (found !== undefined) {
          found.revoked_at = NOW;
          revoked = found;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          client_token: revoked ?? {
            id: tokenId,
            thread_id: "cth_intake1",
            label: null,
            expires_at: null,
            revoked_at: NOW,
            last_used_at: null,
            created_by: "acc_test",
            created_at: NOW,
          },
        }),
      });
    },
  );
}

/**
 * The ONE canonical intake_job wire object — matches the FE
 * `MatterIntakeJobSchema` (a missing required field fails the strict
 * parse and the reveal silently renders empty). Every handler that
 * returns a job (create_matter 202, job polling, latest_intake_job)
 * builds from this, so the mock shape can't drift field-by-field.
 */
function intakeJob(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: "cmj_default",
    thread_id: "cth_default",
    status: "pending",
    requested_by: "acc_test",
    template_id: null,
    detected_matter_type: null,
    result_work_item_id: "wi_matter1",
    error_code: null,
    sections: [],
    created_at: NOW,
    started_at: null,
    finished_at: null,
    ...overrides,
  };
}

function emptyJob(jobId: string, threadId: string): Record<string, unknown> {
  return intakeJob({ id: jobId, thread_id: threadId });
}

/** Public client-chat mock (`/api/public/matter_chat/:token/*`). */
export async function setupPublicMatterChatHandlers(
  page: Page,
  opts: {
    token?: string;
    firmName?: string;
    /** Client checklists the linked matter carries (default: none). */
    checklists?: Array<{
      id: string;
      title: string;
      items: Array<{ id: string; title: string; completed: boolean }>;
      completed_count: number;
      total_count: number;
    }>;
  } = {},
): Promise<void> {
  const token = opts.token ?? "clt_publicsecret";
  const firmName = opts.firmName ?? "สำนักงานทนายความ ABC";
  const checklists = opts.checklists ?? [];
  const messages: Array<Record<string, unknown>> = [
    {
      id: "comm_pub1",
      direction: "outbound",
      sender_display: "ทนายสมหญิง",
      body_text: "สวัสดีครับ มีอะไรให้ช่วยไหม",
      attachments: [],
      sent_at: NOW,
    },
  ];

  await page.route(
    (url) => url.pathname === `/api/public/matter_chat/${token}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          matter_chat: {
            firm_name: firmName,
            client_label: "คุณสมชาย — รถชน",
            status: "open",
          },
          communications: {
            data: messages,
            has_more: false,
            next_page_url: null,
            previous_page_url: null,
          },
          checklists,
        }),
      });
    },
  );

  await page.route(
    (url) => url.pathname === `/api/public/matter_chat/${token}/communications`,
    async (route, request) => {
      const body = (request.postDataJSON() ?? {}) as { body_text?: string };
      const row = {
        id: `comm_pubin${messages.length}`,
        direction: "inbound",
        sender_display: "คุณสมชาย",
        body_text: body.body_text ?? "",
        attachments: [],
        sent_at: NOW,
      };
      messages.push(row);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ communication: row }),
      });
    },
  );

  await page.route(
    (url) => url.pathname === `/api/public/matter_chat/${token}/events`,
    async (route) => {
      // Refuse SSE → the public page uses its polling fallback.
      await route.fulfill({ status: 503, body: "" });
    },
  );

  // Unknown token → uniform 404 (the not-found surface).
  await page.route(
    (url) =>
      url.pathname.startsWith("/api/public/matter_chat/") &&
      !url.pathname.startsWith(`/api/public/matter_chat/${token}`),
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "not_found", message: "Not found" } }),
      });
    },
  );

  void API_ROOT;
}
