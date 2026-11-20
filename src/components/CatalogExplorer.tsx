"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { Catalog, Level2, SampleCompany } from "@/lib/types";
import { filterCompanies, matchesQuery } from "@/lib/search";

type Props = {
  catalog: Catalog;
  companies: SampleCompany[];
};

type Tab = "categories" | "companies";

export default function CatalogExplorer({ catalog, companies }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("categories");
  const [selectedL1, setSelectedL1] = useState<string[]>([]);
  const [selectedL2, setSelectedL2] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const deferredQuery = useDeferredValue(query);
  const q = deferredQuery.trim();
  const waiting = q.length === 1;

  const l1Set = useMemo(() => new Set(selectedL1), [selectedL1]);
  const l2Set = useMemo(() => new Set(selectedL2), [selectedL2]);

  const level2Options = useMemo(() => {
    if (!selectedL1.length) return catalog.industry_level2;
    return catalog.industry_level2.filter((r) => l1Set.has(r.level1_id));
  }, [catalog.industry_level2, selectedL1, l1Set]);

  const categoryResults = useMemo(() => {
    if (waiting) return [];
    return catalog.industry_level2.filter((r) => {
      if (l1Set.size && !l1Set.has(r.level1_id)) return false;
      if (l2Set.size && !l2Set.has(r.bankable_id)) return false;
      if (!q) return true;
      return (
        matchesQuery(r.bankable_id, q) ||
        matchesQuery(r.label_de, q) ||
        matchesQuery(r.level1_label_de, q) ||
        matchesQuery(r.level1_id, q) ||
        matchesQuery(r.wz2025_leitcodes, q) ||
        matchesQuery(r.nace_rev21, q) ||
        matchesQuery(r.note_de, q)
      );
    });
  }, [catalog.industry_level2, deferredQuery, l1Set, l2Set, q, waiting]);

  const companyResults = useMemo(() => {
    if (waiting) return [];
    return filterCompanies(companies, deferredQuery, l1Set).filter((c) => {
      if (!l2Set.size) return true;
      return c.bankable_id ? l2Set.has(c.bankable_id) : false;
    });
  }, [companies, deferredQuery, l1Set, l2Set, waiting]);

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function onToggleL1(id: string) {
    const next = selectedL1.includes(id)
      ? selectedL1.filter((x) => x !== id)
      : [...selectedL1, id];
    setSelectedL1(next);
    // drop L2 picks that no longer belong
    const allowed = new Set(
      catalog.industry_level2
        .filter((r) => !next.length || next.includes(r.level1_id))
        .map((r) => r.bankable_id)
    );
    setSelectedL2((prev) => prev.filter((id) => allowed.has(id)));
  }

  const count = tab === "categories" ? categoryResults.length : companyResults.length;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 pb-16 pt-8 md:px-8">
      <header className="rise mb-8">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--blue)]">
          BANKABLE
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--navy)] md:text-4xl">
          Branchenkatalog
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
          <strong className="font-semibold text-[var(--navy)]">235 Detailbranchen</strong> =
          category names from the Excel (not company names).{" "}
          <strong className="font-semibold text-[var(--navy)]">Unternehmen</strong> tab =
          27 example companies from the Beispiele sheet.
        </p>
      </header>

      <section className="rise rounded-3xl border border-[var(--line)] bg-white p-4 shadow-[0_20px_50px_-40px_rgba(15,28,51,0.45)] md:p-5">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, BANKABLE ID, WZ…"
            className="w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] py-3.5 pl-11 pr-4 text-[15px] text-[var(--navy)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--blue)] focus:bg-white focus:ring-4 focus:ring-[var(--blue-soft)]"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-[var(--bg)] p-1">
            <TabButton
              active={tab === "categories"}
              onClick={() => setTab("categories")}
            >
              Categories (235)
            </TabButton>
            <TabButton
              active={tab === "companies"}
              onClick={() => setTab("companies")}
            >
              Example companies
            </TabButton>
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--navy)]"
          >
            {filtersOpen ? "Hide filters" : "Show filters"}
          </button>

          {(query || selectedL1.length || selectedL2.length) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedL1([]);
                setSelectedL2([]);
              }}
              className="text-sm text-[var(--muted)] hover:text-[var(--navy)]"
            >
              Reset
            </button>
          )}
        </div>
      </section>

      <div className="rise mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        {filtersOpen && (
          <aside className="h-fit space-y-4 rounded-3xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-[var(--navy)]">
                Level 1 · Hauptbranche
              </h2>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {catalog.industry_level1.map((l1) => (
                  <label
                    key={l1.id}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedL1.includes(l1.id)}
                      onChange={() => onToggleL1(l1.id)}
                      className="mt-1 accent-[var(--blue)]"
                    />
                    <span>
                      <span className="font-medium text-[var(--navy)]">{l1.id}</span>
                      <span className="block text-[var(--muted)]">{l1.label_de}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-[var(--navy)]">
                Level 2 · Detailbranche
              </h2>
              <p className="mb-2 text-xs text-[var(--muted)]">
                {selectedL1.length
                  ? `Showing Level 2 under selected Level 1 (${level2Options.length})`
                  : "Tip: pick Level 1 first to shorten this list"}
              </p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {level2Options.map((l2) => (
                  <label
                    key={l2.bankable_id}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedL2.includes(l2.bankable_id)}
                      onChange={() =>
                        toggle(selectedL2, l2.bankable_id, setSelectedL2)
                      }
                      className="mt-1 accent-[var(--blue)]"
                    />
                    <span>
                      <span className="font-mono text-xs text-[var(--blue)]">
                        {l2.bankable_id}
                      </span>
                      <span className="block text-[var(--navy)]">{l2.label_de}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </aside>
        )}

        <main className="min-w-0">
          <p className="mb-3 px-1 text-sm text-[var(--muted)]">
            {waiting ? "Type at least 2 characters…" : `${count} results`}
          </p>

          <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_20px_50px_-42px_rgba(15,28,51,0.4)]">
            {waiting ? (
              <Quiet text="One more character…" />
            ) : tab === "categories" ? (
              <CategoryRows rows={categoryResults} />
            ) : (
              <CompanyRows rows={companyResults} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-[var(--navy)] text-white shadow-sm"
          : "text-[var(--muted)] hover:text-[var(--navy)]"
      }`}
    >
      {children}
    </button>
  );
}

function Quiet({ text }: { text: string }) {
  return (
    <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">{text}</div>
  );
}

function CategoryRows({ rows }: { rows: Level2[] }) {
  if (!rows.length) return <Quiet text="No categories found." />;

  return (
    <ul className="divide-y divide-[var(--line)]">
      {rows.map((r) => (
        <li key={r.bankable_id} className="px-5 py-4 hover:bg-[#f8fafc]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs font-semibold text-[var(--blue)]">
                {r.bankable_id}
              </p>
              <h3 className="text-base font-semibold text-[var(--navy)]">
                {r.label_de}
              </h3>
              <p className="text-sm text-[var(--muted)]">
                {r.level1_id} · {r.level1_label_de}
              </p>
            </div>
            <span className="rounded-full bg-[var(--blue-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--blue)]">
              {r.mapping_type || "—"}
            </span>
          </div>

          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <Field label="WZ Leitcodes" value={r.wz2025_leitcodes || "—"} />
            <Field label="NACE Rev. 2.1" value={r.nace_rev21 || "—"} />
          </dl>

          {r.note_de ? (
            <p className="mt-2 text-sm text-[var(--muted)]">{r.note_de}</p>
          ) : null}

          {r.source_url ? (
            <a
              href={r.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-medium text-[var(--blue)] hover:underline"
            >
              Source link ↗
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CompanyRows({ rows }: { rows: SampleCompany[] }) {
  if (!rows.length) return <Quiet text="No example companies found." />;

  return (
    <ul className="divide-y divide-[var(--line)]">
      {rows.map((c) => (
        <li key={c.name} className="px-5 py-4 hover:bg-[#f8fafc]">
          <h3 className="text-base font-semibold text-[var(--navy)]">{c.name}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            <span className="font-mono text-[var(--blue)]">{c.bankable_id}</span>
            {" · "}
            {c.level2_label_de}
            {" · "}
            {c.level1_label_de}
          </p>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <Field label="WZ 2025" value={c.wz2025 || "—"} />
            <Field label="Zuordnung" value={c.zuordnung || "—"} />
          </dl>
          {c.kommentar ? (
            <p className="mt-2 text-sm text-[var(--muted)]">{c.kommentar}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="font-medium text-[var(--navy)]">{value}</dd>
    </div>
  );
}
