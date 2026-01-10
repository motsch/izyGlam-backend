import bigbuySyncStateModel from "../models/bigbuySyncState";
import productModel from "../models/product";
import { bigbuyHttp, bb } from "./bigbuyClient";

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s.replace(" ", "T") + "Z"); // simple conversion
  return isNaN(d.getTime()) ? undefined : d;
}

function toNumber(v: any): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}


function parseMaybeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export type BigBuyProduct = {
  manufacturer?: number;
  id: number;
  sku?: string;
  ean13?: string;
  weight?: number;
  height?: number;
  width?: number;
  depth?: number;
  dateUpd?: string;
  category?: number;
  dateUpdDescription?: string;
  dateUpdImages?: string;
  dateUpdStock?: string;
  wholesalePrice?: string;
  retailPrice?: string;
  taxonomy?: number;
  dateAdd?: string;
  condition?: string;
  logisticClass?: string;
  taxRate?: number;
  tags?: any;
  images?: any;
};

export async function fetchBigBuyCatalog(options?: { parentTaxonomy?: number; page?: number; pageSize?: number }) {
  const url = bb("/rest/catalog/products");
  const params: any = {};
  if (options?.parentTaxonomy !== undefined) params.parentTaxonomy = options.parentTaxonomy;
  if (options?.page !== undefined) params.page = options.page;
  if (options?.pageSize !== undefined) params.pageSize = options.pageSize;

  const { data } = await bigbuyHttp.get(url, { params });
  return Array.isArray(data) ? data : (data?.data || data?.result || []);
}


export async function upsertCatalog(products: BigBuyProduct[]) {
  if (!products?.length) return { insertedOrUpdated: 0 };

  const ops = products.map((p) => {
    const update: any = {
      $set: {
        manufacturerId: p.manufacturer,
        categoryId: p.category,
        taxonomyId: p.taxonomy,

        weight: p.weight,
        height: p.height,
        width: p.width,
        depth: p.depth,

        condition: p.condition,
        logisticClass: p.logisticClass,

        "pricing.wholesalePrice": toNumber(p.wholesalePrice),
        "pricing.retailPrice": toNumber(p.retailPrice),
        "pricing.taxRate": toNumber(p.taxRate),
        "pricing.currency": "EUR",

        "supplier.provider": "bigbuy",
        "supplier.bigbuyId": p.id,
        "supplier.sku": p.sku,
        "supplier.ean13": p.ean13,

        "supplier.dateAdd": parseDate(p.dateAdd),
        "supplier.dateUpd": parseDate(p.dateUpd),
        "supplier.dateUpdStock": parseDate(p.dateUpdStock),
        "supplier.dateUpdImages": parseDate(p.dateUpdImages),
        "supplier.dateUpdDescription": parseDate(p.dateUpdDescription),
      },
      $setOnInsert: {
        title: p.sku ? `Produit ${p.sku}` : `Produit ${p.id}`, // placeholder (tu mettras la vraie fiche ensuite)
        images: [],
        tags: [],
        "visibility.status": "DRAFT",
        "visibility.isFeatured": false,
      },
    };

    return {
      updateOne: {
        filter: { "supplier.provider": "bigbuy", "supplier.bigbuyId": p.id },
        update,
        upsert: true,
      },
    };
  });

  const result = await productModel.bulkWrite(ops, { ordered: false });
  const count =
    (result.upsertedCount || 0) +
    (result.modifiedCount || 0) +
    (result.matchedCount || 0);

  return { insertedOrUpdated: count, raw: result };
}



/** ---------------------------
 *  STOCK
 *  Endpoint: /rest/catalog/productsstockbyhandlingdays.{format}
 *  Params: page, pageSize, parentTaxonomy
 * --------------------------- */

type BigBuyStockRow = {
  id?: number;              // parfois "id"
  product?: number;         // parfois "product"
  handlingDays?: number;
  quantity?: number;
  stock?: number;           // parfois "stock"
};

export async function fetchBigBuyStockPage(page: number, pageSize = 0, parentTaxonomy?: number) {
  const url = bb("/rest/catalog/productsstockbyhandlingdays");
  const params: any = { page, pageSize };
  if (parentTaxonomy !== undefined) params.parentTaxonomy = parentTaxonomy;

  const { data } = await bigbuyHttp.get(url, { params });
  return parseMaybeArray(data) as BigBuyStockRow[];
}

/**
 * Sync 1 page de stock (respect rate-limit).
 * - agrège par produit => total qty + détails par handlingDays
 */
export async function syncStockOnePage(options?: { pageSize?: number; parentTaxonomy?: number }) {
  const pageSize = options?.pageSize ?? 0;
  const parentTaxonomy = options?.parentTaxonomy;

  const state = await bigbuySyncStateModel.findOneAndUpdate(
    { key: "stock" },
    { $setOnInsert: { key: "stock", lastPage: 0 } },
    { upsert: true, new: true }
  );

  const page = state.lastPage || 0;
  const rows = await fetchBigBuyStockPage(page, pageSize, parentTaxonomy);

  // Si vide => on repart à 0 (fin pagination)
  if (!rows.length) {
    await bigbuySyncStateModel.updateOne({ key: "stock" }, { $set: { lastPage: 0, lastRunAt: new Date() } });
    return { page, processed: 0, finished: true };
  }

  // group by productId
  const grouped = new Map<number, { total: number; byDays: { handlingDays: number; quantity: number }[] }>();

  for (const r of rows) {
    const bigbuyId = toNumber(r.id ?? r.product);
    if (!bigbuyId) continue;

    const handlingDays = toNumber(r.handlingDays) ?? 0;
    const qty = toNumber(r.quantity ?? r.stock) ?? 0;

    if (!grouped.has(bigbuyId)) grouped.set(bigbuyId, { total: 0, byDays: [] });
    const g = grouped.get(bigbuyId)!;
    g.total += qty;
    g.byDays.push({ handlingDays, quantity: qty });
  }

  const now = new Date();

  const ops = Array.from(grouped.entries()).map(([bigbuyId, g]) => ({
    updateOne: {
      filter: { "supplier.provider": "bigbuy", "supplier.bigbuyId": bigbuyId },
      update: {
        $set: {
          "stock.supplierQty": g.total,
          "stock.byHandlingDays": g.byDays,
          "stock.supplierUpdatedAt": now,
        },
      },
    },
  }));

  if (ops.length) {
    await productModel.bulkWrite(ops, { ordered: false });
  }

  // page suivante
  await bigbuySyncStateModel.updateOne(
    { key: "stock" },
    { $set: { lastPage: page + 1, lastRunAt: new Date() } }
  );

  return { page, processed: ops.length, finished: false };
}

/** ---------------------------
 *  PRICES
 *  Endpoint: /rest/catalog/productprices.{format}
 *  Params: includePriceLargeQuantities, page, pageSize, parentTaxonomy
 * --------------------------- */

type BigBuyPriceRow = {
  id?: number;              // parfois "id"
  product?: number;         // parfois "product"
  wholesalePrice?: string | number;
  retailPrice?: string | number;
  taxRate?: number;
};

export async function fetchBigBuyPricesPage(
  page: number,
  pageSize = 0,
  includePriceLargeQuantities = false,
  parentTaxonomy?: number
) {
  const url = bb("/rest/catalog/productprices");
  const params: any = { page, pageSize, includePriceLargeQuantities };
  if (parentTaxonomy !== undefined) params.parentTaxonomy = parentTaxonomy;

  const { data } = await bigbuyHttp.get(url, { params });
  return parseMaybeArray(data) as BigBuyPriceRow[];
}

export async function syncPricesOnePage(options?: {
  pageSize?: number;
  includePriceLargeQuantities?: boolean;
  parentTaxonomy?: number;
}) {
  const pageSize = options?.pageSize ?? 0;
  const includePriceLargeQuantities = options?.includePriceLargeQuantities ?? false;
  const parentTaxonomy = options?.parentTaxonomy;

  const state = await bigbuySyncStateModel.findOneAndUpdate(
    { key: "prices" },
    { $setOnInsert: { key: "prices", lastPage: 0 } },
    { upsert: true, new: true }
  );

  const page = state.lastPage || 0;
  const rows = await fetchBigBuyPricesPage(page, pageSize, includePriceLargeQuantities, parentTaxonomy);

  if (!rows.length) {
    await bigbuySyncStateModel.updateOne({ key: "prices" }, { $set: { lastPage: 0, lastRunAt: new Date() } });
    return { page, processed: 0, finished: true };
  }

  const now = new Date();

  const ops = rows
    .map((r) => {
      const bigbuyId = toNumber(r.id ?? r.product);
      if (!bigbuyId) return null;

      return {
        updateOne: {
          filter: { "supplier.provider": "bigbuy", "supplier.bigbuyId": bigbuyId },
          update: {
            $set: {
              "pricing.wholesalePrice": toNumber(r.wholesalePrice),
              "pricing.retailPrice": toNumber(r.retailPrice),
              "pricing.taxRate": toNumber(r.taxRate),
              "pricing.currency": "EUR",
              updatedAt: now,
            },
          },
        },
      };
    })
    .filter(Boolean) as any[];

  if (ops.length) {
    await productModel.bulkWrite(ops, { ordered: false });
  }

  await bigbuySyncStateModel.updateOne(
    { key: "prices" },
    { $set: { lastPage: page + 1, lastRunAt: new Date() } }
  );

  return { page, processed: ops.length, finished: false };
}


type BigBuyProductInfo = {
  id: number;
  sku?: string;
  name?: string;
  description?: string; // HTML
  url?: string;
  isoCode?: string;
  dateUpdDescription?: string;
};

export async function fetchBigBuyProductsInformationPage(options: {
  page: number;
  pageSize?: number;
  isoCode?: string;
  parentTaxonomy?: number;
}) {
  const url = bb("/rest/catalog/productsinformation");
  const params: any = {
    page: options.page,
    pageSize: options.pageSize ?? 0,
    isoCode: options.isoCode ?? "fr",
  };
  if (options.parentTaxonomy !== undefined) params.parentTaxonomy = options.parentTaxonomy;

  const { data } = await bigbuyHttp.get(url, { params });
  return parseMaybeArray(data) as BigBuyProductInfo[];
}

export async function upsertProductsInformation(rows: BigBuyProductInfo[]) {
  if (!rows?.length) return { processed: 0 };

  const now = new Date();

  const ops = rows
    .map((p) => {
      if (!p?.id) return null;

      const title = (p.name || "").trim();
      const descriptionHtml = p.description || "";

      return {
        updateOne: {
          filter: { "supplier.provider": "bigbuy", "supplier.bigbuyId": p.id },
          update: {
            $set: {
              title: title || `Produit ${p.sku || p.id}`,
              url: p.url,
              isoCode: p.isoCode || "fr",
              descriptionHtml,
              "supplier.dateUpdDescription": p.dateUpdDescription ? new Date(p.dateUpdDescription.replace(" ", "T") + "Z") : undefined,
              updatedAt: now,
            },
          },
          upsert: true, // ✅ au cas où infos arrivent avant le “products”
        },
      };
    })
    .filter(Boolean) as any[];

  if (ops.length) {
    await productModel.bulkWrite(ops, { ordered: false });
  }

  return { processed: ops.length };
}


export async function syncProductsInformationOnePage(options?: {
  pageSize?: number;
  isoCode?: string;
  parentTaxonomy?: number;
}) {
  const pageSize = options?.pageSize ?? 0;
  const isoCode = options?.isoCode ?? "fr";
  const parentTaxonomy = options?.parentTaxonomy;

  const state = await bigbuySyncStateModel.findOneAndUpdate(
    { key: "productsinformation" },
    { $setOnInsert: { key: "productsinformation", lastPage: 0 } },
    { upsert: true, new: true }
  );

  const page = state.lastPage || 0;

  const rows = await fetchBigBuyProductsInformationPage({ page, pageSize, isoCode, parentTaxonomy });

  if (!rows.length) {
    await bigbuySyncStateModel.updateOne(
      { key: "productsinformation" },
      { $set: { lastPage: 0, lastRunAt: new Date() } }
    );
    return { page, processed: 0, finished: true };
  }

  const result = await upsertProductsInformation(rows);

  await bigbuySyncStateModel.updateOne(
    { key: "productsinformation" },
    { $set: { lastPage: page + 1, lastRunAt: new Date() } }
  );

  return { page, processed: result.processed, finished: false };
}


type BigBuyImage = {
  id?: number;
  isCover?: string | boolean;
  name?: string;
  url?: string;
  position?: number;

  logo?: boolean;
  whiteBackground?: boolean;
  marketingPhoto?: number | boolean;
  packagingPhoto?: number | boolean;
  brand?: number | boolean;

  gpsrLabel?: boolean;
  gpsrWarning?: boolean;

  energyEfficiency?: number;
  icon?: number;
};

type BigBuyProductImagesRow = {
  id: number; // bigbuy product id
  images: BigBuyImage[];
};

export async function fetchBigBuyProductsImagesPage(options: {
  page: number;
  pageSize?: number;
  parentTaxonomy?: number;
}) {
  const url = bb("/rest/catalog/productsimages");
  const params: any = {
    page: options.page,
    pageSize: options.pageSize ?? 0,
  };
  if (options.parentTaxonomy !== undefined) params.parentTaxonomy = options.parentTaxonomy;

  const { data } = await bigbuyHttp.get(url, { params });
  return parseMaybeArray(data) as BigBuyProductImagesRow[];
}

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  if (typeof v === "number") return v === 1;
  return false;
}

export async function upsertProductsImages(rows: BigBuyProductImagesRow[]) {
  if (!rows?.length) return { processed: 0 };
  const now = new Date();

  const ops = rows.map((row) => {
    const meta = (row.images || [])
      .filter((img) => !!img?.url)
      .map((img) => ({
        id: img.id,
        isCover: toBool(img.isCover),
        name: img.name,
        url: img.url,
        position: img.position,

        logo: toBool(img.logo),
        whiteBackground: toBool(img.whiteBackground),
        marketingPhoto: toBool(img.marketingPhoto),
        packagingPhoto: toBool(img.packagingPhoto),
        brand: toBool(img.brand),

        gpsrLabel: toBool(img.gpsrLabel),
        gpsrWarning: toBool(img.gpsrWarning),

        energyEfficiency: img.energyEfficiency,
        icon: img.icon,
      }))
      .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));

    const cover = meta.find((m) => m.isCover)?.url || meta[0]?.url || undefined;
    const urls = meta.map((m) => m.url).filter(Boolean);

    return {
      updateOne: {
        filter: { "supplier.provider": "bigbuy", "supplier.bigbuyId": row.id },
        update: {
          $set: {
            images: urls,
            coverImage: cover,
            imagesMeta: meta,
            "supplier.dateUpdImages": now,
            updatedAt: now,
          },
        },
      },
    };
  });

  if (ops.length) await productModel.bulkWrite(ops, { ordered: false });
  return { processed: ops.length };
}

export async function syncProductsImagesOnePage(options?: {
  pageSize?: number;
  parentTaxonomy?: number;
}) {
  const pageSize = options?.pageSize ?? 0;
  const parentTaxonomy = options?.parentTaxonomy;

  const state = await bigbuySyncStateModel.findOneAndUpdate(
    { key: "productsimages" },
    { $setOnInsert: { key: "productsimages", lastPage: 0 } },
    { upsert: true, new: true }
  );

  const page = state.lastPage || 0;
  const rows = await fetchBigBuyProductsImagesPage({ page, pageSize, parentTaxonomy });

  if (!rows.length) {
    await bigbuySyncStateModel.updateOne(
      { key: "productsimages" },
      { $set: { lastPage: 0, lastRunAt: new Date() } }
    );
    return { page, processed: 0, finished: true };
  }

  const result = await upsertProductsImages(rows);

  await bigbuySyncStateModel.updateOne(
    { key: "productsimages" },
    { $set: { lastPage: page + 1, lastRunAt: new Date() } }
  );

  return { page, processed: result.processed, finished: false };
}
