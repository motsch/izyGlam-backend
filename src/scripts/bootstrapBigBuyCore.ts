import { jobProgressUpdate } from "../services/bigbuyJobManager";
import {
  syncProductsInformationOnePage,
  syncProductsImagesOnePage,
  syncPricesOnePage,
  syncStockOnePage,
} from "../services/bigbuySyncService";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type RunPagesOptions = {
  label: string;
  pages: number;
  delayMs: number;
  fn: () => Promise<any>;
};

async function runPages(opts: RunPagesOptions) {
  jobProgressUpdate({ step: opts.label }, { msg: `[BOOTSTRAP] ${opts.label} start` });

  for (let i = 0; i < opts.pages; i++) {
    const runIndex = i + 1;
    jobProgressUpdate({ step: opts.label, runIndex, totalRuns: opts.pages }, { msg: `[BOOTSTRAP] ${opts.label} run ${runIndex}/${opts.pages}` });

    const result = await opts.fn();

    jobProgressUpdate(
      { page: result?.page, processed: result?.processed },
      { msg: `[BOOTSTRAP] ${opts.label} done`, data: result }
    );

    if (result?.finished === true) {
      jobProgressUpdate({}, { msg: `[BOOTSTRAP] ${opts.label} finished early`, data: result });
      break;
    }

    await sleep(opts.delayMs);
  }

  jobProgressUpdate({}, { msg: `[BOOTSTRAP] ${opts.label} end` });
}

export async function runBigBuyBootstrap() {
  const parentTaxonomy = process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined;
  const isoCode = process.env.BIGBUY_ISO || "fr";

  const PAGES_INFO = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_INFO || 10);
  const PAGES_IMAGES = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_IMAGES || 10);
  const PAGES_PRICES = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_PRICES || 3);
  const PAGES_STOCK = Number(process.env.BIGBUY_BOOTSTRAP_PAGES_STOCK || 3);

  const DELAY_INFO = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_INFO_MS || 4000);
  const DELAY_IMAGES = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_IMAGES_MS || 7000);
  const DELAY_PRICES = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_PRICES_MS || 7000);
  const DELAY_STOCK = Number(process.env.BIGBUY_BOOTSTRAP_DELAY_STOCK_MS || 7000);

  await runPages({
    label: "SYNC product info",
    pages: PAGES_INFO,
    delayMs: DELAY_INFO,
    fn: () => syncProductsInformationOnePage({ pageSize: 0, isoCode, parentTaxonomy }),
  });

  await runPages({
    label: "SYNC images",
    pages: PAGES_IMAGES,
    delayMs: DELAY_IMAGES,
    fn: () => syncProductsImagesOnePage({ pageSize: 0, parentTaxonomy }),
  });

  await runPages({
    label: "SYNC prices",
    pages: PAGES_PRICES,
    delayMs: DELAY_PRICES,
    fn: () => syncPricesOnePage({ pageSize: 0, parentTaxonomy, includePriceLargeQuantities: false }),
  });

  await runPages({
    label: "SYNC stock",
    pages: PAGES_STOCK,
    delayMs: DELAY_STOCK,
    fn: () => syncStockOnePage({ pageSize: 0, parentTaxonomy }),
  });
}
