import "dotenv/config";
import mongoose from "mongoose";
import { syncProductsImagesOnePage } from "../services/bigbuySyncService";
import { logger } from "../utils/logger";

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI manquant");

  await mongoose.connect(mongoUri);
  logger.info({ msg: "Mongo connected - syncBigBuyImages" });

  const parentTaxonomy = process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined;

  const result = await syncProductsImagesOnePage({ pageSize: 0, parentTaxonomy });
  logger.info({ msg: "syncBigBuyImages done", result });

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
