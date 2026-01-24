import "dotenv/config";
import mongoose from "mongoose";
import { syncStockOnePage } from "../services/bigbuySyncService";
import { logger } from "../utils/logger";

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb+srv://fmotsch:Fr%40ncis2018%21@cluster0.dzdgnj3.mongodb.net/devfreelance";
  if (!mongoUri) throw new Error("MONGO_URI manquant");

  await mongoose.connect(mongoUri);
  logger.info({ msg: "Mongo connected - syncBigBuyStock" });

  const result = await syncStockOnePage({ pageSize: 0 });
  logger.info({ msg: "syncBigBuyStock done", result });

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
