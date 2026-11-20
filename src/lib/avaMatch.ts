import type { Catalog, Level2 } from "./types";
import { norm } from "./search";

export type AvaMatch = {
  level2: Level2;
  score: number;
  reasons: string[];
};

function tokens(text: string): string[] {
  return norm(text)
    .split(/[^a-z0-9äöüß.+*-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function scoreField(field: string, toks: string[]): { pts: number; hits: string[] } {
  const hay = norm(field);
  if (!hay) return { pts: 0, hits: [] };
  let pts = 0;
  const hits: string[] = [];
  for (const t of toks) {
    if (hay === t) {
      pts += 12;
      hits.push(t);
    } else if (hay.includes(t)) {
      pts += t.length >= 5 ? 6 : 3;
      hits.push(t);
    }
  }
  return { pts, hits };
}

/** Slim row sent to OpenAI (never the full catalog JSON). */
export type SlimCandidate = {
  bankable_id: string;
  level1_id: string;
  level1_label_de: string;
  label_de: string;
  wz2025_leitcodes: string;
};

export function toSlim(m: AvaMatch): SlimCandidate {
  const l2 = m.level2;
  return {
    bankable_id: l2.bankable_id,
    level1_id: l2.level1_id,
    level1_label_de: l2.level1_label_de,
    label_de: l2.label_de,
    wz2025_leitcodes: l2.wz2025_leitcodes,
  };
}

export function slimFromLevel2(l2: Level2): SlimCandidate {
  return {
    bankable_id: l2.bankable_id,
    level1_id: l2.level1_id,
    level1_label_de: l2.level1_label_de,
    label_de: l2.label_de,
    wz2025_leitcodes: l2.wz2025_leitcodes,
  };
}

/**
 * Local prefilter: free text → ranked Detailbranchen (parent already linked).
 * Used alone as fallback, or as candidate shortlist before OpenAI.
 */
export function matchIndustries(catalog: Catalog, text: string, limit = 8): AvaMatch[] {
  const toks = tokens(text);
  if (!toks.length) return [];

  const scored: AvaMatch[] = [];

  for (const l2 of catalog.industry_level2) {
    const r1 = scoreField(l2.label_de, toks);
    const r2 = scoreField(l2.level1_label_de, toks);
    const r3 = scoreField(l2.wz2025_leitcodes, toks);
    const r4 = scoreField(l2.bankable_id, toks);
    const r5 = scoreField(l2.note_de, toks);
    const r6 = scoreField(l2.nace_rev21, toks);

    const score =
      r1.pts * 3 + r2.pts * 2 + r3.pts * 2 + r4.pts + r5.pts + r6.pts;

    if (score <= 0) continue;

    const reasons: string[] = [];
    if (r1.hits.length) reasons.push(`Detailbranche: ${r1.hits.slice(0, 2).join(", ")}`);
    if (r2.hits.length) reasons.push(`Hauptbranche: ${r2.hits.slice(0, 2).join(", ")}`);
    if (r3.hits.length) reasons.push(`WZ: ${r3.hits.slice(0, 2).join(", ")}`);

    scored.push({ level2: l2, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score || a.level2.bankable_id.localeCompare(b.level2.bankable_id));
  return scored.slice(0, limit);
}
