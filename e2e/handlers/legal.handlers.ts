/**
 * Route handlers for the Legal Library + intelligent legal search.
 *
 * The legal API is a SEPARATE host from the platform (`NEXT_PUBLIC_LEGAL_API_URL`,
 * default `http://localhost:8787` — the sandbox engine), so these mocks match
 * a host-agnostic `**​/v1/legal/**` glob rather than `API_V1`. One route with
 * internal path-branching avoids Playwright's last-registered-wins ordering
 * between `/sections`, `/sections/search`, and `/sections/:code/:no`.
 *
 * Wire shapes mirror `src/lib/legal/client.ts` Zod schemas exactly (snake_case).
 */

import { Page } from "@playwright/test";

const CODES = [
  { code: "CCC", name_th: "ประมวลกฎหมายแพ่งและพาณิชย์", name_en: "Civil and Commercial Code", section_count: 1848 },
];

const SECTIONS = [
  {
    code: "CCC",
    section_no: "420",
    book: "ลักษณะ ๕ ละเมิด",
    title: "ความรับผิดเพื่อละเมิด",
    chapter: "หมวด ๑",
    preview_th: "ผู้ใดจงใจหรือประมาทเลินเล่อ ทำต่อบุคคลอื่นโดยผิดกฎหมายให้เขาเสียหายถึงแก่ชีวิตก็ดี…",
    text_th:
      "ผู้ใดจงใจหรือประมาทเลินเล่อ ทำต่อบุคคลอื่นโดยผิดกฎหมายให้เขาเสียหายถึงแก่ชีวิตก็ดี แก่ร่างกายก็ดี อนามัยก็ดี เสรีภาพก็ดี ทรัพย์สินหรือสิทธิอย่างหนึ่งอย่างใดก็ดี ท่านว่าผู้นั้นทำละเมิด จำต้องใช้ค่าสินไหมทดแทนเพื่อการนั้น",
    text_en:
      "A person who, wilfully or negligently, unlawfully injures the life, body, health, liberty, property or any right of another person, is said to commit a wrongful act and is bound to make compensation therefor.",
    source_url: "https://example.test/ccc/420",
    cross_refs: ["421", "438"],
    cases: [
      { docid: "deka-1234-2560", citation: "คำพิพากษาศาลฎีกาที่ 1234/2560", source_url: "https://deka.test/1234-2560", raw: "ม. 420" },
    ],
  },
  {
    code: "CCC",
    section_no: "193/30",
    book: "บรรพ ๑ หลักทั่วไป",
    title: "อายุความ",
    chapter: "หมวด ๓",
    preview_th: "อายุความนั้น ถ้าประมวลกฎหมายนี้หรือกฎหมายอื่นมิได้บัญญัติไว้โดยเฉพาะ ให้มีกำหนดสิบปี",
    text_th: "อายุความนั้น ถ้าประมวลกฎหมายนี้หรือกฎหมายอื่นมิได้บัญญัติไว้โดยเฉพาะ ให้มีกำหนดสิบปี",
    text_en:
      "The period of prescription, where not otherwise specifically provided by this Code or other laws, is ten years.",
    source_url: "https://example.test/ccc/193-30",
    cross_refs: ["193/31"],
    cases: [],
  },
];

function jsonRoute(route: import("@playwright/test").Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** Banded confidence object — mirrors the platform's `Confidence` shape
 *  (snake_case `floor_pct`, Stripe v2), built from a plain floor percentage. */
function conf(floorPct: number) {
  const band = floorPct >= 80 ? "high" : floorPct >= 60 ? "medium" : "low";
  return {
    band,
    action: "verify",
    floor_pct: floorPct,
    label: `${band[0].toUpperCase()}${band.slice(1)} (≥${floorPct}%)`,
  };
}

function reviewFinding(sectionNo: string, basis: string, confidence: number) {
  const s = SECTIONS.find((x) => x.section_no === sectionNo)!;
  return {
    section_no: s.section_no,
    citation: `ป.พ.พ. มาตรา ${s.section_no}`,
    basis,
    verified: false,
    confidence: conf(confidence),
    text_th: s.text_th,
    source_url: s.source_url,
  };
}

export async function setupLegalHandlers(page: Page) {
  await page.route("**/v1/legal/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    // POST /v1/legal/findings/:id/work_item — the platform bridge (persist→link)
    const wiMatch = path.match(/\/v1\/legal\/findings\/([^/]+)\/work_item$/);
    if (method === "POST" && wiMatch) {
      const finding = {
        id: decodeURIComponent(wiMatch[1]),
        issue: "linked",
        status: "needs_verification",
        verified: false,
        work_item_id: "wi_e2e_linked",
      };
      return jsonRoute(route, { finding, work_item_id: "wi_e2e_linked" });
    }

    // POST /v1/legal/findings — persist a finding (platform)
    if (method === "POST" && path.endsWith("/v1/legal/findings")) {
      const b = (route.request().postDataJSON() ?? {}) as { issue?: string };
      return jsonRoute(route, {
        finding: {
          id: "lfn_e2e_1",
          issue: b.issue ?? "",
          status: "open",
          verified: false,
          work_item_id: null,
        },
      });
    }

    // POST /v1/legal/review — batch grid (rows = documents)
    if (method === "POST" && path.endsWith("/v1/legal/review")) {
      const body = (route.request().postDataJSON() ?? {}) as {
        documents?: Array<{ id?: string; name?: string; text?: string }>;
      };
      const docs = body.documents ?? [];
      const rows = docs.map((d, i) => {
        const text = d.text ?? "";
        const findings: ReturnType<typeof reviewFinding>[] = [];
        if (/ละเมิด|ประมาท|420/.test(text)) findings.push(reviewFinding("420", "cited-in-passage", 99));
        if (/อายุความ|193\/30/.test(text)) findings.push(reviewFinding("193/30", "semantic-match", 72));
        return {
          id: d.id ?? d.name ?? `doc-${i}`,
          name: d.name ?? `Document ${i + 1}`,
          abstained: findings.length === 0,
          findings,
        };
      });
      return jsonRoute(route, { rows });
    }

    // POST /v1/legal/extract-column — custom column (grounded extraction)
    if (method === "POST" && path.endsWith("/v1/legal/extract-column")) {
      const body = (route.request().postDataJSON() ?? {}) as {
        documents?: Array<{ id?: string; name?: string; text?: string }>;
        prompt?: string;
      };
      const isPersons = /person|name/i.test(body.prompt ?? "");
      const values = (body.documents ?? []).map((d, i) => ({
        id: d.id ?? d.name ?? `doc-${i}`,
        value: (d.text ?? "").trim() ? (isPersons ? "Dade Murphy" : "Extracted value") : "N/A",
      }));
      return jsonRoute(route, { values });
    }

    // POST /v1/legal/ask — matter chat (grounded answer)
    if (method === "POST" && path.endsWith("/v1/legal/ask")) {
      const body = (route.request().postDataJSON() ?? {}) as {
        question?: string;
        documents?: Array<{ name?: string }>;
      };
      const used = (body.documents ?? []).map((d, i) => d.name ?? `Document ${i + 1}`);
      return jsonRoute(route, {
        question: body.question ?? "",
        answer: `Across the ${used.length} documents, termination is generally allowed for material breach [${used[0] ?? "Document 1"}].`,
        used,
      });
    }

    // GET /v1/legal/codes
    if (path.endsWith("/v1/legal/codes")) {
      return jsonRoute(route, CODES);
    }

    // GET /v1/legal/sections/search?q=
    if (path.endsWith("/v1/legal/sections/search")) {
      const q = (url.searchParams.get("q") ?? "").trim();
      const hits =
        q.length < 2
          ? []
          : SECTIONS.filter(
              (s) => s.section_no.includes(q) || s.text_th.includes(q) || /\d/.test(q),
            )
              .slice(0, 5)
              .map((s) => ({
                section_no: s.section_no,
                citation: `ป.พ.พ. มาตรา ${s.section_no}`,
                preview_th: s.preview_th,
                basis: /^\s*\d/.test(q) ? "cited-in-passage" : "semantic-match",
                confidence: conf(/^\s*\d/.test(q) ? 99 : 72),
              }));
      return jsonRoute(route, { query: q, hits });
    }

    // GET /v1/legal/sections/:code/:no
    const detailMatch = path.match(/\/v1\/legal\/sections\/([^/]+)\/([^/]+)$/);
    if (detailMatch) {
      const no = decodeURIComponent(detailMatch[2]);
      const found = SECTIONS.find((s) => s.section_no === no);
      if (!found) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found" }) });
      return jsonRoute(route, found);
    }

    // GET /v1/legal/sections?code=&q=
    if (path.endsWith("/v1/legal/sections")) {
      const code = url.searchParams.get("code") ?? "CCC";
      const q = (url.searchParams.get("q") ?? "").trim();
      const sections = SECTIONS.filter(
        (s) => s.code === code && (!q || s.section_no.includes(q) || s.text_th.includes(q)),
      ).map((s) => ({
        code: s.code,
        section_no: s.section_no,
        book: s.book,
        title: s.title,
        chapter: s.chapter,
        preview_th: s.preview_th,
      }));
      return jsonRoute(route, { code, sections });
    }

    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found" }) });
  });
}
