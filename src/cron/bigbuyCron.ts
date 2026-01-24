import cron from "node-cron";
import { logger } from "../utils/logger";
import {
  fetchBigBuyCatalog,
  upsertCatalog,
  syncStockOnePage,
  syncPricesOnePage,
  syncProductsInformationOnePage,
  syncProductsImagesOnePage,
} from "../services/bigbuySyncService";

const parentTaxonomy = process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined;

let started = false;

// ✅ anti-chevauchement
const locks: Record<string, boolean> = {};

async function runLocked(jobName: string, fn: () => Promise<void>) {
  if (locks[jobName]) {
    logger.warn({ msg: `Cron ${jobName} skipped (already running)` });
    return;
  }
  locks[jobName] = true;

  const startedAt = Date.now();
  try {
    logger.info({ msg: `Cron ${jobName} start` });
    await fn();
    logger.info({ msg: `Cron ${jobName} success`, durationMs: Date.now() - startedAt });
  } catch (e: any) {
    logger.error({ msg: `Cron ${jobName} failed`, errorMessage: e?.message, stack: e?.stack });
  } finally {
    locks[jobName] = false;
  }
}

export function startBigBuyCrons() {
  if (started) return;
  started = true;

  // 1) Catalogue (⚠️ potentiellement lourd)
  // => OK temporaire, mais à refacto en 1 page/run comme les autres
  cron.schedule("10 3 * * *", async () => {
    await runLocked("syncCatalogDaily", async () => {
      const products = await fetchBigBuyCatalog();
      const result = await upsertCatalog(products);
      logger.info({
        msg: "Cron syncCatalogDaily result",
        fetched: products.length,
        insertedOrUpdated: result.insertedOrUpdated,
      });
    });
  });

  // 2) Stock : toutes les 30 minutes (1 page/run)
  cron.schedule("*/30 * * * *", async () => {
    await runLocked("syncStock", async () => {
      const result = await syncStockOnePage({ pageSize: 0, parentTaxonomy });
      logger.info({ msg: "Cron syncStock result", result });
    });
  });

  // 3) Prix : toutes les 2h à :05 (au lieu de 4/jour)
  cron.schedule("5 */2 * * *", async () => {
    await runLocked("syncPrices", async () => {
      const result = await syncPricesOnePage({ pageSize: 0, parentTaxonomy, includePriceLargeQuantities: false });
      logger.info({ msg: "Cron syncPrices result", result });
    });
  });

  // 4) Product info : toutes les heures à :15
  cron.schedule("15 * * * *", async () => {
    await runLocked("syncProductsInformation", async () => {
      const isoCode = process.env.BIGBUY_ISO || "fr";
      const result = await syncProductsInformationOnePage({ pageSize: 0, isoCode, parentTaxonomy });
      logger.info({ msg: "Cron syncProductsInformation result", result });
    });
  });

  // 5) Images : toutes les 2h à :25 (plus safe)
  cron.schedule("25 */2 * * *", async () => {
    await runLocked("syncImages", async () => {
      const result = await syncProductsImagesOnePage({ pageSize: 0, parentTaxonomy });
      logger.info({ msg: "Cron syncImages result", result });
    });
  });

  logger.info({ msg: "BigBuy crons started ✅", parentTaxonomy });
}
