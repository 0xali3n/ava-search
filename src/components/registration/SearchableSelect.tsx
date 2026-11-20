"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  emptyText?: string;
  disabled?: boolean;
};

/** Figma-style searchable select (Branche / Detailbranche). */
export default function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
  emptyText = "Keine Treffer",
  disabled = false,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-[var(--helper)] bg-white px-3 py-3 text-left text-[15px] outline-none disabled:opacity-50"
      >
        <span
          className={
            selected ? "truncate text-[var(--ink)]" : "truncate text-[var(--helper)]"
          }
        >
          {selected?.label ?? placeholder}
        </span>
        <Image
          src="/brand/figma/chevrons.svg"
          alt=""
          width={20}
          height={20}
          className="shrink-0"
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-md border border-[var(--helper)] bg-white shadow-lg"
          role="listbox"
          id={listId}
        >
          <div className="border-b border-[var(--line)] p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen…"
              className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--grey-96)] px-3 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--helper)]"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && filtered[0]) {
                  e.preventDefault();
                  pick(filtered[0].value);
                }
              }}
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[14px] text-[var(--helper)]">{emptyText}</li>
            )}
            {filtered.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`flex w-full flex-col items-start px-3 py-2.5 text-left text-[15px] hover:bg-[var(--progress-track)] ${
                      active ? "bg-[var(--progress-track)]" : ""
                    }`}
                    onClick={() => pick(o.value)}
                  >
                    <span className="text-[var(--ink)]">{o.label}</span>
                    {o.hint && (
                      <span className="mt-0.5 text-[12px] text-[var(--helper)]">
                        {o.hint}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {value && (
            <button
              type="button"
              className="w-full border-t border-[var(--line)] px-3 py-2 text-left text-[13px] text-[var(--helper)] hover:bg-[var(--grey-96)]"
              onClick={() => pick("")}
            >
              Auswahl löschen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
