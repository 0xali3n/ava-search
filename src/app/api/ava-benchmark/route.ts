import {
  matchIndustries,
  slimFromLevel2,
  toSlim,
  type SlimCandidate,
} from "@/lib/avaMatch";
import { openaiKey, openaiModel } from "@/lib/openaiEnv";
import type { Catalog } from "@/lib/types";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Case = {
  text: string;
  /** Expected bankable_ids (any order) for rough accuracy */
  expect: string[];
};

const CASES: Case[] = [
  {
    text: "Lebensmittel Großhandel",
    expect: ["B11.08"],
  },
  {
    text: "Solar Projektentwicklung Erneuerbare",
    expect: ["B09.03"],
  },
  {
    text: "toys making sports things",
    expect: ["B04.15", "B04.16"],
  },
  {
    text: "Event Catering Restaurant",
    expect: ["B21.04", "B21.03", "B21.07"],
  },
  {
    text: "Maschinenbau Anlagen",
    expect: ["B01.01"],
  },
];

async function loadCatalog(): Promise<Catalog> {
  const file = path.join(process.cwd(), "public", "data", "branchen_catalog.json");
  return JSON.parse(await readFile(file, "utf8")) as Catalog;
}

function uniqueSlim(rows: SlimCandidate[]) {
  const seen = new Set<string>();
  const out: SlimCandidate[] = [];
  for (const r of rows) {
    if (seen.has(r.bankable_id)) continue;
    seen.add(r.bankable_id);
    out.push(r);
  }
  return out;
}

async function chatJson(system: string, user: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openaiModel(),
      response_format: { type: "json_object" },
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`chat ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty chat content");
  return JSON.parse(content) as { picks?: { bankable_id?: string }[] };
}

/** Hybrid = current production approach */
async function runHybrid(catalog: Catalog, text: string) {
  const t0 = Date.now();
  const byId = new Map(catalog.industry_level2.map((r) => [r.bankable_id, r]));
  let candidates = uniqueSlim(matchIndustries(catalog, text, 40).map(toSlim));

  if (candidates.length < 5) {
    const l1raw = await chatJson(
      `Map company description to BANKABLE Level-1. JSON: {"level1_ids":string[]} max 4, only from list.`,
      JSON.stringify({
        company_description: text,
        level1_options: catalog.industry_level1.map((x) => ({
          id: x.id,
          label_de: x.label_de,
        })),
      })
    );
    const ids = Array.isArray((l1raw as { level1_ids?: string[] }).level1_ids)
      ? ((l1raw as { level1_ids: string[] }).level1_ids as string[])
      : [];
    const allowed = new Set(catalog.industry_level1.map((x) => x.id));
    const l1Ids = ids.filter((id) => allowed.has(id)).slice(0, 4);
    const expanded = catalog.industry_level2
      .filter((r) => l1Ids.includes(r.level1_id))
      .slice(0, 60)
      .map(slimFromLevel2);
    candidates = uniqueSlim([...candidates, ...expanded]);
  }

  let ids: string[] = [];
  if (candidates.length) {
    const ranked = await chatJson(
      `Pick best BANKABLE Detailbranchen. Only bankable_id from candidates. JSON: {"picks":[{"bankable_id":string}]} max 5.`,
      JSON.stringify({ company_description: text, candidates })
    );
    const allowed = new Set(candidates.map((c) => c.bankable_id));
    ids = (ranked.picks || [])
      .map((p) => p.bankable_id)
      .filter((id): id is string => !!id && allowed.has(id) && byId.has(id))
      .slice(0, 5);
  }

  if (!ids.length) {
    ids = matchIndustries(catalog, text, 5).map((m) => m.level2.bankable_id);
  }

  return {
    approach: "hybrid" as const,
    ms: Date.now() - t0,
    ids,
    labels: ids.map((id) => byId.get(id)?.label_de || id),
  };
}

/** Vector Store file_search via Responses API */
async function runVector(catalog: Catalog, text: string, vectorStoreId: string) {
  const t0 = Date.now();
  const byId = new Map(catalog.industry_level2.map((r) => [r.bankable_id, r]));

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openaiModel(),
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
        },
      ],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `You classify companies into the BANKABLE Branchenkatalog.
Use file_search on the uploaded catalog.
Return ONLY valid bankable_id values that exist in the catalog (e.g. B04.15).
Respond as JSON object: {"picks":[{"bankable_id":"...","reason":"..."}]} with 1-5 picks, best first.
Do not invent ids.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Company description: ${text}`,
            },
          ],
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return {
      approach: "vector" as const,
      ms: Date.now() - t0,
      ids: [] as string[],
      labels: [] as string[],
      error: raw.slice(0, 400),
    };
  }

  const data = JSON.parse(raw) as {
    output_text?: string;
    output?: {
      type?: string;
      content?: { type?: string; text?: string }[];
    }[];
  };

  let content =
    data.output_text ||
    data.output
      ?.flatMap((o) => o.content || [])
      .map((c) => c.text || "")
      .join("\n") ||
    "";

  // Sometimes JSON is wrapped in markdown fences
  const fence = content.match(/\{[\s\S]*\}/);
  if (fence) content = fence[0];

  let ids: string[] = [];
  try {
    const parsed = JSON.parse(content) as { picks?: { bankable_id?: string }[] };
    ids = (parsed.picks || [])
      .map((p) => p.bankable_id)
      .filter((id): id is string => !!id && byId.has(id))
      .slice(0, 5);
  } catch {
    // fallback: scrape Bxx.xx patterns that exist in catalog
    const found = content.match(/B\d{2}\.\d{2}/g) || [];
    ids = [...new Set(found)].filter((id) => byId.has(id)).slice(0, 5);
  }

  return {
    approach: "vector" as const,
    ms: Date.now() - t0,
    ids,
    labels: ids.map((id) => byId.get(id)?.label_de || id),
  };
}

function scoreHit(expect: string[], got: string[]) {
  if (!expect.length) return { hit: false, overlap: 0 };
  const set = new Set(got);
  const overlap = expect.filter((id) => set.has(id)).length;
  return { hit: overlap > 0, overlap, expected: expect.length };
}

export async function POST() {
  const wall0 = Date.now();
  try {
    const catalog = await loadCatalog();
    const vectorStoreId =
      process.env.OPENAI_VECTOR_STORE_ID ||
      // freshly written by setup; also read .env.local in case process not restarted
      (await readFile(path.join(process.cwd(), ".env.local"), "utf8")
        .then((t) => t.match(/^OPENAI_VECTOR_STORE_ID=(.+)$/m)?.[1]?.trim())
        .catch(() => undefined));

    if (!vectorStoreId) {
      return NextResponse.json(
        {
          error:
            "OPENAI_VECTOR_STORE_ID missing — run POST /api/ava-vector-setup first",
        },
        { status: 400 }
      );
    }

    const rows = [];
    for (const c of CASES) {
      const hybrid = await runHybrid(catalog, c.text);
      const vector = await runVector(catalog, c.text, vectorStoreId);
      const hScore = scoreHit(c.expect, hybrid.ids);
      const vScore = scoreHit(c.expect, vector.ids);
      rows.push({
        query: c.text,
        expect: c.expect,
        hybrid: { ...hybrid, ...hScore },
        vector: { ...vector, ...vScore },
      });
    }

    const hybridHits = rows.filter((r) => r.hybrid.hit).length;
    const vectorHits = rows.filter((r) => r.vector.hit).length;
    const hybridAvg =
      rows.reduce((s, r) => s + r.hybrid.ms, 0) / Math.max(rows.length, 1);
    const vectorAvg =
      rows.reduce((s, r) => s + r.vector.ms, 0) / Math.max(rows.length, 1);

    return NextResponse.json({
      model: openaiModel(),
      vector_store_id: vectorStoreId,
      cases: rows.length,
      summary: {
        hybrid_hits: `${hybridHits}/${rows.length}`,
        vector_hits: `${vectorHits}/${rows.length}`,
        hybrid_avg_ms: Math.round(hybridAvg),
        vector_avg_ms: Math.round(vectorAvg),
        wall_ms: Date.now() - wall0,
        winner_accuracy:
          hybridHits === vectorHits
            ? "tie"
            : hybridHits > vectorHits
              ? "hybrid"
              : "vector",
        winner_speed: hybridAvg <= vectorAvg ? "hybrid" : "vector",
      },
      rows,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "benchmark failed",
        wall_ms: Date.now() - wall0,
      },
      { status: 500 }
    );
  }
}
