import { matchIndustries } from "@/lib/avaMatch";
import type { Catalog, Level2 } from "@/lib/types";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ClassifyBody = { text?: string };

type AiPick = {
  bankable_id: string;
  confidence?: number;
  reason?: string;
};

type SlimRow = {
  bankable_id: string;
  level1_id: string;
  level1_label_de: string;
  label_de: string;
};

async function loadCatalog(): Promise<Catalog> {
  const file = path.join(process.cwd(), "public", "data", "branchen_catalog.json");
  return JSON.parse(await readFile(file, "utf8")) as Catalog;
}

function slimCatalog(catalog: Catalog): SlimRow[] {
  return catalog.industry_level2.map((r) => ({
    bankable_id: r.bankable_id,
    level1_id: r.level1_id,
    level1_label_de: r.level1_label_de,
    label_de: r.label_de,
  }));
}

async function openaiJson(system: string, user: string): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const model = process.env.OPENAI_MODEL || "gpt-6-luna";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return JSON.parse(content) as unknown;
}

/**
 * ONE OpenAI round-trip:
 * send slim catalog (235 rows: id + German labels only)
 * → AI returns bankable_ids
 * → we validate against JSON and attach full rows for UI
 *
 * No second call for Hauptbranche then Detailbranche.
 */
export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const body = (await req.json()) as ClassifyBody;
    const text = (body.text || "").trim();
    if (text.length < 2) {
      return NextResponse.json({ error: "text too short" }, { status: 400 });
    }

    const catalog = await loadCatalog();
    const byId = new Map<string, Level2>(
      catalog.industry_level2.map((r) => [r.bankable_id, r])
    );
    const slim = slimCatalog(catalog);

    if (!process.env.OPENAI_API_KEY) {
      const local = matchIndustries(catalog, text, 8);
      return NextResponse.json({
        mode: "local",
        note: "No API key — local text match only",
        candidate_count: slim.length,
        matches: local,
        ms: Date.now() - t0,
      });
    }

    const raw = await openaiJson(
      `You are AVA for BANKABLE industry classification.
User types free keywords (any language). You receive the full BANKABLE Detailbranchen list (German).

Task: choose which catalog rows fit the company.
Rules:
- Only return bankable_id values that appear in the catalog list
- Do NOT invent ids
- Do NOT force 1 keyword = 1 industry
- One keyword may map to several rows; several keywords may share one row
- Return 1–8 best fits, best first
- Prefer covering all distinct themes the user mentioned

JSON only:
{ "picks": [ { "bankable_id": string, "confidence": number, "reason": string } ] }`,
      JSON.stringify({
        user_keywords: text,
        catalog: slim,
      })
    );

    const picks = Array.isArray((raw as { picks?: unknown }).picks)
      ? ((raw as { picks: AiPick[] }).picks as AiPick[])
      : [];

    const matches = picks
      .filter((p) => typeof p?.bankable_id === "string" && byId.has(p.bankable_id))
      .slice(0, 8)
      .map((p) => {
        const level2 = byId.get(p.bankable_id)!;
        return {
          level2,
          score: Math.round((p.confidence ?? 0.7) * 100),
          reasons: p.reason ? [p.reason] : ["AVA"],
        };
      });

    if (matches.length) {
      return NextResponse.json({
        mode: "hybrid",
        note: "Single AI call · slim catalog (235) → bankable_ids",
        candidate_count: slim.length,
        matches,
        ms: Date.now() - t0,
      });
    }

    // Fallback if model returned nothing valid
    const local = matchIndustries(catalog, text, 8);
    return NextResponse.json({
      mode: "local",
      note: "AI returned no valid ids · local fallback",
      candidate_count: slim.length,
      matches: local,
      ms: Date.now() - t0,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "classify failed",
        ms: Date.now() - t0,
      },
      { status: 500 }
    );
  }
}
