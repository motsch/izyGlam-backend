import * as express from "express";
import { logger } from "../utils/logger";
import { getBigBuyJobStatus, runExclusiveBigBuyJob } from "../services/bigbuyJobManager";
import { runBigBuyBootstrap } from "../scripts/bootstrapBigBuyCore";
import { syncStockOnePage, syncPricesOnePage, syncProductsInformationOnePage, syncProductsImagesOnePage } from "../services/bigbuySyncService";

export const getStatus = async (req: express.Request, res: express.Response) => {
  return res.json(getBigBuyJobStatus());
};

export const startBootstrap = async (req: express.Request, res: express.Response) => {
  try {
    await runExclusiveBigBuyJob("BOOTSTRAP", async () => {
      await runBigBuyBootstrap();
    });

    return res.json({ ok: true, status: getBigBuyJobStatus() });
  } catch (e: any) {
    return res.status(409).json({ ok: false, message: e?.message || "Job failed", status: getBigBuyJobStatus() });
  }
};

export const startSync = async (req: express.Request, res: express.Response) => {
  const type = String(req.body?.type || "");
  const parentTaxonomy = process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined;
  const isoCode = process.env.BIGBUY_ISO || "fr";

  try {
    if (!["STOCK", "PRICES", "INFO", "IMAGES"].includes(type)) {
      return res.status(400).json({ ok: false, message: "type must be STOCK|PRICES|INFO|IMAGES" });
    }

    if (type === "STOCK") {
      await runExclusiveBigBuyJob("SYNC_STOCK", async () => {
        await syncStockOnePage({ pageSize: 0, parentTaxonomy });
      });
    }

    if (type === "PRICES") {
      await runExclusiveBigBuyJob("SYNC_PRICES", async () => {
        await syncPricesOnePage({ pageSize: 0, parentTaxonomy, includePriceLargeQuantities: false });
      });
    }

    if (type === "INFO") {
      await runExclusiveBigBuyJob("SYNC_INFO", async () => {
        await syncProductsInformationOnePage({ pageSize: 0, isoCode, parentTaxonomy });
      });
    }

    if (type === "IMAGES") {
      await runExclusiveBigBuyJob("SYNC_IMAGES", async () => {
        await syncProductsImagesOnePage({ pageSize: 0, parentTaxonomy });
      });
    }

    return res.json({ ok: true, status: getBigBuyJobStatus() });
  } catch (e: any) {
    logger.error({ msg: "startSync failed", errorMessage: e?.message, stack: e?.stack });
    return res.status(409).json({ ok: false, message: e?.message || "Job failed", status: getBigBuyJobStatus() });
  }
};

module.exports = {
  getStatus,
  startBootstrap,
  startSync,
};
