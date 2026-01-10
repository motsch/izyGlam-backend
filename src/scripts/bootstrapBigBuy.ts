import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";
import { logger } from "../utils/logger";

import {
  syncProductsInformationOnePage,
  syncProductsImagesOnePage,
  syncPricesOnePage,
  syncStockOnePage,
  // ⚠️ si tu as un vrai importCatalogOnePage dans tes services, importe-le ici
  // importCatalogOnePage,
} from "../services/bigbuySyncService";

/**
 * ---------------------------------------------------------
 * Utils logs & erreurs (lisibles + safe)
 * ---------------------------------------------------------
 */

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStringify(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Evite d'afficher des secrets accidentellement (token, authorization, etc.)
 */
function sanitizeForLogs(input: any) {
  if (!input || typeof input !== "object") return input;

  const forbidden = ["authorization", "token", "password", "pwd", "secret", "apiKey", "apikey", "bearer"];
  const clone = JSON.parse(JSON.stringify(input));

  const deep = (o: any) => {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      const lower = k.toLowerCase();
      if (forbidden.some((x) => lower.includes(x))) {
        o[k] = "***";
      } else if (typeof o[k] === "object") {
        deep(o[k]);
      }
    }
  };

  deep(clone);
  return clone;
}

function isAxiosError(e: any): boolean {
  return !!e && (axios.isAxiosError(e) || e?.isAxiosError);
}

function formatAxiosError(e: any) {
  const status = e?.response?.status;
  const statusText = e?.response?.statusText;
  const method = e?.config?.method?.toUpperCase();
  const url = e?.config?.baseURL ? `${e.config.baseURL}${e.config.url}` : e?.config?.url;
  const params = e?.config?.params;
  const responseData = e?.response?.data;

  return {
    type: "AxiosError",
    message: e?.message,
    status,
    statusText,
    method,
    url,
    params: sanitizeForLogs(params),
    responseData: sanitizeForLogs(responseData),
  };
}

function shouldRetry(e: any) {
  if (!isAxiosError(e)) return false;
  const status = e?.response?.status;

  // Rate limit + erreurs temporaires
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;

  // timeout / network
  const code = e?.code;
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ENOTFOUND") return true;

  return false;
}

function getBackoffMs(attempt: number, baseMs: number) {
  // backoff exponentiel soft, cap à 60s
  const ms = Math.min(baseMs * Math.pow(2, attempt - 1), 60_000);
  // jitter pour éviter les collisions
  const jitter = Math.floor(Math.random() * 500);
  return ms + jitter;
}

/**
 * ---------------------------------------------------------
 * Runner robuste : pages + retries + logs live
 * ---------------------------------------------------------
 */

type RunPagesOptions = {
  label: string;
  pages: number;
  delayMs: number;
  retryMax?: number;
  retryBaseMs?: number;
  fn: () => Promise<any>;
};

async function runPages(opts: RunPagesOptions) {
  const { label, fn, pages, delayMs } = opts;
  const retryMax = opts.retryMax ?? 3;
  const retryBaseMs = opts.retryBaseMs ?? 2000;

  logger.info({
    msg: `[BOOTSTRAP] ${label} - start`,
    pages,
    delayMs,
    retryMax,
    retryBaseMs,
  });

  let lastRemotePage: number | undefined = undefined;
  let samePageCount = 0;

  for (let i = 0; i < pages; i++) {
    const runIndex = i + 1;

    // logs "en temps réel"
    logger.info({ msg: `[BOOTSTRAP] ${label} - running`, runIndex, totalRuns: pages });

    let attempt = 0;
    while (true) {
      attempt++;

      try {
        const startedAt = Date.now();
        const result = await fn();
        const durationMs = Date.now() - startedAt;

        const safeResult = sanitizeForLogs(result);

        // pour détecter une boucle si la page côté BigBuySyncState n'avance pas
        const remotePage = typeof result?.page === "number" ? result.page : undefined;
        if (remotePage !== undefined) {
          if (lastRemotePage === remotePage) samePageCount++;
          else samePageCount = 0;

          lastRemotePage = remotePage;

          // Si ça boucle trop, on stoppe ce step pour éviter de spammer
          if (samePageCount >= 3) {
            logger.error({
              msg: `[BOOTSTRAP] ${label} - STOP (no progress detected)`,
              remotePage,
              samePageCount,
              hint: "Le state BigBuySyncState ne progresse pas (même page). Vérifie les erreurs ou la pagination.",
            });
            return;
          }
        }

        logger.info({
          msg: `[BOOTSTRAP] ${label} - page done`,
          runIndex,
          durationMs,
          result: safeResult,
        });

        if (result?.finished === true) {
          logger.info({ msg: `[BOOTSTRAP] ${label} - finished early`, atRun: runIndex });
          return;
        }

        break; // success => sortie retry loop
      } catch (e: any) {
        const ax = isAxiosError(e) ? formatAxiosError(e) : null;

        logger.error({
          msg: `[BOOTSTRAP] ${label} - error`,
          runIndex,
          attempt,
          error: ax || {
            type: "Error",
            message: e?.message,
            name: e?.name,
            stack: e?.stack,
          },
        });

        if (attempt >= retryMax || !shouldRetry(e)) {
          logger.error({
            msg: `[BOOTSTRAP] ${label} - giving up`,
            runIndex,
            attempt,
            retryMax,
          });
          break; // on abandonne cette itération, mais on continue les suivantes
        }

        const waitMs = getBackoffMs(attempt, retryBaseMs);
        logger.warn({
          msg: `[BOOTSTRAP] ${label} - retrying`,
          runIndex,
          attempt,
          waitMs,
        });
        await sleep(waitMs);
      }
    }

    // pause entre runs (anti-rate limit)
    await sleep(delayMs);
  }

  logger.info({ msg: `[BOOTSTRAP] ${label} - end` });
}

/**
 * ---------------------------------------------------------
 * Main
 * ---------------------------------------------------------
 */

async function bootstrap() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI (ou MONGODB_URI) manquant dans .env");

  const parentTaxonomy = process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined;
  const isoCode = process.env.BIGBUY_ISO || "fr";

  // Pages / délais (modifiable via .env)
  const PAGES_INFO = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_INFO || 5);
  const PAGES_IMAGES = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_IMAGES || 5);
  const PAGES_PRICES = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_PRICES || 2);
  const PAGES_STOCK = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_STOCK || 2);

  const DELAY_INFO = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_INFO_MS || 4000);
  const DELAY_IMAGES = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_IMAGES_MS || 7000);
  const DELAY_PRICES = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_PRICES_MS || 7000);
  const DELAY_STOCK = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_STOCK_MS || 7000);

  // Option import (désactivé tant que tu n’as pas la vraie implémentation)
  const ENABLE_IMPORT = process.env.BIGBUY_ENABLE_IMPORT === "true";
  const PAGES_IMPORT = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_IMPORT || 5);
  const DELAY_IMPORT = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_IMPORT_MS || 1500);

  logger.info({
    msg: "[BOOTSTRAP] config",
    mongo: mongoUri ? "OK" : "MISSING",
    parentTaxonomy,
    isoCode,
    ENABLE_IMPORT,
    pages: {
      import: PAGES_IMPORT,
      info: PAGES_INFO,
      images: PAGES_IMAGES,
      prices: PAGES_PRICES,
      stock: PAGES_STOCK,
    },
    delaysMs: {
      import: DELAY_IMPORT,
      info: DELAY_INFO,
      images: DELAY_IMAGES,
      prices: DELAY_PRICES,
      stock: DELAY_STOCK,
    },
  });

  await mongoose.connect(mongoUri);
  logger.info({ msg: "[BOOTSTRAP] Mongo connected ✅" });

  try {
    // 1) Import base technique (optionnel)
    if (ENABLE_IMPORT) {
      logger.warn({
        msg: "[BOOTSTRAP] IMPORT is enabled but make sure importCatalogOnePage is implemented.",
      });

      // ✅ Décommente quand tu as importCatalogOnePage réel
      // await runPages({
      //   label: "IMPORT catalog base",
      //   pages: PAGES_IMPORT,
      //   delayMs: DELAY_IMPORT,
      //   retryMax: 3,
      //   retryBaseMs: 3000,
      //   fn: () => importCatalogOnePage({ parentTaxonomy }),
      // });
    } else {
      logger.info({ msg: "[BOOTSTRAP] IMPORT skipped (BIGBUY_ENABLE_IMPORT != true)" });
    }

    // 2) Infos marketing
    await runPages({
      label: "SYNC product info",
      pages: PAGES_INFO,
      delayMs: DELAY_INFO,
      retryMax: 3,
      retryBaseMs: 4000,
      fn: () => syncProductsInformationOnePage({ pageSize: 0, isoCode, parentTaxonomy }),
    });

    // 3) Images
    await runPages({
      label: "SYNC images",
      pages: PAGES_IMAGES,
      delayMs: DELAY_IMAGES,
      retryMax: 3,
      retryBaseMs: 7000,
      fn: () => syncProductsImagesOnePage({ pageSize: 0, parentTaxonomy }),
    });

    // 4) Prices
    await runPages({
      label: "SYNC prices",
      pages: PAGES_PRICES,
      delayMs: DELAY_PRICES,
      retryMax: 3,
      retryBaseMs: 7000,
      fn: () => syncPricesOnePage({ pageSize: 0, parentTaxonomy, includePriceLargeQuantities: false }),
    });

    // 5) Stock
    await runPages({
      label: "SYNC stock",
      pages: PAGES_STOCK,
      delayMs: DELAY_STOCK,
      retryMax: 3,
      retryBaseMs: 7000,
      fn: () => syncStockOnePage({ pageSize: 0, parentTaxonomy }),
    });

    logger.info({ msg: "[BOOTSTRAP] Done ✅" });
  } finally {
    await mongoose.disconnect();
    logger.info({ msg: "[BOOTSTRAP] Mongo disconnected" });
  }
}

bootstrap().catch((e) => {
  const errorPayload = isAxiosError(e) ? formatAxiosError(e) : { message: e?.message, stack: e?.stack };
  logger.error({ msg: "[BOOTSTRAP] fatal", error: sanitizeForLogs(errorPayload) });

  // fallback console pour être sûr
  console.error("[BOOTSTRAP] fatal:", safeStringify(sanitizeForLogs(errorPayload)));
  process.exit(1);
});
