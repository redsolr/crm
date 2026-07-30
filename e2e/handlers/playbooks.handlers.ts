/**
 * Mock handlers for Playbooks (the firm's codified standards) + the playbook
 * check. Stateful in-memory store so the manager UI renders created playbooks
 * and rules, and the check modal's picker lists them. The check + redline
 * responses are canned (the real verdict / anchor / grounding LOGIC is proven
 * against the backend in `platform/test/legal-playbooks.integration-spec.ts`);
 * this is a UI-render smoke.
 *
 * Wire shapes mirror the platform DTOs — snake_case, prefixed IDs, under
 * `/api/`. Includes suggest_revision / apply_revision returning a
 * `playbook_rule` grounding (the deviation→fix path), so do NOT also register
 * the cite-check `redline.handlers` in the same spec.
 */

import { Page } from "@playwright/test";

const NOW = "2026-06-01T00:00:00.000Z";

interface PlaybookState {
  id: string;
  name: string;
  description: string;
  doc_type: string | null;
  created_at: string;
  updated_at: string;
}
interface RuleState {
  id: string;
  playbook_id: string;
  title: string;
  rule_kind: string;
  instruction: string;
  standard_text: string;
  severity: string;
  position: number;
}

export async function setupPlaybookHandlers(page: Page) {
  const playbooks: PlaybookState[] = [];
  const rules: RuleState[] = [];
  let seq = 0;
  const nextId = (prefix: string): string => {
    seq += 1;
    return `${prefix}_${seq}`;
  };

  const toPlaybook = (p: PlaybookState) => p;
  const rulesOf = (playbookId: string) =>
    rules
      .filter((r) => r.playbook_id === playbookId)
      .sort((a, b) => a.position - b.position);

  // GET/POST /api/legal/playbooks
  await page.route(
    (url) => url.pathname === "/api/legal/playbooks",
    async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ playbooks: playbooks.map(toPlaybook) }),
        });
        return;
      }
      if (request.method() === "POST") {
        const body = (request.postDataJSON() ?? {}) as {
          name?: string;
          description?: string;
          doc_type?: string;
        };
        const pb: PlaybookState = {
          id: nextId("lpb"),
          name: body.name ?? "Untitled playbook",
          description: body.description ?? "",
          doc_type: body.doc_type ?? null,
          created_at: NOW,
          updated_at: NOW,
        };
        playbooks.push(pb);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ playbook: pb }),
        });
        return;
      }
      await route.fallback();
    },
  );

  // GET/DELETE /api/legal/playbooks/:id (detail / delete)
  await page.route(
    (url) => /^\/api\/legal\/playbooks\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      if (request.method() === "GET") {
        const pb = playbooks.find((p) => p.id === id);
        if (!pb) {
          await route.fulfill({ status: 404, body: "{}" });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ playbook: pb, rules: rulesOf(id) }),
        });
        return;
      }
      if (request.method() === "DELETE") {
        const idx = playbooks.findIndex((p) => p.id === id);
        if (idx >= 0) playbooks.splice(idx, 1);
        for (let i = rules.length - 1; i >= 0; i--) {
          if (rules[i].playbook_id === id) rules.splice(i, 1);
        }
        await route.fulfill({ status: 204 });
        return;
      }
      await route.fallback();
    },
  );

  // POST /api/legal/playbooks/:id/rules
  await page.route(
    (url) => /^\/api\/legal\/playbooks\/[^/]+\/rules$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const playbookId = new URL(request.url()).pathname.split("/")[4];
      const body = (request.postDataJSON() ?? {}) as {
        title?: string;
        rule_kind?: string;
        instruction?: string;
        standard_text?: string;
        severity?: string;
      };
      const rule: RuleState = {
        id: nextId("lpr"),
        playbook_id: playbookId,
        title: body.title ?? "Untitled rule",
        rule_kind: body.rule_kind ?? "standard_clause",
        instruction: body.instruction ?? "",
        standard_text: body.standard_text ?? "",
        severity: body.severity ?? "warning",
        position: rulesOf(playbookId).length,
      };
      rules.push(rule);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ rule }),
      });
    },
  );

  // DELETE /api/legal/playbooks/:playbookId/rules/:ruleId
  await page.route(
    (url) =>
      /^\/api\/legal\/playbooks\/[^/]+\/rules\/[^/]+$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "DELETE") {
        await route.fallback();
        return;
      }
      const ruleId = new URL(request.url()).pathname.split("/").pop() ?? "";
      const idx = rules.findIndex((r) => r.id === ruleId);
      if (idx >= 0) rules.splice(idx, 1);
      await route.fulfill({ status: 204 });
    },
  );

  // POST /api/legal/matters/:id/check_playbook → a canned report: one
  // deviation (anchored to a verbatim excerpt of the ingested mock document),
  // one compliant, one missing. The deviation's rule_id matches the first rule
  // of the picked playbook so the redline path is reachable.
  await page.route(
    (url) =>
      /^\/api\/legal\/matters\/[^/]+\/check_playbook$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as { playbook_id?: string };
      const pbId = body.playbook_id ?? playbooks[0]?.id ?? "lpb_1";
      const pb = playbooks.find((p) => p.id === pbId);
      const pbRules = rulesOf(pbId);
      const firstRule = pbRules[0];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          playbook: pb ?? {
            id: pbId,
            name: "NDA Standard",
            description: "",
            doc_type: "NDA",
            created_at: NOW,
            updated_at: NOW,
          },
          results: [
            {
              rule_id: firstRule?.id ?? "lpr_1",
              rule_title: firstRule?.title ?? "Mutual confidentiality",
              rule_kind: firstRule?.rule_kind ?? "required_clause",
              severity: "critical",
              standard_text:
                firstRule?.standard_text ??
                "Each party shall keep the other party’s information confidential.",
              status: "deviation",
              // Verbatim from the ingested mock page content.
              excerpt: "Governing law: State of New York.",
              explanation: "Confidentiality binds only one party — make it mutual.",
            },
            {
              rule_id: "lpr_compliant",
              rule_title: "Governing law present",
              rule_kind: "standard_clause",
              severity: "info",
              standard_text: "",
              status: "compliant",
              excerpt: null,
              explanation: "A governing-law clause is present.",
            },
            {
              rule_id: "lpr_missing",
              rule_title: "Definite term",
              rule_kind: "required_clause",
              severity: "warning",
              standard_text: "",
              status: "missing",
              excerpt: null,
              explanation: "No clause states when the obligation ends.",
            },
          ],
          summary: {
            total: 3,
            compliant: 1,
            deviations: 1,
            missing: 1,
            not_applicable: 0,
            unclear: 0,
          },
        }),
      });
    },
  );

  // POST suggest_revision → a playbook-grounded revision.
  await page.route(
    (url) =>
      /^\/api\/legal\/matters\/[^/]+\/suggest_revision$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      const body = (request.postDataJSON() ?? {}) as {
        clause?: string;
        playbook_rule_id?: string;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggested: true,
          original: body.clause ?? "Governing law: State of New York.",
          revision:
            "Each party shall keep the other party’s Confidential Information confidential.",
          grounding: {
            kind: "playbook_rule",
            rule_id: body.playbook_rule_id ?? "lpr_1",
            rule_title: "Mutual confidentiality",
          },
          message:
            "Proposed a revision grounded in the firm standard “Mutual confidentiality”.",
        }),
      });
    },
  );

  // POST apply_revision → written into the document.
  await page.route(
    (url) => /^\/api\/legal\/matters\/[^/]+\/apply_revision$/.test(url.pathname),
    async (route, request) => {
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          applied: true,
          page: {
            id: "pg-ingested-1",
            title: "Document",
            content:
              "Each party shall keep the other party’s Confidential Information confidential.",
            version: 2,
          },
        }),
      });
    },
  );
}
