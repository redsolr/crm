import { test, expect, type Page } from "@playwright/test";
import { envLocal, loginWithPassword } from "./helpers/real-auth";

/**
 * The OpenAI-backed surfaces against the REAL model (deferred row
 * 23.4, buildable since the 2026-08-02 provider swap): the Ask agentic
 * loop (streaming + tool execution + grounded answer), agent
 * ATTRIBUTION (in-app Ask writes stamp "Ask assistant"; the /mcp door
 * stamps "Claude (agent)"), and ✨ attribute enrichment.
 *
 * TRIPLE-gated: real-auth WorkOS creds + OPENAI_API_KEY +
 * RUN_REAL_LLM_E2E=true — a normal tier run skips it. CI runs it with
 * CRM_ASK_MODEL=gpt-5.4-nano so a full run costs a fraction of a
 * cent. Assertions stay LOOSE where the model is nondeterministic
 * (tool choice + record truth, never exact wording).
 */

const email = envLocal("E2E_WORKOS_EMAIL");
const password = envLocal("E2E_WORKOS_PASSWORD");
const mcpToken = envLocal("CRM_MCP_TOKEN");
const openaiKey = envLocal("OPENAI_API_KEY");
const enabled = process.env.RUN_REAL_LLM_E2E === "true";

const stamp = Date.now().toString(36);
const COMPANY = `E2E LLM Co ${stamp}`;
const DEAL = `E2E LLM Deal ${stamp}`;

/** Collect a full SSE body from the Ask responses route. */
async function askStream(
  page: Page,
  chatId: string,
  input: string,
): Promise<{ events: Record<string, number>; toolSteps: string[]; text: string }> {
  const body = await page.evaluate(
    async ({ id, message }) => {
      const res = await fetch(`/api/chats/${id}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: message }),
      });
      return await res.text();
    },
    { id: chatId, message: input },
  );
  const events: Record<string, number> = {};
  const toolSteps: string[] = [];
  let text = "";
  for (const line of body.split("\n")) {
    if (line.startsWith("event:")) {
      const e = line.slice(6).trim();
      events[e] = (events[e] ?? 0) + 1;
    }
    if (line.startsWith("data:")) {
      try {
        const data = JSON.parse(line.slice(5)) as {
          type?: string;
          tool_name?: string;
          delta?: { type?: string; text?: string };
        };
        if (data.type === "tool_step" && data.tool_name) {
          toolSteps.push(data.tool_name);
        }
        if (data.delta?.type === "text_delta" && data.delta.text) {
          text += data.delta.text;
        }
      } catch {
        // keep-alive/comment lines
      }
    }
  }
  return { events, toolSteps, text };
}

test("Ask loop answers grounded, writes as Ask assistant; /mcp writes as Claude", async ({
  page,
}) => {
  test.setTimeout(300_000);
  test.skip(
    !email || !password,
    "E2E_WORKOS_* missing (env or .env.local)",
  );
  test.skip(!openaiKey, "OPENAI_API_KEY missing — nothing to test");
  test.skip(!mcpToken, "CRM_MCP_TOKEN missing");
  test.skip(
    !enabled,
    "RUN_REAL_LLM_E2E not set — paid-model spec is opt-in",
  );

  await loginWithPassword(page, email!, password!);

  // Seed a known record pair through the UI-facing API (authed cookies).
  const accountRes = await page.request.post("/api/work_items", {
    headers: { "Idempotency-Key": `e2e-llm-acc-${stamp}` },
    data: { title: COMPANY, type_key: "account", state_key: "active" },
  });
  if (!accountRes.ok()) {
    console.log(
      "work_items POST failed:",
      accountRes.status(),
      (await accountRes.text()).slice(0, 300),
    );
  }
  expect(accountRes.ok()).toBeTruthy();
  const accountId = ((await accountRes.json()) as {
    work_item: { id: string };
  }).work_item.id;
  const dealRes = await page.request.post("/api/work_items", {
    headers: { "Idempotency-Key": `e2e-llm-deal-${stamp}` },
    data: {
      title: DEAL,
      type_key: "opportunity",
      state_key: "call_booked",
      parent_id: accountId,
    },
  });
  expect(dealRes.ok()).toBeTruthy();
  const dealId = ((await dealRes.json()) as { work_item: { id: string } })
    .work_item.id;

  // ── 1. Grounded READ: the loop must use find_crm_record and answer
  //       with the real stage ───────────────────────────────────────────
  const chatRes = await page.request.post("/api/chats", {
    data: { title: "real-llm spec" },
  });
  const chatBody = (await chatRes.json()) as {
    chat?: { id: string };
    id?: string;
  };
  const chatId = chatBody.chat?.id ?? chatBody.id!;

  const read = await askStream(
    page,
    chatId,
    `What pipeline stage is the deal named "${DEAL}" in right now? Look it up.`,
  );
  expect(read.events["message_start"]).toBeGreaterThanOrEqual(1);
  expect(read.events["message_stop"]).toBe(1);
  expect(read.toolSteps).toContain("find_crm_record");
  expect(read.text.toLowerCase()).toContain("call");

  // ── 2. Agentic WRITE via Ask: the call note lands, stamped by the
  //       GPT-powered assistant ────────────────────────────────────────
  const write = await askStream(
    page,
    chatId,
    `Log a call note on the deal "${DEAL}": quick sync today, they confirmed the demo. Positive outcome.`,
  );
  expect(write.toolSteps).toContain("log_call_note");

  const childrenRes = await page.request.get(
    `/api/work_items?parent_id=${dealId}&type_key=call_note`,
  );
  const children = ((await childrenRes.json()) as {
    data: Array<{ created_by_name: string | null }>;
  }).data;
  expect(children.length).toBeGreaterThanOrEqual(1);
  expect(children[0]!.created_by_name).toBe("Ask assistant");

  // ── 3. /mcp door writes as Claude (attribution split, other half) ──
  const mcpRes = await page.request.post("/mcp", {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${mcpToken}`,
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "create_commitment",
        arguments: {
          record_id: dealId,
          title: `E2E LLM commitment ${stamp}`,
          due_date: "2027-01-01",
        },
      },
    },
  });
  expect(mcpRes.ok()).toBeTruthy();
  const commitsRes = await page.request.get(
    `/api/work_items?parent_id=${dealId}&type_key=commitment`,
  );
  const commits = ((await commitsRes.json()) as {
    data: Array<{ created_by_name: string | null }>;
  }).data;
  expect(commits.length).toBeGreaterThanOrEqual(1);
  expect(commits[0]!.created_by_name).toBe("Claude (agent)");

  // ── 4. ✨ Enrichment /compute — real model fills an AI column ───────
  const wsRes = await page.request.get("/api/workspaces");
  const wsBody = (await wsRes.json()) as { workspaces: Array<{ id: string }> };
  const typesRes = await page.request.get(
    `/api/workspaces/${wsBody.workspaces[0]!.id}/work_item_types`,
  );
  const types = ((await typesRes.json()) as {
    data: Array<{ id: string; key: string }>;
  }).data;
  const accountType = types.find((t) => t.key === "account")!;
  const adefsRes = await page.request.get(
    `/api/work_item_types/${accountType.id}/attribute_definitions`,
  );
  const adefs = ((await adefsRes.json()) as {
    data: Array<{ id: string; key: string; config: unknown }>;
  }).data;
  const enrichable = adefs.find(
    (d) =>
      typeof d.config === "object" &&
      d.config !== null &&
      "enrichment" in (d.config as Record<string, unknown>),
  );
  // Conditional, NOT test.skip — a mid-test skip would discard the
  // loop/attribution assertions above from the report.
  if (enrichable) {
    const computeRes = await page.request.post(
      `/api/work_items/${accountId}/attribute_values/${enrichable.id}/compute`,
      { data: {} },
    );
    expect(computeRes.ok()).toBeTruthy();
    const compute = (await computeRes.json()) as {
      outcome: string;
      value: unknown;
    };
    // "failed" is allowed (a nano-tier model may emit an invalid select
    // value) — the covered claim is the ROUTE + model round-trip, not
    // model quality. A 500 or malformed body still fails the spec.
    expect(["computed", "skipped_manual_override", "failed"]).toContain(
      compute.outcome,
    );
    if (compute.outcome === "failed") {
      console.warn(
        "[real-llm spec] enrichment outcome=failed (model quality, not wiring)",
      );
    }
  } else {
    console.warn(
      "[real-llm spec] no enrichment-configured attribute — /compute not exercised. Keys:",
      adefs.map((d) => d.key).join(","),
    );
  }

  // ── Cleanup: close the deal (accumulating-DB etiquette) ────────────
  await page.request.patch(`/api/work_items/${dealId}`, {
    headers: { "If-Match": 'W/"v2"', "Idempotency-Key": `e2e-llm-close-${stamp}` },
    data: { state_key: "lost" },
    failOnStatusCode: false,
  });
});
