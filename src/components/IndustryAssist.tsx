"use client";

import SearchableSelect from "@/components/registration/SearchableSelect";
import type { AvaMatch } from "@/lib/avaMatch";
import type { Catalog, Level2 } from "@/lib/types";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";

type Assigned = {
  id: string;
  bankable_id: string;
  pct: string;
};

type ClassifyResponse = {
  model?: string;
  matches?: AvaMatch[];
  error?: string;
};

const SUGGEST_CHIPS = [
  "toy making",
  "beauty industry",
  "manufacture",
  "food wholesale",
  "solar projects",
  "catering",
  "recycling",
];

type Props = { catalog: Catalog };

export default function IndustryAssist({ catalog }: Props) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [meta, setMeta] = useState<{ ms?: number }>({});
  const [error, setError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Assigned[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualL1, setManualL1] = useState("");
  const [manualL2, setManualL2] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => {
    const m = new Map<string, Level2>();
    catalog.industry_level2.forEach((r) => m.set(r.bankable_id, r));
    return m;
  }, [catalog]);

  /** Always German labels from our JSON — never trust display text from the model */
  function de(bankable_id: string) {
    return byId.get(bankable_id) || null;
  }

  function addKeyword(raw: string) {
    const parts = raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setKeywords((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.some((k) => k.toLowerCase() === p.toLowerCase())) next.push(p);
      }
      return next;
    });
    setDraft("");
  }

  function removeKeyword(k: string) {
    setKeywords((prev) => prev.filter((x) => x !== k));
  }

  async function runAnalyze() {
    const fromDraft = draft
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const unique: string[] = [];
    for (const k of [...keywords, ...fromDraft]) {
      if (!unique.some((u) => u.toLowerCase() === k.toLowerCase())) unique.push(k);
    }
    if (!unique.length) return;

    setKeywords(unique);
    setDraft("");
    setAnalyzing(true);
    setError(null);
    const t0 = performance.now();

    try {
      const res = await fetch("/api/ava-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: unique.join(", ") }),
      });
      const data = (await res.json()) as ClassifyResponse;
      if (!res.ok) throw new Error(data.error || "Analyze failed");

      const matches = (data.matches || []).filter((m) => byId.has(m.level2.bankable_id));
      // Direct down into Assigned — no extra Add click
      setAssigned((prev) => {
        const next = [...prev];
        for (const m of matches) {
          if (next.some((a) => a.bankable_id === m.level2.bankable_id)) continue;
          next.push({
            id: crypto.randomUUID(),
            bankable_id: m.level2.bankable_id,
            pct: "",
          });
        }
        return next;
      });
      setMeta({
        ms: Math.round(performance.now() - t0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyze failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function addManual() {
    if (!manualL2 || !byId.has(manualL2)) return;
    setAssigned((prev) => {
      if (prev.some((a) => a.bankable_id === manualL2)) return prev;
      return [
        ...prev,
        { id: crypto.randomUUID(), bankable_id: manualL2, pct: "" },
      ];
    });
    setManualL1("");
    setManualL2("");
    setShowManual(false);
  }

  function setPct(id: string, pct: string) {
    setAssigned((prev) =>
      prev.map((a) => (a.id === id ? { ...a, pct: pct.replace(/[^\d.]/g, "") } : a))
    );
  }

  const pctSum = assigned.reduce((s, a) => s + (Number(a.pct) || 0), 0);
  const canAnalyze = keywords.length > 0 || draft.trim().length >= 2;

  const l1Options = catalog.industry_level1.map((l1) => ({
    value: l1.id,
    label: l1.label_de,
  }));
  const l2Options = catalog.industry_level2
    .filter((x) => !manualL1 || x.level1_id === manualL1)
    .map((l2) => ({
      value: l2.bankable_id,
      label: l2.label_de,
      hint: manualL1 ? undefined : l2.level1_label_de,
    }));

  return (
    <div className="reg-light min-h-svh">
      <div className="mx-auto max-w-[880px] px-5 py-6 md:px-8 md:py-8">
        {/* Figma-style top bar */}
        <header className="mb-6 flex items-center justify-between">
          <Image
            src="/brand/figma/logo.png"
            alt="BANKABLE"
            width={208}
            height={24}
            className="h-6 w-auto"
            priority
          />
          <div
            className="flex items-center gap-2 rounded-2xl px-4 py-2"
            style={{ background: "var(--progress-track)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/figma/sparkles.svg" alt="" width={18} height={18} />
            <span className="text-[13px] font-semibold tracking-[0.04em] text-[var(--blue-2)]">
              AVA
            </span>
          </div>
        </header>

        <section
          className="rounded-2xl px-5 py-5 md:px-8 md:py-6"
          style={{ background: "var(--card)" }}
        >
          <h1 className="text-[22px] font-semibold leading-snug text-[var(--ink)] md:text-[24px]">
            Branchenzuordnung
          </h1>
          <p className="mt-1 text-[13px] text-[var(--helper)]">
            Keywords eingeben · AVA schlägt Branchen vor
          </p>

          <label className="mt-4 mb-1.5 block text-[12px] font-semibold text-[var(--helper)]">
            Keywords
          </label>
          <div
            className="flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-md border border-[var(--helper)] bg-white px-2.5 py-2"
            onClick={() => inputRef.current?.focus()}
          >
            {keywords.map((k) => (
              <button
                key={k}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeKeyword(k);
                }}
                className="rounded-full bg-[var(--progress-track)] px-3 py-1 text-[13px] text-[var(--ink)]"
                title="Entfernen"
              >
                {k}
              </button>
            ))}
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addKeyword(draft);
                }
                if (e.key === "Backspace" && !draft && keywords.length) {
                  removeKeyword(keywords[keywords.length - 1]);
                }
              }}
              onBlur={() => {
                if (draft.trim()) addKeyword(draft);
              }}
              placeholder={
                keywords.length ? "Add another keyword…" : "e.g. solar, catering, toys…"
              }
              className="min-w-[160px] flex-1 border-0 bg-transparent py-1 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--helper)]"
            />
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--helper)]">
            Add keywords · separate with a comma (,) or press Enter
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGEST_CHIPS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => addKeyword(ex)}
                className="rounded-full border border-[#c8c8d0] bg-white px-2.5 py-1 text-[12px] text-[var(--ink)] hover:border-[var(--ink)]"
              >
                + {ex}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void runAnalyze()}
              disabled={!canAnalyze || analyzing}
              className="inline-flex h-10 items-center gap-2 rounded-[30px] px-5 text-[14px] font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--blue-2)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/figma/sparkles.svg"
                alt=""
                width={14}
                height={14}
                className="brightness-0 invert"
              />
              {analyzing ? "AVA analysiert…" : "Analysieren"}
            </button>
            {meta.ms != null && (
              <span className="text-[12px] text-[var(--helper)]">
                {(meta.ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {error && (
            <p className="mt-3 text-[13px] text-red-700">{error}</p>
          )}
        </section>

        {/* Assigned = results land here directly */}
        <section className="mt-4 rounded-2xl border border-[var(--line)] bg-white px-5 py-5 md:px-6">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">
                Zuordnung
              </h2>
              <p className="text-[12px] text-[var(--helper)]">
                Detailbranche · Hauptbranche · Anteil %
              </p>
            </div>
            {assigned.some((a) => a.pct !== "") && (
              <p
                className={`text-[13px] font-semibold ${
                  Math.abs(pctSum - 100) < 0.6
                    ? "text-emerald-700"
                    : "text-[var(--ink)]"
                }`}
              >
                Summe {pctSum}%
              </p>
            )}
          </div>

          {analyzing ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-[var(--grey-96)]"
                />
              ))}
            </div>
          ) : assigned.length === 0 ? (
            <p className="rounded-lg bg-[var(--grey-96)] px-4 py-4 text-[13px] text-[var(--helper)]">
              Noch keine Branchen — Keywords eingeben und Analysieren.
            </p>
          ) : (
            <ul className="space-y-2">
              {assigned.map((a) => {
                const l2 = de(a.bankable_id);
                if (!l2) return null;
                return (
                  <li
                    key={a.id}
                    className="grid grid-cols-1 items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-3 sm:grid-cols-[1fr_110px]"
                  >
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[var(--ink)]">
                        {l2.label_de}
                      </p>
                      <p className="text-[12px] text-[var(--helper)]">
                        {l2.level1_label_de}
                        <span className="text-[var(--muted)]"> · {l2.bankable_id}</span>
                      </p>
                    </div>
                    <div className="relative w-full sm:w-[110px]">
                      <input
                        value={a.pct}
                        onChange={(e) => setPct(a.id, e.target.value)}
                        placeholder="Anteil"
                        inputMode="decimal"
                        className="h-10 w-full rounded-md border border-[var(--helper)] bg-white px-3 pr-9 text-[14px] outline-none focus:border-[var(--blue-2)]"
                      />
                      <Image
                        src="/brand/figma/percent.svg"
                        alt=""
                        width={18}
                        height={18}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add more industry — Figma style */}
          {!showManual ? (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-[30px] border border-[var(--ink)] bg-white px-5 text-[14px] font-semibold text-[var(--ink)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/figma/circle-plus.svg" alt="" width={18} height={18} />
              Branche hinzufügen
            </button>
          ) : (
            <div className="mt-4 space-y-3 rounded-xl border border-[var(--line)] bg-[var(--grey-96)] p-3">
              <p className="text-[12px] font-semibold text-[var(--helper)]">
                Manuell aus Katalog (Deutsch)
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <SearchableSelect
                  value={manualL1}
                  options={l1Options}
                  placeholder="Branche auswählen"
                  onChange={(v) => {
                    setManualL1(v);
                    setManualL2("");
                  }}
                />
                <SearchableSelect
                  value={manualL2}
                  options={l2Options}
                  placeholder="Detailbranche auswählen"
                  onChange={(v) => {
                    setManualL2(v);
                    const row = byId.get(v);
                    if (row) setManualL1(row.level1_id);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addManual}
                  disabled={!manualL2}
                  className="h-9 rounded-[30px] px-4 text-[13px] font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--blue-2)" }}
                >
                  Übernehmen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManual(false);
                    setManualL1("");
                    setManualL2("");
                  }}
                  className="h-9 rounded-[30px] border border-[var(--helper)] px-4 text-[13px] font-semibold text-[var(--ink)]"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
