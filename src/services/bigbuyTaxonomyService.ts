import { bigbuyHttp, bb } from "./bigbuyClient";

type BigBuyTaxonomy = {
  id: number;
  name: string;
  url?: string;
  parentTaxonomy?: number;
  isoCode?: string;
};

function parseMaybeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function fetchTaxonomies(isoCode = "fr", firstLevel?: number): Promise<BigBuyTaxonomy[]> {
  const url = bb("/rest/catalog/taxonomies");
  const params: any = { isoCode };
  if (firstLevel !== undefined) params.firstLevel = firstLevel;

  const { data } = await bigbuyHttp.get(url, { params });
  return parseMaybeArray(data) as BigBuyTaxonomy[];
}

export async function findBeautyTaxonomyId(): Promise<{ beautyId: number; beauty: BigBuyTaxonomy; children: BigBuyTaxonomy[] }> {
  const first = await fetchTaxonomies("fr", 1);

  // On cherche d’abord un match “propre”
  const beauty =
    first.find((t) => (t.url || "").toLowerCase() === "beauty") ||
    first.find((t) => (t.name || "").toLowerCase() === "beauté") ||
    first.find((t) => (t.name || "").toLowerCase().includes("beaut"));

  if (!beauty) {
    throw new Error("Impossible de trouver la taxonomie 'Beauté' dans firstLevel=1");
  }

  // Ensuite on récupère toutes les taxonomies (ou juste fr) pour trouver ses enfants
  const all = await fetchTaxonomies("fr");
  const children = all.filter((t) => t.parentTaxonomy === beauty.id);

  return { beautyId: beauty.id, beauty, children };
}
