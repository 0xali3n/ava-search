import { openaiKey } from "@/lib/openaiEnv";
import type { Catalog } from "@/lib/types";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

async function loadCatalog(): Promise<Catalog> {
  const file = path.join(process.cwd(), "public", "data", "branchen_catalog.json");
  return JSON.parse(await readFile(file, "utf8")) as Catalog;
}

function flatCatalogText(catalog: Catalog) {
  const lines = catalog.industry_level2.map(
    (r) =>
      `${r.bankable_id} | ${r.level1_id} | ${r.level1_label_de} | ${r.label_de} | WZ ${r.wz2025_leitcodes || "-"}`
  );
  return [
    "BANKABLE Branchenkatalog — one line per Detailbranche",
    "Format: bankable_id | level1_id | Hauptbranche | Detailbranche | WZ",
    "",
    ...lines,
  ].join("\n");
}

async function openaiForm(url: string, form: FormData) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey()}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as { id: string; status?: string };
}

async function openaiJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${openaiKey()}`,
      "Content-Type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

async function waitFileReady(vectorStoreId: string, fileId: string) {
  const started = Date.now();
  for (;;) {
    const st = await openaiJson(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files/${fileId}`,
      null,
      "GET"
    );
    const status = String(st.status || "");
    if (status === "completed") return Date.now() - started;
    if (status === "failed" || status === "cancelled") {
      throw new Error(`Vector file ${fileId} status=${status}`);
    }
    if (Date.now() - started > 90_000) {
      throw new Error(`Timeout waiting for vector file ${fileId}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/**
 * One-time setup: upload mega JSON (+ flat text for better RAG chunks)
 * into an OpenAI Vector Store. Writes OPENAI_VECTOR_STORE_ID into .env.local.
 */
export async function POST() {
  const t0 = Date.now();
  try {
    const catalog = await loadCatalog();
    const jsonPath = path.join(process.cwd(), "public", "data", "branchen_catalog.json");
    const jsonBytes = await readFile(jsonPath);
    const flat = flatCatalogText(catalog);
    const flatPath = path.join(process.cwd(), "public", "data", "branchen_catalog_flat.txt");
    await writeFile(flatPath, flat, "utf8");

    const vs = (await openaiJson("https://api.openai.com/v1/vector_stores", {
      name: `bankable-branchen-${catalog.meta.version || "v4"}`,
    })) as { id: string };

    async function uploadAndAttach(name: string, bytes: Buffer, type: string) {
      const form = new FormData();
      form.append("purpose", "assistants");
      // Uint8Array avoids Buffer↔BlobPart mismatch under stricter DOM typings
      const part = new Uint8Array(bytes);
      form.append("file", new Blob([part], { type }), name);
      const file = await openaiForm("https://api.openai.com/v1/files", form);
      await openaiJson(
        `https://api.openai.com/v1/vector_stores/${vs.id}/files`,
        { file_id: file.id }
      );
      const indexMs = await waitFileReady(vs.id, file.id);
      return { file_id: file.id, name, index_ms: indexMs };
    }

    const uploaded = [];
    uploaded.push(
      await uploadAndAttach(
        "branchen_catalog.json",
        jsonBytes,
        "application/json"
      )
    );
    uploaded.push(
      await uploadAndAttach(
        "branchen_catalog_flat.txt",
        Buffer.from(flat, "utf8"),
        "text/plain"
      )
    );

    // Persist store id for later requests (keep existing key/model lines)
    const envPath = path.join(process.cwd(), ".env.local");
    let envText = await readFile(envPath, "utf8");
    if (/^OPENAI_VECTOR_STORE_ID=/m.test(envText)) {
      envText = envText.replace(
        /^OPENAI_VECTOR_STORE_ID=.*$/m,
        `OPENAI_VECTOR_STORE_ID=${vs.id}`
      );
    } else {
      envText = `${envText.trimEnd()}\nOPENAI_VECTOR_STORE_ID=${vs.id}\n`;
    }
    await writeFile(envPath, envText, "utf8");

    return NextResponse.json({
      ok: true,
      vector_store_id: vs.id,
      uploaded,
      total_ms: Date.now() - t0,
      note: "Restart Next.js (or wait) so OPENAI_VECTOR_STORE_ID is loaded into process env.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        total_ms: Date.now() - t0,
        error: e instanceof Error ? e.message : "setup failed",
      },
      { status: 500 }
    );
  }
}
