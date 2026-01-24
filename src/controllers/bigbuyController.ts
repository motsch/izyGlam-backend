import * as express from "express";
import { logger } from "../utils/logger";
import { fetchBigBuyCatalog, syncProductsInformationOnePage, upsertCatalog } from "../services/bigbuySyncService";
import { syncStockOnePage, syncPricesOnePage } from "../services/bigbuySyncService";

const parentTaxonomy = process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined;

const importCatalog = async (req: express.Request, res: express.Response) => {
  try {
    logger.info({ msg: "importCatalog start", route: "POST /api/admin/bigbuy/import", userId: (req as any).user?._id });

    const products = await fetchBigBuyCatalog({ parentTaxonomy });
    const result = await upsertCatalog(products);

    res.json({ fetched: products.length, insertedOrUpdated: result.insertedOrUpdated });
  } catch (error: any) {
    logger.error({ msg: "importCatalog failed", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible d'importer le catalogue BigBuy" });
  }
};

const syncStock = async (req: express.Request, res: express.Response) => {
  try {
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 0;

    const parentTaxonomy =
      req.query.parentTaxonomy
        ? Number(req.query.parentTaxonomy)
        : (process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined);

    const result = await syncStockOnePage({ pageSize, parentTaxonomy });

    res.json(result);
  } catch (error: any) {
    logger.error({ msg: "syncStock failed", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de synchroniser le stock BigBuy" });
  }
};

const syncPrices = async (req: express.Request, res: express.Response) => {
  try {
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 0;

    const parentTaxonomy =
      req.query.parentTaxonomy
        ? Number(req.query.parentTaxonomy)
        : (process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined);

    const includePriceLargeQuantities = req.query.includePriceLargeQuantities === "true";

    const result = await syncPricesOnePage({ pageSize, parentTaxonomy, includePriceLargeQuantities });

    res.json(result);
  } catch (error: any) {
    logger.error({ msg: "syncPrices failed", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de synchroniser les prix BigBuy" });
  }
};

const syncProductsInformation = async (req: express.Request, res: express.Response) => {
  try {
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 0;
    const isoCode = (req.query.isoCode as string) || process.env.BIGBUY_ISO || "fr";

    const parentTaxonomy =
      req.query.parentTaxonomy
        ? Number(req.query.parentTaxonomy)
        : (process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined);

    const result = await syncProductsInformationOnePage({ pageSize, isoCode, parentTaxonomy });
    res.json(result);
  } catch (error: any) {
    logger.error({ msg: "syncProductsInformation failed", errorMessage: error?.message, stack: error?.stack });
    res.status(500).json({ message: "Impossible de synchroniser les infos produits BigBuy" });
  }
};

module.exports = { importCatalog, syncStock, syncPrices, syncProductsInformation };
