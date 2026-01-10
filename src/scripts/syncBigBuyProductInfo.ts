import "dotenv/config";
import mongoose from "mongoose";
import { syncProductsInformationOnePage } from "../services/bigbuySyncService";
import { logger } from "../utils/logger";

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI manquant");

  await mongoose.connect(mongoUri);
  logger.info({ msg: "Mongo connected - syncBigBuyProductInfo" });

  const parentTaxonomy = process.env.BIGBUY_PARENT_TAXONOMY ? Number(process.env.BIGBUY_PARENT_TAXONOMY) : undefined;
  const isoCode = process.env.BIGBUY_ISO || "fr";

  const result = await syncProductsInformationOnePage({ pageSize: 0, isoCode, parentTaxonomy });
  logger.info({ msg: "syncBigBuyProductInfo done", result });

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
