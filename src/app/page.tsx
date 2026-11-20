import IndustryAssist from "@/components/IndustryAssist";
import type { Catalog } from "@/lib/types";
import { readFile } from "fs/promises";
import path from "path";

async function loadCatalog() {
  const file = path.join(process.cwd(), "public", "data", "branchen_catalog.json");
  return JSON.parse(await readFile(file, "utf8")) as Catalog;
}

export default async function Home() {
  const catalog = await loadCatalog();
  return <IndustryAssist catalog={catalog} />;
}
