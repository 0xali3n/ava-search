import CatalogExplorer from "@/components/CatalogExplorer";
import type { Catalog, SampleCompany } from "@/lib/types";
import { readFile } from "fs/promises";
import path from "path";

async function loadData() {
  const dataDir = path.join(process.cwd(), "public", "data");
  const catalog = JSON.parse(
    await readFile(path.join(dataDir, "branchen_catalog.json"), "utf8")
  ) as Catalog;
  const companiesFile = JSON.parse(
    await readFile(path.join(dataDir, "beispiele_companies.json"), "utf8")
  ) as { companies: SampleCompany[] };
  return { catalog, companies: companiesFile.companies };
}

export default async function CatalogPage() {
  const { catalog, companies } = await loadData();
  return <CatalogExplorer catalog={catalog} companies={companies} />;
}
