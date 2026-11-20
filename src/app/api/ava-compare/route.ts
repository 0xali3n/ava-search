import {
  matchIndustries,
  slimFromLevel2,
  toSlim,
  type SlimCandidate,
} from "@/lib/avaMatch";
import { openaiKey, openaiModel } from "@/lib/openaiEnv";
import type { Catalog, Level2 } from "@/lib/types";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = { text?: string };

type MatchOut = {
  level2: Level2;
  score: number;
  reasons: string[];
};

async function loadCatalog(): Promise<Catalog> {
  const file = path.join(process.cwd(), "public", "data", "branchen_catalog.json");
  return JSON.parse(await readFile(file, "utf8")) as Catalog;
}

async function vectorStoreId() {
  if (process.env.OPENAI_VECTOR_STORE_ID) return process.env.OPENAI_VECTOR_STORE_ID;
  try {
    const t = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    return t.match(/^OPENAI_VECTOR_STORE_ID=(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
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
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return JSON.parse(content) as Record<string, unknown>;
}

async function runHybrid(catalog: Catalog, text: string) {
  const t0 = Date.now();
  const byId = new Map(catalog.industry_level2.map((r) => [r.bankable_id, r]));
  let note = "Local shortlist → OpenAI rank";
  let candidates = uniqueSlim(matchIndustries(catalog, text, 40).map(toSlim));

  if (candidates.length < 5) {
    const raw = await chatJson(
      `Map company description to BANKABLE Level-1. JSON {"level1_ids":string[]} max 4 from list only.`,
      JSON.stringify({
        company_description: text,
        level1_options: catalog.industry_level1.map((x) => ({
          id: x.id,
          label_de: x.label_de,
        })),
      })
    );
    const ids = Array.isArray(raw.level1_ids) ? (raw.level1_ids as string[]) : [];
    const allowedL1 = new Set(catalog.industry_level1.map((x) => x.id));
    const l1Ids = ids.filter((id) => allowedL1.has(id)).slice(0, 4);
    candidates = uniqueSlim([
      ...candidates,
      ...catalog.industry_level2
        .filter((r) => l1Ids.includes(r.level1_id))
        .slice(0, 60)
        .map(slimFromLevel2),
    ]);
    note = "Sparse local → OpenAI L1 bridge → shortlist → rank";
  }

  let matches: MatchOut[] = [];
  if (candidates.length) {
    const ranked = await chatJson(
      `Pick best Detailbranchen. Only bankable_id from candidates. JSON {"picks":[{"bankable_id":string,"confidence":number,"reason":string}]} max 5.`,
      JSON.stringify({ company_description: text, candidates })
    );
    const picks = Array.isArray(ranked.picks) ? ranked.picks : [];
    const allowed = new Set(candidates.map((c) => c.bankable_id));
    matches = picks
      .map((p) => p as { bankable_id?: string; confidence?: number; reason?: string })
      .filter((p) => p.bankable_id && allowed.has(p.bankable_id) && byId.has(p.bankable_id))
      .slice(0, 5)
      .map((p) => ({
        level2: byId.get(p.bankable_id!)!,
        score: Math.round((p.confidence ?? 0.7) * 100),
        reasons: p.reason ? [p.reason] : ["hybrid rank"],
      }));
  }

  if (!matches.length) {
    matches = matchIndustries(catalog, text, 5).map((m) => ({
      level2: m.level2,
      score: m.score,
      reasons: m.reasons,
    }));
    note = `${note} · local fallback`;
  }

  return {
    approach: "hybrid" as const,
    ms: Date.now() - t0,
    note,
    candidate_count: candidates.length,
    matches,
  };
}

async function runVector(catalog: Catalog, text: string, vsId: string) {
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
      tools: [{ type: "file_search", vector_store_ids: [vsId] }],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `Classify into BANKABLE catalog using file_search.
Return JSON only: {"picks":[{"bankable_id":"Bxx.xx","confidence":0-1,"reason":"..."}]} 1-5 picks.
Only real bankable_id values from the uploaded catalog.`,
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: `Company description: ${text}` }],
        },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return {
      approach: "vector" as const,
      ms: Date.now() - t0,
      note: "Vector file_search failed",
      candidate_count: 0,
      matches: [] as MatchOut[],
      error: raw.slice(0, 300),
    };
  }

  const data = JSON.parse(raw) as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  };
  let content =
    data.output_text ||
    data.output?.flatMap((o) => o.content || []).map((c) => c.text || "").join("\n") ||
    "";
  const fence = content.match(/\{[\s\S]*\}/);
  if (fence) content = fence[0];

  let matches: MatchOut[] = [];
  try {
    const parsed = JSON.parse(content) as {
      picks?: { bankable_id?: string; confidence?: number; reason?: string }[];
    };
    matches = (parsed.picks || [])
      .filter((p) => p.bankable_id && byId.has(p.bankable_id))
      .slice(0, 5)
      .map((p) => ({
        level2: byId.get(p.bankable_id!)!,
        score: Math.round((p.confidence ?? 0.7) * 100),
        reasons: p.reason ? [p.reason] : ["vector file_search"],
      }));
  } catch {
    const found = [...new Set(content.match(/B\d{2}\.\d{2}/g) || [])].filter((id) =>
      byId.has(id)
    );
    matches = found.slice(0, 5).map((id) => ({
      level2: byId.get(id)!,
      score: 70,
      reasons: ["parsed from vector response"],
    }));
  }

  return {
    approach: "vector" as const,
    ms: Date.now() - t0,
    note: "OpenAI Vector Store file_search on uploaded catalog",
    candidate_count: matches.length,
    matches,
  };
}

/** Side-by-side: hybrid + vector, with timings */
export async function POST(req: Request) {
  const wall0 = Date.now();
  try {
    const body = (await req.json()) as Body;
    const text = (body.text || "").trim();
    if (text.length < 2) {
      return NextResponse.json({ error: "text too short" }, { status: 400 });
    }

    const catalog = await loadCatalog();
    const vsId = await vectorStoreId();

    const hybridP = runHybrid(catalog, text);
    const vectorP = vsId
      ? runVector(catalog, text, vsId)
      : Promise.resolve({
          approach: "vector" as const,
          ms: 0,
          note: "OPENAI_VECTOR_STORE_ID missing — run /api/ava-vector-setup",
          candidate_count: 0,
          matches: [] as MatchOut[],
          error: "no vector store id",
        });

    const [hybrid, vector] = await Promise.all([hybridP, vectorP]);

    return NextResponse.json({
      model: openaiModel(),
      wall_ms: Date.now() - wall0,
      hybrid,
      vector,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "compare failed",
        wall_ms: Date.now() - wall0,
      },
      { status: 500 }
    );
  }
}
