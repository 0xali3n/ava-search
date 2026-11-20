import type { Level2, SampleCompany } from "./types";

export function norm(s: string) {
  return s.toLowerCase().trim();
}

export function matchesQuery(hay: string, q: string) {
  return norm(hay).includes(norm(q));
}

export function filterIndustries(
  rows: Level2[],
  query: string,
  selectedL1: Set<string>,
  mappingTypes: Set<string>
) {
  const q = query.trim();
  return rows.filter((r) => {
    if (selectedL1.size && !selectedL1.has(r.level1_id)) return false;
    if (mappingTypes.size && !mappingTypes.has(r.mapping_type)) return false;
    if (!q) return true;
    return (
      matchesQuery(r.bankable_id, q) ||
      matchesQuery(r.label_de, q) ||
      matchesQuery(r.level1_label_de, q) ||
      matchesQuery(r.level1_id, q) ||
      matchesQuery(r.wz2025_leitcodes, q) ||
      matchesQuery(r.nace_rev21, q)
    );
  });
}

export function filterCompanies(
  rows: SampleCompany[],
  query: string,
  selectedL1: Set<string>
) {
  const q = query.trim();
  return rows.filter((c) => {
    if (selectedL1.size && c.level1_id && !selectedL1.has(c.level1_id)) return false;
    if (!q) return true;
    return (
      matchesQuery(c.name, q) ||
      matchesQuery(c.level2_label_de, q) ||
      matchesQuery(c.level1_label_de, q) ||
      matchesQuery(c.bankable_id || "", q) ||
      matchesQuery(c.wz2025, q)
    );
  });
}
