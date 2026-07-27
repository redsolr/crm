import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Encoding hygiene — no baked-in mojibake in src/ or e2e/.
 *
 * Motivation (2026-07-02): spec files saved with UTF-8 read as
 * Windows-1252 carried mojibake IN the source — an e2e locator hunted a
 * three-char "em dash" the DOM never renders (matters-lab-journey's
 * permanent 90s timeout), and a grounding assertion checked mojibake Thai,
 * passing vacuously. 330 corrupted runs across 25 files were repaired;
 * this tripwire keeps them out.
 *
 * Detector: a run is mojibake iff mapping each char to its Windows-1252
 * byte yields a sequence that STRICTLY decodes as multi-byte UTF-8. A
 * genuine lone "—" maps to 0x97 (invalid UTF-8 alone), so real unicode
 * cannot false-positive.
 */

const REPO_ROOT = join(__dirname, "..", "..");
const SCAN_ROOTS = ["src", "e2e"];

/** cp1252 0x80–0x9F specials (unicode → byte); 0xA0–0xFF map 1:1. */
const CP1252 = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function cp1252Byte(cp: number): number | undefined {
  if (cp >= 0xa0 && cp <= 0xff) return cp;
  return CP1252.get(cp);
}

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

function findMojibake(text: string): { index: number; run: string } | null {
  let i = 0;
  while (i < text.length) {
    const lead = cp1252Byte(text.codePointAt(i) ?? 0);
    if (lead !== undefined && lead >= 0xc2 && lead <= 0xf4) {
      const bytes: number[] = [];
      let j = i;
      while (j < text.length) {
        const b = cp1252Byte(text.codePointAt(j) ?? 0);
        if (b === undefined) break;
        bytes.push(b);
        j += 1;
      }
      for (let k = bytes.length; k >= 2; k -= 1) {
        try {
          strictUtf8.decode(Uint8Array.from(bytes.slice(0, k)));
          return { index: i, run: text.slice(i, i + k) };
        } catch {
          // shorter prefix may still round-trip
        }
      }
    }
    i += 1;
  }
  return null;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
}

describe("encoding hygiene (no baked-in mojibake)", () => {
  it("the detector flags a double-encoded run and passes genuine unicode", () => {
    // Built from \u escapes so this file itself stays clean under its own scan.
    const mojibake = "a \u00e2\u20ac\u201d b";
    expect(findMojibake(mojibake)?.run).toBe("\u00e2\u20ac\u201d");
    expect(findMojibake("a — b → มาตรา 420 “quoted”")).toBeNull();
  });

  it("src/ and e2e/ carry no mojibake", () => {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
      const abs = join(REPO_ROOT, root);
      if (statSync(abs, { throwIfNoEntry: false })?.isDirectory() === true) {
        walk(abs, files);
      }
    }
    expect(files.length).toBeGreaterThan(100);

    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const found = findMojibake(text);
      if (found !== null) {
        const line = text.slice(0, found.index).split("\n").length;
        hits.push(
          `${relative(REPO_ROOT, file)}:${line} — ${JSON.stringify(found.run)}`,
        );
      }
    }
    if (hits.length > 0) {
      throw new Error(
        "Mojibake baked into source (file saved with UTF-8 read as " +
          "Windows-1252). Re-save as UTF-8 or repair the listed runs:\n  " +
          hits.join("\n  "),
      );
    }
  });
});
